import type { BookingSettings, Prisma, Theatre } from "@prisma/client";

import {
  isBookingIntervalAligned,
  isDateKey,
  localBookingTimeToUtc,
  timeToMinutes,
  toBookingDate,
} from "@/lib/booking-range";
import { getOrCreateBookingSettings } from "@/services/booking/booking-settings.service";

export type AdminRangeBookingErrorCode =
  | "ADMIN_RANGE_BOOKING_DISABLED"
  | "INVALID_RANGE"
  | "OUTSIDE_BUSINESS_HOURS"
  | "MINIMUM_DURATION"
  | "CAPACITY_EXCEEDED"
  | "THEATRE_NOT_FOUND"
  | "BOOKING_CONFLICT"
  | "LOCK_CONFLICT"
  | "BLOCK_CONFLICT"
  | "SLOT_NOT_FOUND"
  | "SLOT_DATE_MISMATCH";

export class AdminRangeBookingError extends Error {
  constructor(
    public readonly code: AdminRangeBookingErrorCode,
    message: string
  ) {
    super(message);
  }
}

export type AdminRange = {
  eventDate: Date;
  startsAtUtc: Date;
  endsAtUtc: Date;
  occupiedUntilUtc: Date;
  durationMinutes: number;
};

type PricingSlot = {
  id: string;
  theatreId: string;
  date: Date;
  startTime: string;
  endTime: string;
  durationMin: number;
  basePrice: number;
  finalPrice: number;
  decorationMandatory: boolean;
};

export type AdminRangeValidationResult = {
  theatre: Pick<
    Theatre,
    | "id"
    | "name"
    | "locationId"
    | "timezone"
    | "capacity"
    | "baseGuests"
    | "extraPersonPrice"
    | "decorationPrice"
  >;
  settings: BookingSettings;
  range: AdminRange;
  pricingSlot: PricingSlot | null;
};

export function isAdminRangeBookingEnabled() {
  return String(process.env.ADMIN_RANGE_BOOKING_ENABLED ?? "").toLowerCase() === "true";
}

export async function acquireAdminRangeTransactionLock(
  tx: Prisma.TransactionClient,
  theatreId: string,
  dateKey: string
) {
  await tx.$queryRaw`
    SELECT pg_advisory_xact_lock(
      hashtext(${theatreId}),
      hashtext(${dateKey})
    )::text AS "lock"
  `;
}

export function normalizeAdminRange(input: {
  date: string;
  startTime: string;
  endTime: string;
  settings: Pick<
    BookingSettings,
    "businessOpenTime" | "businessCloseTime" | "minimumDurationMinutes" | "bufferMinutes"
  >;
  timezone: string;
}): AdminRange {
  if (
    !isDateKey(input.date) ||
    !isBookingIntervalAligned(input.startTime) ||
    !isBookingIntervalAligned(input.endTime)
  ) {
    throw new AdminRangeBookingError(
      "INVALID_RANGE",
      "Date and times must be valid and use 30-minute increments."
    );
  }

  const start = timeToMinutes(input.startTime);
  const end = timeToMinutes(input.endTime);
  const open = timeToMinutes(input.settings.businessOpenTime);
  const close = timeToMinutes(input.settings.businessCloseTime);
  if (
    start === null ||
    end === null ||
    open === null ||
    close === null ||
    end <= start
  ) {
    throw new AdminRangeBookingError("INVALID_RANGE", "End time must be after start time.");
  }
  if (start < open || end + input.settings.bufferMinutes > close) {
    throw new AdminRangeBookingError(
      "OUTSIDE_BUSINESS_HOURS",
      "The booking and its buffer must fit within business hours."
    );
  }
  if (end - start < input.settings.minimumDurationMinutes) {
    throw new AdminRangeBookingError(
      "MINIMUM_DURATION",
      `Booking must be at least ${input.settings.minimumDurationMinutes} minutes.`
    );
  }

  const startsAtUtc = localBookingTimeToUtc(input.date, input.startTime, input.timezone);
  const endsAtUtc = localBookingTimeToUtc(input.date, input.endTime, input.timezone);

  return {
    eventDate: toBookingDate(input.date, input.timezone),
    startsAtUtc,
    endsAtUtc,
    occupiedUntilUtc: new Date(
      endsAtUtc.getTime() + input.settings.bufferMinutes * 60_000
    ),
    durationMinutes: end - start,
  };
}

export async function validateAdminRangeBooking(
  tx: Prisma.TransactionClient,
  input: {
    theatreId: string;
    date: string;
    startTime: string;
    endTime: string;
    guestCount: number;
    pricingSlotId?: string | null;
    excludeBookingId?: string | null;
  }
): Promise<AdminRangeValidationResult> {
  await acquireAdminRangeTransactionLock(tx, input.theatreId, input.date);

  const [settings, theatre] = await Promise.all([
    getOrCreateBookingSettings(input.theatreId, tx),
    tx.theatre.findFirst({
      where: { id: input.theatreId, isActive: true },
      select: {
        id: true,
        name: true,
        locationId: true,
        timezone: true,
        capacity: true,
        baseGuests: true,
        extraPersonPrice: true,
        decorationPrice: true,
      },
    }),
  ]);

  if (!theatre) {
    throw new AdminRangeBookingError("THEATRE_NOT_FOUND", "The reservable venue is unavailable.");
  }
  if (input.guestCount > settings.maximumGuests) {
    throw new AdminRangeBookingError(
      "CAPACITY_EXCEEDED",
      `Guest count cannot exceed venue capacity (${settings.maximumGuests}).`
    );
  }

  const range = normalizeAdminRange({
    date: input.date,
    startTime: input.startTime,
    endTime: input.endTime,
    settings,
    timezone: theatre.timezone,
  });

  await tx.bookingLock.updateMany({
    where: { status: "ACTIVE", expiresAt: { lte: new Date() } },
    data: { status: "EXPIRED" },
  });

  const [bookingConflict, lockConflict, blockConflict, pricingSlot] =
    await Promise.all([
      tx.booking.findFirst({
        where: {
          theatreId: input.theatreId,
          bookingStatus: "CONFIRMED",
          id: input.excludeBookingId ? { not: input.excludeBookingId } : undefined,
          startsAtUtc: { lt: range.occupiedUntilUtc },
          occupiedUntilUtc: { gt: range.startsAtUtc },
        },
        select: { id: true },
      }),
      tx.bookingLock.findFirst({
        where: {
          theatreId: input.theatreId,
          status: "ACTIVE",
          expiresAt: { gt: new Date() },
          bookingId: input.excludeBookingId ? { not: input.excludeBookingId } : undefined,
          startsAtUtc: { lt: range.occupiedUntilUtc },
          occupiedUntilUtc: { gt: range.startsAtUtc },
        },
        select: { id: true },
      }),
      tx.availabilityBlock.findFirst({
        where: {
          theatreId: input.theatreId,
          eventDate: range.eventDate,
          isActive: true,
          startsAtUtc: { lt: range.occupiedUntilUtc },
          endsAtUtc: { gt: range.startsAtUtc },
        },
        select: { id: true },
      }),
      input.pricingSlotId
        ? tx.slot.findUnique({
            where: { id: input.pricingSlotId },
            select: {
              id: true,
              theatreId: true,
              date: true,
              startTime: true,
              endTime: true,
              durationMin: true,
              basePrice: true,
              finalPrice: true,
              decorationMandatory: true,
            },
          })
        : Promise.resolve(null),
    ]);

  if (bookingConflict) {
    throw new AdminRangeBookingError("BOOKING_CONFLICT", "Time overlaps a confirmed booking.");
  }
  if (lockConflict) {
    throw new AdminRangeBookingError("LOCK_CONFLICT", "Time is held by an active booking lock.");
  }
  if (blockConflict) {
    throw new AdminRangeBookingError("BLOCK_CONFLICT", "Time is blocked by an administrator.");
  }
  if (input.pricingSlotId && !pricingSlot) {
    throw new AdminRangeBookingError("SLOT_NOT_FOUND", "Selected pricing slot not found.");
  }
  if (pricingSlot) {
    if (
      pricingSlot.theatreId !== input.theatreId ||
      pricingSlot.startTime !== input.startTime ||
      pricingSlot.endTime !== input.endTime
    ) {
      throw new AdminRangeBookingError(
        "SLOT_DATE_MISMATCH",
        "Selected pricing slot does not match the requested booking range."
      );
    }
  }

  return { theatre, settings, range, pricingSlot };
}
