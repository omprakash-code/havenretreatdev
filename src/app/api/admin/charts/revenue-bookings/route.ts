import { NextResponse } from "next/server";
import { PaymentStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { toBookingDate } from "@/lib/booking-range";
import { formatCalendarDate, formatVenueDateKey } from "@/lib/formatters";
import { getAuthenticatedAdminIdFromCookies } from "@/services/auth/adminAuth.server";

const VALID_RANGES = ["today", "7d", "30d", "90d", "1y"] as const;
type RangeKey = (typeof VALID_RANGES)[number];

function isRangeKey(value: string): value is RangeKey {
  return (VALID_RANGES as readonly string[]).includes(value);
}

function getRangeDays(range: RangeKey): number {
  if (range === "today") return 1;
  if (range === "1y") return 365;
  if (range === "90d") return 90;
  if (range === "30d") return 30;
  return 7;
}

function getRangeLabel(key: string, range: RangeKey): string {
  if (range === "today") return "Today";
  if (range === "30d" || range === "90d" || range === "1y") {
    return formatCalendarDate(key, "dd MMM");
  }
  return formatCalendarDate(key, "EEE");
}

// Pure calendar arithmetic on "yyyy-MM-dd" keys; DST-proof because the
// venue-time boundaries are derived per key via toBookingDate.
function addDaysToDateKey(key: string, days: number) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

export async function GET(req: Request) {
  try {
    const adminId = await getAuthenticatedAdminIdFromCookies();
    if (!adminId) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const rawRange = searchParams.get("range") ?? "7d";
    const range: RangeKey = isRangeKey(rawRange) ? rawRange : "7d";
    const days = getRangeDays(range);

    const todayKey = formatVenueDateKey(new Date());
    const startKey = addDaysToDateKey(todayKey, -(days - 1));
    const rangeStart = toBookingDate(startKey);
    const rangeEndExclusive = toBookingDate(addDaysToDateKey(todayKey, 1));

    const bookings = await prisma.booking.findMany({
      where: {
        paymentStatus: PaymentStatus.PAID,
        createdAt: {
          gte: rangeStart,
          lt: rangeEndExclusive,
        },
      },
      select: {
        createdAt: true,
        totalAmount: true,
      },
    });

    const rows = new Map<
      string,
      { key: string; label: string; revenue: number; bookings: number }
    >();

    for (let i = 0; i < days; i += 1) {
      const key = addDaysToDateKey(startKey, i);
      rows.set(key, {
        key,
        label: getRangeLabel(key, range),
        revenue: 0,
        bookings: 0,
      });
    }

    for (const booking of bookings) {
      const scheduleDate = booking.createdAt ?? null;
      if (!scheduleDate) continue;
      const key = formatVenueDateKey(scheduleDate);
      const row = rows.get(key);
      if (!row) continue;

      row.revenue += Number(booking.totalAmount ?? 0);
      row.bookings += 1;
    }

    const data = Array.from(rows.values());
    const totals = data.reduce(
      (acc, row) => {
        acc.revenue += row.revenue;
        acc.bookings += row.bookings;
        return acc;
      },
      { revenue: 0, bookings: 0 }
    );

    return NextResponse.json({
      success: true,
      data,
      totals,
      range,
    });
  } catch (error) {
    console.error("ADMIN_REVENUE_BOOKINGS_CHART_ERROR", error);
    return NextResponse.json(
      { success: false, message: "Failed to fetch chart data" },
      { status: 500 }
    );
  }
}
