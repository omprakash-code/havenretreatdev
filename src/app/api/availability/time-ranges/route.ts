import { NextResponse } from "next/server";
import { formatInTimeZone } from "date-fns-tz";
import { prisma } from "@/lib/db";
import { ACTIVE_OVERLAP_BOOKING_STATUSES } from "@/services/booking/booking-safety.service";

const IST_TIMEZONE = "Asia/Kolkata";

type UnavailableReason = "BOOKED" | "BLOCKED" | "LOCKED";

function normalizeDateKey(value: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  return value;
}

function toISTDate(dateKey: string) {
  return new Date(`${dateKey}T00:00:00+05:30`);
}

function addRange(
  map: Map<string, { startTime: string; endTime: string; reason: UnavailableReason }>,
  range: { startTime: string; endTime: string; reason: UnavailableReason }
) {
  map.set(`${range.startTime}-${range.endTime}-${range.reason}`, range);
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const locationId = searchParams.get("locationId");
    const dateKey = normalizeDateKey(searchParams.get("date"));

    if (!locationId || !dateKey) {
      return NextResponse.json(
        { success: false, message: "locationId and date are required." },
        { status: 400 }
      );
    }

    const date = toISTDate(dateKey);
    const now = new Date();
    const unavailable = new Map<
      string,
      { startTime: string; endTime: string; reason: UnavailableReason }
    >();

    const slots = await prisma.slot.findMany({
      where: {
        date,
        theatre: {
          locationId,
          isActive: true,
        },
        OR: [
          { status: { in: ["BOOKED", "DISABLED"] } },
          {
            status: "LOCKED",
            lockExpiresAt: {
              gt: now,
            },
          },
        ],
      },
      select: {
        startTime: true,
        endTime: true,
        status: true,
      },
    });

    for (const slot of slots) {
      addRange(unavailable, {
        startTime: slot.startTime,
        endTime: slot.endTime,
        reason:
          slot.status === "DISABLED"
            ? "BLOCKED"
            : slot.status === "LOCKED"
              ? "LOCKED"
              : "BOOKED",
      });
    }

    const activeBookings = await prisma.booking.findMany({
      where: {
        bookingStatus: { in: [...ACTIVE_OVERLAP_BOOKING_STATUSES] },
        slot: {
          date,
          theatre: {
            locationId,
            isActive: true,
          },
        },
      },
      select: {
        slot: {
          select: {
            startTime: true,
            endTime: true,
          },
        },
      },
    });

    for (const booking of activeBookings) {
      if (!booking.slot) continue;
      addRange(unavailable, {
        startTime: booking.slot.startTime,
        endTime: booking.slot.endTime,
        reason: "BOOKED",
      });
    }

    const data = [...unavailable.values()].sort((a, b) =>
      a.startTime.localeCompare(b.startTime)
    );

    return NextResponse.json({
      success: true,
      date: formatInTimeZone(date, IST_TIMEZONE, "yyyy-MM-dd"),
      data,
    });
  } catch (error) {
    console.error("GET /api/availability/time-ranges error:", error);
    return NextResponse.json(
      { success: false, message: "Failed to load unavailable time ranges." },
      { status: 500 }
    );
  }
}
