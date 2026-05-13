import { NextResponse } from "next/server";
import { formatInTimeZone } from "date-fns-tz";
import { PaymentStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getAuthenticatedAdminIdFromCookies } from "@/services/auth/adminAuth.server";

const IST_TIMEZONE = "Asia/Kolkata";
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
  const date = new Date(`${key}T00:00:00+05:30`);
  if (range === "today") return "Today";
  if (range === "30d" || range === "90d" || range === "1y") {
    return formatInTimeZone(date, IST_TIMEZONE, "dd MMM");
  }
  return formatInTimeZone(date, IST_TIMEZONE, "EEE");
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

    const todayKey = formatInTimeZone(new Date(), IST_TIMEZONE, "yyyy-MM-dd");
    const endDayStartIST = new Date(`${todayKey}T00:00:00+05:30`);
    const startDayStartIST = new Date(endDayStartIST);
    startDayStartIST.setUTCDate(startDayStartIST.getUTCDate() - (days - 1));
    const endExclusiveIST = new Date(endDayStartIST);
    endExclusiveIST.setUTCDate(endExclusiveIST.getUTCDate() + 1);

    const bookings = await prisma.booking.findMany({
      where: {
        paymentStatus: PaymentStatus.PAID,
        createdAt: {
          gte: startDayStartIST,
          lt: endExclusiveIST,
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
      const d = new Date(startDayStartIST);
      d.setUTCDate(d.getUTCDate() + i);
      const key = formatInTimeZone(d, IST_TIMEZONE, "yyyy-MM-dd");
      rows.set(key, {
        key,
        label: getRangeLabel(key, range),
        revenue: 0,
        bookings: 0,
      });
    }

    for (const booking of bookings) {
      const key = formatInTimeZone(booking.createdAt, IST_TIMEZONE, "yyyy-MM-dd");
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
