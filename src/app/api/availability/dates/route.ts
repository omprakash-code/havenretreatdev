import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { addDaysToDateKey } from "@/lib/date";
import { formatCalendarDateKey, formatVenueDateKey } from "@/lib/formatters";
import {
  BOOKING_BUFFER_MINUTES,
  BOOKING_BUSINESS_CLOSE_TIME,
  BOOKING_BUSINESS_OPEN_TIME,
  buildRangeConflictFilter,
} from "@/lib/booking-policy";
import { timeToMinutes, toBookingDate } from "@/lib/booking-range";
import { getOwnedBookingIdFromCookies } from "@/services/booking/range-booking-api-session";

function minutesToTime(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}

const DEFAULT_AVAILABILITY_HORIZON_DAYS = 90;
// Upper bound so a mistyped env value can't produce an unbounded date list/query.
const MAX_AVAILABILITY_HORIZON_DAYS = 730;

function getAvailabilityHorizonDays() {
  const configuredDays = Number(process.env.RANGE_AVAILABILITY_DAYS);
  if (Number.isInteger(configuredDays) && configuredDays > 0) {
    return Math.min(configuredDays, MAX_AVAILABILITY_HORIZON_DAYS);
  }

  return DEFAULT_AVAILABILITY_HORIZON_DAYS;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get("locationId");

  if (!locationId) {
    return NextResponse.json(
      { success: false, message: "locationId is required" },
      { status: 400 }
    );
  }

  // Find venue IDs associated with this location via EventPackage
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
    return NextResponse.json({ success: true, data: [] });
  }

  const horizonDays = getAvailabilityHorizonDays();
  const now = new Date();
  // Venue calendar day as a date key, independent of the server timezone.
  const todayKey = formatVenueDateKey(now);

  // Find dates that are fully blocked (an approved booking occupies the entire day window)
  // For simplicity, mark a date unavailable only if an approved booking spans the
  // entire business hours window (09:00–23:00) on that date.
  // The caller's own held booking must not block dates for them.
  const ownedBookingId = await getOwnedBookingIdFromCookies();

  const confirmedBookings = await prisma.booking.findMany({
    where: {
      venueId: { in: venueIds },
      OR: buildRangeConflictFilter(
        now,
        ownedBookingId ? { id: { not: ownedBookingId } } : {}
      ),
      eventDate: {
        gte: toBookingDate(todayKey),
        lte: toBookingDate(addDaysToDateKey(todayKey, horizonDays)),
      },
    },
    select: {
      eventDate: true,
      eventStartTime: true,
      eventEndTime: true,
    },
  });

  // Build a set of fully blocked dates
  const fullyBlockedDates = new Set<string>();
  const latestEventEnd = minutesToTime(
    (timeToMinutes(BOOKING_BUSINESS_CLOSE_TIME) ?? 0) -
      BOOKING_BUFFER_MINUTES
  );
  for (const b of confirmedBookings) {
    if (
      b.eventDate &&
      b.eventStartTime === BOOKING_BUSINESS_OPEN_TIME &&
      b.eventEndTime === latestEventEnd
    ) {
      // eventDate is date-only: read its calendar day, never shift it into venue time.
      fullyBlockedDates.add(formatCalendarDateKey(b.eventDate));
    }
  }

  const dates: { date: string }[] = [];
  for (let i = 0; i < horizonDays; i++) {
    const dateKey = addDaysToDateKey(todayKey, i);
    if (!fullyBlockedDates.has(dateKey)) {
      dates.push({ date: dateKey });
    }
  }

  return NextResponse.json({ success: true, data: dates });
}
