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
import {
  compareLegacyDates,
  scheduleAvailabilityShadow,
} from "@/services/availability/availability-shadow.service";
import { getRangeAvailabilityForLocation } from "@/services/availability/availability.service";
import { addDays } from "date-fns";

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
  const legacyStartedAt = performance.now();
  try {
    const { searchParams } = new URL(req.url);
    const locationId = searchParams.get("locationId");

    if (!locationId) {
      return NextResponse.json(
        { success: false, message: "locationId is required" },
        { status: 400 }
      );
    }

    if (process.env.RANGE_AVAILABILITY_PRIMARY === "true") {
      const theatre = await prisma.theatre.findFirst({
        where: { locationId, isActive: true },
        select: { timezone: true },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      });
      if (!theatre) {
        return NextResponse.json({ success: true, data: [], engine: "RANGE" });
      }

      const configuredDays = Number(
        process.env.RANGE_AVAILABILITY_DAYS ?? 90
      );
      const horizonDays = Number.isFinite(configuredDays)
        ? Math.min(Math.max(Math.trunc(configuredDays), 1), 365)
        : 90;
      const todayKey = formatInTimeZone(
        new Date(),
        theatre.timezone,
        "yyyy-MM-dd"
      );
      const today = new Date(`${todayKey}T12:00:00Z`);
      const dateKeys = Array.from({ length: horizonDays }, (_, index) =>
        formatInTimeZone(
          addDays(today, index),
          theatre.timezone,
          "yyyy-MM-dd"
        )
      );
      const dates: Array<{ date: string; isWeekend: boolean }> = [];
      for (let index = 0; index < dateKeys.length; index += 7) {
        const batch = await Promise.all(
          dateKeys.slice(index, index + 7).map((date) =>
            getRangeAvailabilityForLocation({ locationId, date })
          )
        );
        for (const result of batch) {
          if (!result.hasAvailability) continue;
          const weekday = Number(
            formatInTimeZone(
              new Date(`${result.date}T12:00:00Z`),
              theatre.timezone,
              "i"
            )
          );
          dates.push({
            date: result.date,
            isWeekend: weekday === 6 || weekday === 7,
          });
        }
      }
      return NextResponse.json({
        success: true,
        data: dates,
        engine: "RANGE",
      });
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

    scheduleAvailabilityShadow(() =>
      compareLegacyDates({
        locationId,
        legacyDates: dates.map((item) => item.date),
        legacyDurationMs: Number(
          (performance.now() - legacyStartedAt).toFixed(2)
        ),
        requestId: req.headers.get("x-request-id"),
      })
    );

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
