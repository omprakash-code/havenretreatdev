import type { Prisma } from "@prisma/client";
import { formatInTimeZone } from "date-fns-tz";

import { prisma } from "@/lib/db";
import {
  isDateKey,
  localBookingTimeToUtc,
  timeToMinutes,
  toBookingDate,
} from "@/lib/booking-range";
import {
  DEFAULT_BOOKING_SETTINGS,
} from "@/services/booking/booking-settings.service";
import {
  minutesToTime,
  subtractMinuteRanges,
  toMinuteRange,
} from "@/services/availability/overlap.service";
import type {
  AvailabilityRange,
  RangeAvailabilityResult,
  TheatreAvailability,
} from "@/types/availability";

type DbClient = Prisma.TransactionClient | typeof prisma;

function instantToMinute(date: Date, timeZone: string) {
  const hours = Number(formatInTimeZone(date, timeZone, "HH"));
  const minutes = Number(formatInTimeZone(date, timeZone, "mm"));
  return hours * 60 + minutes;
}

function normalizeRange(
  startsAtUtc: Date,
  endsAtUtc: Date,
  reason: AvailabilityRange["reason"],
  openMinute: number,
  closeMinute: number,
  timeZone: string
) {
  const start = Math.max(instantToMinute(startsAtUtc, timeZone), openMinute);
  const end = Math.min(instantToMinute(endsAtUtc, timeZone), closeMinute);
  if (end <= start) return null;
  return {
    startTime: minutesToTime(start),
    endTime: minutesToTime(end),
    reason,
  } satisfies AvailabilityRange;
}

function dedupeRanges(ranges: AvailabilityRange[]) {
  const map = new Map<string, AvailabilityRange>();
  for (const range of ranges) {
    map.set(`${range.startTime}|${range.endTime}|${range.reason}`, range);
  }
  return [...map.values()].sort(
    (a, b) =>
      a.startTime.localeCompare(b.startTime) ||
      a.endTime.localeCompare(b.endTime) ||
      a.reason.localeCompare(b.reason)
  );
}

async function getTheatreAvailability(
  theatreId: string,
  dateKey: string,
  now: Date,
  db: DbClient
): Promise<TheatreAvailability> {
  const [storedSettings, theatre] = await Promise.all([
    db.bookingSettings.findUnique({ where: { theatreId } }),
    db.theatre.findUnique({
      where: { id: theatreId },
      select: { timezone: true },
    }),
  ]);
  if (!theatre) throw new Error(`Theatre ${theatreId} not found.`);
  const settings =
    storedSettings ?? {
      theatreId,
      ...DEFAULT_BOOKING_SETTINGS,
    };
  const openMinute = timeToMinutes(settings.businessOpenTime);
  const closeMinute = timeToMinutes(settings.businessCloseTime);
  if (openMinute === null || closeMinute === null || closeMinute <= openMinute) {
    throw new Error(`Invalid booking settings for theatre ${theatreId}.`);
  }

  const dayStartUtc = localBookingTimeToUtc(
    dateKey,
    settings.businessOpenTime,
    theatre.timezone
  );
  const dayEndUtc = localBookingTimeToUtc(
    dateKey,
    settings.businessCloseTime,
    theatre.timezone
  );
  const eventDate = toBookingDate(dateKey, theatre.timezone);

  const [bookings, locks, blocks] = await Promise.all([
    db.booking.findMany({
      where: {
        theatreId,
        bookingStatus: "CONFIRMED",
        startsAtUtc: { lt: dayEndUtc },
        occupiedUntilUtc: { gt: dayStartUtc },
      },
      select: {
        startsAtUtc: true,
        occupiedUntilUtc: true,
      },
    }),
    db.bookingLock.findMany({
      where: {
        theatreId,
        status: "ACTIVE",
        expiresAt: { gt: now },
        startsAtUtc: { lt: dayEndUtc },
        occupiedUntilUtc: { gt: dayStartUtc },
      },
      select: {
        startsAtUtc: true,
        occupiedUntilUtc: true,
      },
    }),
    db.availabilityBlock.findMany({
      where: {
        theatreId,
        eventDate,
        isActive: true,
      },
      select: {
        startsAtUtc: true,
        endsAtUtc: true,
      },
    }),
  ]);

  const unavailableRanges = dedupeRanges([
    ...bookings.flatMap((booking) =>
      booking.startsAtUtc && booking.occupiedUntilUtc
        ? [
            normalizeRange(
              booking.startsAtUtc,
              booking.occupiedUntilUtc,
              "BOOKED",
              openMinute,
              closeMinute,
              theatre.timezone
            ),
          ].filter((range): range is AvailabilityRange => Boolean(range))
        : []
    ),
    ...locks.flatMap((lock) => {
      const range = normalizeRange(
        lock.startsAtUtc,
        lock.occupiedUntilUtc,
        "LOCKED",
        openMinute,
        closeMinute,
        theatre.timezone
      );
      return range ? [range] : [];
    }),
    ...blocks.flatMap((block) =>
      block.startsAtUtc && block.endsAtUtc
        ? [
            normalizeRange(
              block.startsAtUtc,
              block.endsAtUtc,
              "BLOCKED",
              openMinute,
              closeMinute,
              theatre.timezone
            ),
          ].filter((range): range is AvailabilityRange => Boolean(range))
        : []
    ),
  ]);

  const occupiedMinuteRanges = unavailableRanges.flatMap((range) => {
    const normalized = toMinuteRange(range.startTime, range.endTime);
    return normalized ? [normalized] : [];
  });
  const availableRanges = subtractMinuteRanges(
    { start: openMinute, end: closeMinute },
    occupiedMinuteRanges
  ).map((range) => ({
    startTime: minutesToTime(range.start),
    endTime: minutesToTime(range.end),
  }));

  return {
    theatreId,
    timezone: theatre.timezone,
    businessOpenTime: settings.businessOpenTime,
    businessCloseTime: settings.businessCloseTime,
    minimumDurationMinutes: settings.minimumDurationMinutes,
    unavailableRanges,
    availableRanges,
    counts: {
      bookings: bookings.length,
      locks: locks.length,
      blocks: blocks.length,
    },
  };
}

export async function getRangeAvailabilityForLocation(
  input: {
    locationId: string;
    date: string;
    now?: Date;
  },
  db: DbClient = prisma
): Promise<RangeAvailabilityResult> {
  const startedAt = performance.now();
  if (!input.locationId) throw new Error("locationId is required.");
  if (!isDateKey(input.date)) throw new Error("A valid date is required.");

  const theatres = await db.theatre.findMany({
    where: { locationId: input.locationId, isActive: true },
    select: { id: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
  const theatreAvailability = await Promise.all(
    theatres.map((theatre) =>
      getTheatreAvailability(theatre.id, input.date, input.now ?? new Date(), db)
    )
  );
  const unavailableRanges = dedupeRanges(
    theatreAvailability.flatMap((theatre) => theatre.unavailableRanges)
  );
  const hasAvailability = theatreAvailability.some((theatre) =>
    theatre.availableRanges.some((range) => {
      const normalized = toMinuteRange(range.startTime, range.endTime);
      return (
        normalized !== null &&
        normalized.end - normalized.start >= theatre.minimumDurationMinutes
      );
    })
  );

  return {
    date: input.date,
    theatres: theatreAvailability,
    unavailableRanges,
    hasAvailability,
    durationMs: Number((performance.now() - startedAt).toFixed(2)),
  };
}
