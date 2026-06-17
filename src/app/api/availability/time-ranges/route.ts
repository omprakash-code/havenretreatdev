import { NextResponse } from "next/server";
import { toZonedTime, formatInTimeZone } from "date-fns-tz";
import { prisma } from "@/lib/db";
import {
  localBookingTimeToUtc,
  timeToMinutes as parseBookingTime,
} from "@/lib/booking-range";
import {
  ACTIVE_RANGE_HOLD_STATUSES,
  BOOKING_BUFFER_MINUTES,
  BOOKING_BUSINESS_CLOSE_TIME,
  BOOKING_BUSINESS_OPEN_TIME,
  BOOKING_TIME_ZONE,
  DEFAULT_MINIMUM_BOOKING_MINUTES,
} from "@/lib/booking-policy";
import { getOwnedBookingIdFromCookies } from "@/services/booking/range-booking-api-session";

function timeToMinutes(t: string) {
  return parseBookingTime(t) ?? 0;
}

function minutesToTime(minutes: number) {
  const h = Math.floor(minutes / 60).toString().padStart(2, "0");
  const m = (minutes % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

function normalizeDateKey(value: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  return value;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get("locationId");
  const dateKey = normalizeDateKey(searchParams.get("date"));
  // When editing an existing booking, its own slot must stay selectable so the
  // admin can keep or adjust the time range; self-conflict is handled on save.
  const excludeBookingId = searchParams.get("excludeBookingId");

  if (!locationId || !dateKey) {
    return NextResponse.json(
      { success: false, message: "locationId and date are required." },
      { status: 400 }
    );
  }

  // Find venue IDs for this location
  let packageRows = await prisma.eventPackage.findMany({
    where: { locationId, isActive: true, venue: { isActive: true } },
    select: { venueId: true },
    distinct: ["venueId"],
  });

  // Fallback: packages may not have locationId set yet (single-location / legacy data).
  // If the location exists and is active, use all active packages with active venues.
  if (packageRows.length === 0) {
    const locationExists = await prisma.location.findFirst({
      where: { id: locationId, isActive: true },
      select: { id: true },
    });
    if (locationExists) {
      packageRows = await prisma.eventPackage.findMany({
        where: { isActive: true, venue: { isActive: true } },
        select: { venueId: true },
        distinct: ["venueId"],
      });
    }
  }

  const venueIds = packageRows.map((p) => p.venueId);
  if (venueIds.length === 0) {
    return NextResponse.json(
      { success: false, message: "No active venue is available for this location." },
      { status: 404 }
    );
  }

  // UTC boundaries for the full business day on this date
  const dayStartUtc = localBookingTimeToUtc(
    dateKey,
    BOOKING_BUSINESS_OPEN_TIME,
    BOOKING_TIME_ZONE
  );
  const dayEndUtc = localBookingTimeToUtc(
    dateKey,
    BOOKING_BUSINESS_CLOSE_TIME,
    BOOKING_TIME_ZONE
  );
  const now = new Date();

  // The caller's own held booking must stay selectable so they can change
  // their time range; only other sessions' holds block availability.
  const ownedBookingId = await getOwnedBookingIdFromCookies();

  // Find CONFIRMED bookings that overlap this date
  const bookings = await prisma.booking.findMany({
    where: {
      venueId: { in: venueIds },
      ...(excludeBookingId ? { id: { not: excludeBookingId } } : {}),
      OR: [
        { bookingStatus: "CONFIRMED" },
        {
          bookingStatus: { in: [...ACTIVE_RANGE_HOLD_STATUSES] },
          holdExpiresAt: { gt: now },
          ...(ownedBookingId ? { id: { not: ownedBookingId } } : {}),
        },
      ],
      startsAtUtc: { lt: dayEndUtc },
      occupiedUntilUtc: { gt: dayStartUtc },
    },
    select: {
      eventStartTime: true,
      eventEndTime: true,
      startsAtUtc: true,
      occupiedUntilUtc: true,
      bookingStatus: true,
      bufferMinutes: true,
    },
  });

  const unavailableRanges: { startTime: string; endTime: string; reason: string }[] = [];

  for (const b of bookings) {
    let startMin: number;
    let endMin: number;

    if (b.eventStartTime && b.eventEndTime) {
      startMin = timeToMinutes(b.eventStartTime);
      endMin =
        timeToMinutes(b.eventEndTime) +
        (b.bufferMinutes ?? BOOKING_BUFFER_MINUTES);
    } else if (b.startsAtUtc && b.occupiedUntilUtc) {
      // Fall back to UTC timestamps for bookings missing local time strings
      const startLocal = toZonedTime(b.startsAtUtc, BOOKING_TIME_ZONE);
      const endLocal = toZonedTime(b.occupiedUntilUtc, BOOKING_TIME_ZONE);
      startMin = startLocal.getHours() * 60 + startLocal.getMinutes();
      endMin = endLocal.getHours() * 60 + endLocal.getMinutes();
    } else {
      continue;
    }

    const cappedEnd = Math.min(
      endMin,
      timeToMinutes(BOOKING_BUSINESS_CLOSE_TIME)
    );
    unavailableRanges.push({
      startTime: minutesToTime(startMin),
      endTime: minutesToTime(cappedEnd),
      reason: b.bookingStatus === "CONFIRMED" ? "BOOKED" : "LOCKED",
    });
  }

  // Find the minimum duration from the smallest package for this location
  const smallestPackage = await prisma.eventPackage.findFirst({
    where: venueIds.length > 0
      ? { venueId: { in: venueIds }, isActive: true }
      : { locationId, isActive: true, venue: { isActive: true } },
    select: { eventDurationHours: true },
    orderBy: { eventDurationHours: "asc" },
  });

  const minimumDurationMinutes =
    smallestPackage?.eventDurationHours != null
      ? smallestPackage.eventDurationHours * 60
      : DEFAULT_MINIMUM_BOOKING_MINUTES;

  const nowInVenue = toZonedTime(now, BOOKING_TIME_ZONE);
  const currentHour = nowInVenue.getHours();
  const currentMinute = nowInVenue.getMinutes();
  const currentMinutes = currentHour * 60 + currentMinute;

  // If booking is for today, block past times
  const todayKey = formatInTimeZone(now, BOOKING_TIME_ZONE, "yyyy-MM-dd");

  if (
    dateKey === todayKey &&
    currentMinutes > timeToMinutes(BOOKING_BUSINESS_OPEN_TIME)
  ) {
    // Round up to next 30-min slot
    const blockedUntil = Math.ceil((currentMinutes + 1) / 30) * 30;
    const cappedEnd = Math.min(
      blockedUntil,
      timeToMinutes(BOOKING_BUSINESS_CLOSE_TIME)
    );
    if (cappedEnd > timeToMinutes(BOOKING_BUSINESS_OPEN_TIME)) {
      unavailableRanges.push({
        startTime: BOOKING_BUSINESS_OPEN_TIME,
        endTime: minutesToTime(cappedEnd),
        reason: "BLOCKED",
      });
    }
  }

  return NextResponse.json({
    success: true,
    date: dateKey,
    data: unavailableRanges,
    theatres: [
      {
        businessOpenTime: BOOKING_BUSINESS_OPEN_TIME,
        businessCloseTime: minutesToTime(
          timeToMinutes(BOOKING_BUSINESS_CLOSE_TIME) - BOOKING_BUFFER_MINUTES
        ),
        minimumDurationMinutes,
        timezone: BOOKING_TIME_ZONE,
      },
    ],
  });
}
