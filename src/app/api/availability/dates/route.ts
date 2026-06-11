import { NextResponse } from "next/server";
import { addDays, startOfDay } from "date-fns";
import { formatInTimeZone, toZonedTime } from "date-fns-tz";
import { prisma } from "@/lib/db";
import {
  ACTIVE_RANGE_HOLD_STATUSES,
  BOOKING_BUFFER_MINUTES,
  BOOKING_BUSINESS_CLOSE_TIME,
  BOOKING_BUSINESS_OPEN_TIME,
  BOOKING_TIME_ZONE,
} from "@/lib/booking-policy";
import { timeToMinutes } from "@/lib/booking-range";

function minutesToTime(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}

const AVAILABILITY_HORIZON_DAYS = 90;

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
  const packageRows = await prisma.eventPackage.findMany({
    where: { locationId, isActive: true, venue: { isActive: true } },
    select: { venueId: true },
    distinct: ["venueId"],
  });

  // If no packages for this location, also check if any venue exists at all
  const venueIds = packageRows.map((p) => p.venueId);
  if (venueIds.length === 0) {
    return NextResponse.json({ success: true, data: [] });
  }

  const now = new Date();
  const nowInVenue = toZonedTime(now, BOOKING_TIME_ZONE);
  const todayInVenue = startOfDay(nowInVenue);

  // Find dates that are fully blocked (CONFIRMED booking occupies entire day window)
  // For simplicity, mark a date unavailable only if a CONFIRMED booking spans the
  // entire business hours window (09:00–23:00) on that date.
  const confirmedBookings = await prisma.booking.findMany({
    where: {
      venueId: { in: venueIds },
      OR: [
        { bookingStatus: "CONFIRMED" },
        {
          bookingStatus: { in: [...ACTIVE_RANGE_HOLD_STATUSES] },
          holdExpiresAt: { gt: now },
        },
      ],
      eventDate: {
        gte: todayInVenue,
        lte: addDays(todayInVenue, AVAILABILITY_HORIZON_DAYS),
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
      const dateKey = formatInTimeZone(b.eventDate, BOOKING_TIME_ZONE, "yyyy-MM-dd");
      fullyBlockedDates.add(dateKey);
    }
  }

  const dates: { date: string }[] = [];
  for (let i = 0; i < AVAILABILITY_HORIZON_DAYS; i++) {
    const day = addDays(todayInVenue, i);
    const dateKey = formatInTimeZone(day, BOOKING_TIME_ZONE, "yyyy-MM-dd");
    if (!fullyBlockedDates.has(dateKey)) {
      dates.push({ date: dateKey });
    }
  }

  return NextResponse.json({ success: true, data: dates });
}
