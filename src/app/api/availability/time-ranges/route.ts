import { NextResponse } from "next/server";
import { toZonedTime, formatInTimeZone } from "date-fns-tz";
import { prisma } from "@/lib/db";
import { localBookingTimeToUtc } from "@/lib/booking-range";

const VENUE_TIMEZONE = "America/New_York";
const BUSINESS_OPEN_TIME = "09:00";
const BUSINESS_CLOSE_TIME = "23:00";
const BUFFER_MINUTES = 30;

function timeToMinutes(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
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

  if (!locationId || !dateKey) {
    return NextResponse.json(
      { success: false, message: "locationId and date are required." },
      { status: 400 }
    );
  }

  // Find venue IDs for this location
  const packageRows = await prisma.eventPackage.findMany({
    where: { locationId, isActive: true, venue: { isActive: true } },
    select: { venueId: true },
    distinct: ["venueId"],
  });

  const venueIds =
    packageRows.length > 0
      ? packageRows.map((p) => p.venueId)
      : await prisma.venue
          .findMany({ where: { isActive: true }, select: { id: true } })
          .then((rows) => rows.map((r) => r.id));

  // UTC boundaries for the full business day on this date
  const dayStartUtc = localBookingTimeToUtc(dateKey, BUSINESS_OPEN_TIME, VENUE_TIMEZONE);
  const dayEndUtc = localBookingTimeToUtc(dateKey, BUSINESS_CLOSE_TIME, VENUE_TIMEZONE);

  // Find CONFIRMED bookings that overlap this date
  const bookings = await prisma.booking.findMany({
    where: {
      venueId: { in: venueIds },
      bookingStatus: "CONFIRMED",
      startsAtUtc: { lt: dayEndUtc },
      occupiedUntilUtc: { gt: dayStartUtc },
    },
    select: {
      eventStartTime: true,
      eventEndTime: true,
      startsAtUtc: true,
      occupiedUntilUtc: true,
    },
  });

  const unavailableRanges: { startTime: string; endTime: string; reason: string }[] = [];

  for (const b of bookings) {
    let startMin: number;
    let endMin: number;

    if (b.eventStartTime && b.eventEndTime) {
      startMin = timeToMinutes(b.eventStartTime);
      endMin = timeToMinutes(b.eventEndTime) + BUFFER_MINUTES;
    } else if (b.startsAtUtc && b.occupiedUntilUtc) {
      // Fall back to UTC timestamps for bookings missing local time strings
      const startLocal = toZonedTime(b.startsAtUtc, VENUE_TIMEZONE);
      const endLocal = toZonedTime(b.occupiedUntilUtc, VENUE_TIMEZONE);
      startMin = startLocal.getHours() * 60 + startLocal.getMinutes();
      endMin = endLocal.getHours() * 60 + endLocal.getMinutes();
    } else {
      continue;
    }

    const cappedEnd = Math.min(endMin, timeToMinutes(BUSINESS_CLOSE_TIME));
    unavailableRanges.push({
      startTime: minutesToTime(startMin),
      endTime: minutesToTime(cappedEnd),
      reason: "BOOKED",
    });
  }

  // Find the minimum duration from the smallest package for this location
  const smallestPackage = await prisma.eventPackage.findFirst({
    where: { locationId, isActive: true, venue: { isActive: true } },
    select: { eventDurationHours: true },
    orderBy: { eventDurationHours: "asc" },
  });

  const minimumDurationMinutes = (smallestPackage?.eventDurationHours ?? 4) * 60;

  const now = new Date();
  const nowInVenue = toZonedTime(now, VENUE_TIMEZONE);
  const currentHour = nowInVenue.getHours();
  const currentMinute = nowInVenue.getMinutes();
  const currentMinutes = currentHour * 60 + currentMinute;

  // If booking is for today, block past times
  const todayKey = formatInTimeZone(now, VENUE_TIMEZONE, "yyyy-MM-dd");

  if (dateKey === todayKey && currentMinutes > timeToMinutes(BUSINESS_OPEN_TIME)) {
    // Round up to next 30-min slot
    const blockedUntil = Math.ceil((currentMinutes + 1) / 30) * 30;
    const cappedEnd = Math.min(blockedUntil, timeToMinutes(BUSINESS_CLOSE_TIME));
    if (cappedEnd > timeToMinutes(BUSINESS_OPEN_TIME)) {
      unavailableRanges.push({
        startTime: BUSINESS_OPEN_TIME,
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
        businessOpenTime: BUSINESS_OPEN_TIME,
        businessCloseTime: BUSINESS_CLOSE_TIME,
        minimumDurationMinutes,
        timezone: VENUE_TIMEZONE,
      },
    ],
  });
}
