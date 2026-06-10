import { NextResponse } from "next/server";
import { addDays, startOfDay } from "date-fns";
import { formatInTimeZone, toZonedTime } from "date-fns-tz";
import { prisma } from "@/lib/db";

const VENUE_TIMEZONE = "America/New_York";
const AVAILABILITY_HORIZON_DAYS = 90;
const BUSINESS_OPEN_TIME = "09:00";
const BUSINESS_CLOSE_TIME = "23:00";

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
  const venueIds =
    packageRows.length > 0
      ? packageRows.map((p) => p.venueId)
      : await prisma.venue
          .findMany({ where: { isActive: true }, select: { id: true } })
          .then((rows) => rows.map((r) => r.id));

  const nowInVenue = toZonedTime(new Date(), VENUE_TIMEZONE);
  const todayInVenue = startOfDay(nowInVenue);

  // Find dates that are fully blocked (CONFIRMED booking occupies entire day window)
  // For simplicity, mark a date unavailable only if a CONFIRMED booking spans the
  // entire business hours window (09:00–23:00) on that date.
  const confirmedBookings = await prisma.booking.findMany({
    where: {
      venueId: { in: venueIds },
      bookingStatus: "CONFIRMED",
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
  for (const b of confirmedBookings) {
    if (
      b.eventDate &&
      b.eventStartTime === BUSINESS_OPEN_TIME &&
      b.eventEndTime === BUSINESS_CLOSE_TIME
    ) {
      const dateKey = formatInTimeZone(b.eventDate, VENUE_TIMEZONE, "yyyy-MM-dd");
      fullyBlockedDates.add(dateKey);
    }
  }

  const dates: { date: string }[] = [];
  for (let i = 0; i < AVAILABILITY_HORIZON_DAYS; i++) {
    const day = addDays(todayInVenue, i);
    const dateKey = formatInTimeZone(day, VENUE_TIMEZONE, "yyyy-MM-dd");
    if (!fullyBlockedDates.has(dateKey)) {
      dates.push({ date: dateKey });
    }
  }

  return NextResponse.json({ success: true, data: dates });
}
