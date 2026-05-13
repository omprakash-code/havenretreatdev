import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCouponAuditReport } from "@/services/coupon/coupon-audit.service";
import { assessCouponHealth } from "@/services/coupon/coupon-health.service";
import { getAuthenticatedAdminIdFromCookies } from "@/services/auth/adminAuth.server";

type TrendDirection = "up" | "down" | "neutral";

type AggregateRow = {
  revenue_lifetime: bigint | number | null;
  confirmed_lifetime: bigint | number | null;
  abandoned_lifetime: bigint | number | null;
  live_bookings: bigint | number | null;
  revenue_current: bigint | number | null;
  revenue_previous: bigint | number | null;
  confirmed_current: bigint | number | null;
  confirmed_previous: bigint | number | null;
  abandoned_current: bigint | number | null;
  abandoned_previous: bigint | number | null;
};

const KPI_CACHE_TTL_MS = 15_000;
let kpiCache:
  | {
      expiresAt: number;
      payload: unknown;
    }
  | null = null;

function resolveCouponAlertMinLevel() {
  const configured = String(process.env.COUPON_HEALTH_ALERT_MIN_LEVEL ?? "CRITICAL")
    .trim()
    .toUpperCase();
  if (configured === "WARNING") return "WARNING";
  return "CRITICAL";
}

function toNumber(value: bigint | number | null | undefined) {
  if (typeof value === "bigint") return Number(value);
  return Number(value ?? 0);
}

function getTrend(current: number, previous: number) {
  const difference = current - previous;
  const hasPreviousData = previous > 0;
  const direction: TrendDirection = hasPreviousData
    ? difference > 0
      ? "up"
      : difference < 0
      ? "down"
      : "neutral"
    : "neutral";

  const percentChange =
    previous === 0
      ? null
      : Number(((difference / previous) * 100).toFixed(1));

  return {
    current,
    previous,
    direction,
    absoluteChange: difference,
    percentChange,
  };
}

export async function GET() {
  try {
    const adminId = await getAuthenticatedAdminIdFromCookies();
    if (!adminId) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const cacheNow = Date.now();
    if (kpiCache && kpiCache.expiresAt > cacheNow) {
      return NextResponse.json(
        { success: true, data: kpiCache.payload },
        {
          headers: {
            "Cache-Control": "private, max-age=15, stale-while-revalidate=30",
          },
        }
      );
    }

    const now = new Date();
    const currentStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const previousStart = new Date(currentStart.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [
      [aggregateMetrics],
      couponAudit,
    ] = await Promise.all([
      prisma.$queryRaw<AggregateRow[]>`
        SELECT
          COALESCE(SUM(b."totalAmount") FILTER (WHERE b."paymentStatus" = 'PAID'), 0) AS revenue_lifetime,
          COUNT(*) FILTER (WHERE b."bookingStatus" = 'CONFIRMED') AS confirmed_lifetime,
          COUNT(*) FILTER (WHERE b."bookingStatus" = 'ABANDONED') AS abandoned_lifetime,
          COUNT(*) FILTER (
            WHERE b."bookingStatus" IN ('INCOMPLETE', 'AWAITING_PAYMENT', 'PAYMENT_PROCESSING')
              AND s."status" = 'LOCKED'
              AND s."lockExpiresAt" > NOW()
          ) AS live_bookings,
          COALESCE(SUM(b."totalAmount") FILTER (
            WHERE b."paymentStatus" = 'PAID'
              AND b."createdAt" >= ${currentStart}
              AND b."createdAt" < ${now}
          ), 0) AS revenue_current,
          COALESCE(SUM(b."totalAmount") FILTER (
            WHERE b."paymentStatus" = 'PAID'
              AND b."createdAt" >= ${previousStart}
              AND b."createdAt" < ${currentStart}
          ), 0) AS revenue_previous,
          COUNT(*) FILTER (
            WHERE b."bookingStatus" = 'CONFIRMED'
              AND b."createdAt" >= ${currentStart}
              AND b."createdAt" < ${now}
          ) AS confirmed_current,
          COUNT(*) FILTER (
            WHERE b."bookingStatus" = 'CONFIRMED'
              AND b."createdAt" >= ${previousStart}
              AND b."createdAt" < ${currentStart}
          ) AS confirmed_previous,
          COUNT(*) FILTER (
            WHERE b."bookingStatus" = 'ABANDONED'
              AND b."createdAt" >= ${currentStart}
              AND b."createdAt" < ${now}
          ) AS abandoned_current,
          COUNT(*) FILTER (
            WHERE b."bookingStatus" = 'ABANDONED'
              AND b."createdAt" >= ${previousStart}
              AND b."createdAt" < ${currentStart}
          ) AS abandoned_previous
        FROM "Booking" b
        LEFT JOIN "Slot" s ON s."id" = b."slotId"
      `,
      getCouponAuditReport({ mismatchLimit: 0 }),
    ]);

    const revenueLifetime = toNumber(aggregateMetrics?.revenue_lifetime);
    const confirmedLifetime = toNumber(aggregateMetrics?.confirmed_lifetime);
    const abandonedLifetime = toNumber(aggregateMetrics?.abandoned_lifetime);
    const liveBookings = toNumber(aggregateMetrics?.live_bookings);
    const revenueCurrent = toNumber(aggregateMetrics?.revenue_current);
    const revenuePrevious = toNumber(aggregateMetrics?.revenue_previous);
    const confirmedCurrent = toNumber(aggregateMetrics?.confirmed_current);
    const confirmedPrevious = toNumber(aggregateMetrics?.confirmed_previous);
    const abandonedCurrent = toNumber(aggregateMetrics?.abandoned_current);
    const abandonedPrevious = toNumber(aggregateMetrics?.abandoned_previous);

    const couponHealthAssessment = assessCouponHealth(couponAudit.summary);

    const payload = {
      revenueLifetime,
      confirmedLifetime,
      abandonedLifetime,
      liveBookings,
      trends: {
        periodDays: 7,
        revenue: getTrend(revenueCurrent, revenuePrevious),
        confirmed: getTrend(confirmedCurrent, confirmedPrevious),
        abandoned: getTrend(abandonedCurrent, abandonedPrevious),
      },
      couponHealth: couponAudit.summary,
      couponOps: {
        level: couponHealthAssessment.level,
        signals: couponHealthAssessment.signals,
        generatedAt: couponAudit.generatedAt,
        alerting: {
          enabled:
            String(process.env.COUPON_HEALTH_ALERT_ENABLED ?? "").toLowerCase() === "true",
          minLevel: resolveCouponAlertMinLevel(),
        },
      },
    };

    kpiCache = {
      expiresAt: Date.now() + KPI_CACHE_TTL_MS,
      payload,
    };

    return NextResponse.json(
      { success: true, data: payload },
      {
        headers: {
          "Cache-Control": "private, max-age=15, stale-while-revalidate=30",
        },
      }
    );
  } catch (error) {
    console.error("DASHBOARD_KPI_ERROR", error);
    return NextResponse.json(
      { success: false },
      { status: 500 }
    );
  }
}
