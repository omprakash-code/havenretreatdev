// src/app/api/availability/dates/route.ts
// Returns all dates that have at least one slot for a given location
// Ignores DISABLED slots
// Used to show available dates in booking flow
// Expects locationId as query parameter
// Responds with list of dates and isWeekend flags
// Uses Prisma ORM for database interactions
// responsible for fetching available dates for a location

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { formatInTimeZone } from "date-fns-tz";

const IST_TIMEZONE = "Asia/Kolkata";

/**
 * GET /api/availability/dates
 * ---------------------------
 * Returns all dates that have at least one slot
 * for a given location.
 *
 * IMPORTANT RULE:
 * - Slot can be AVAILABLE or BOOKED
 * - DISABLED slots are ignored
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const locationId = searchParams.get("locationId");

    if (!locationId) {
      return NextResponse.json(
        { success: false, message: "locationId is required" },
        { status: 400 }
      );
    }

    // Compute IST midnight as an absolute instant to avoid server-local timezone drift.
    const todayDateKeyIST = formatInTimeZone(new Date(), IST_TIMEZONE, "yyyy-MM-dd");
    const todayIST = new Date(`${todayDateKeyIST}T00:00:00+05:30`);

    /**
     * Fetch unique slot dates
     * We join through Theatre → Slot
     */
    const slots = await prisma.slot.findMany({
      where: {
        date: {
          gte: todayIST,
        },
        status: {
          not: "DISABLED",
        },
        theatre: {
          locationId,
          isActive: true,
        },
      },
      select: {
        date: true,
      },
      distinct: ["date"],
      orderBy: {
        date: "asc",
      },
    });

    const dates = slots.map((slot) => {
      // Always derive the date key/day in IST explicitly (server may run in UTC).
      const dateKey = formatInTimeZone(slot.date, IST_TIMEZONE, "yyyy-MM-dd");
      const isoWeekday = Number(
        formatInTimeZone(slot.date, IST_TIMEZONE, "i")
      ); // 1=Mon ... 7=Sun

      return {
        date: dateKey,
        isWeekend: isoWeekday === 6 || isoWeekday === 7,
      };
    });

    return NextResponse.json({
      success: true,
      data: dates,
    });
  } catch (error) {
    console.error("GET /api/availability/dates error:", error);

    return NextResponse.json(
      { success: false, message: "Failed to load available dates" },
      { status: 500 }
    );
  }
}
