import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthenticatedAdminIdFromCookies } from "@/services/auth/adminAuth.server";

type TrendDirection = "up" | "down" | "neutral";

type AggregateRow = {
  revenue_lifetime: bigint | number | null;
  approved_lifetime: bigint | number | null;
  pending_review: bigint | number | null;
  rejected_lifetime: bigint | number | null;
  abandoned_lifetime: bigint | number | null;
  live_bookings: bigint | number | null;
  revenue_current: bigint | number | null;
  revenue_previous: bigint | number | null;
  approved_current: bigint | number | null;
  approved_previous: bigint | number | null;
  rejected_current: bigint | number | null;
  rejected_previous: bigint | number | null;
  abandoned_current: bigint | number | null;
  abandoned_previous: bigint | number | null;
};

const KPI_CACHE_TTL_MS = 15_000;
const kpiCache = new Map<string, { expiresAt: number; payload: unknown }>();

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
    const includeCouponOps =
      String(searchParams.get("includeCouponOps") ?? "").toLowerCase() === "true";
    const cacheKey = includeCouponOps ? "with-coupon-ops" : "dashboard";
    const cacheNow = Date.now();
    const cached = kpiCache.get(cacheKey);
    if (cached && cached.expiresAt > cacheNow) {
      return NextResponse.json(
        { success: true, data: cached.payload },
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

    const [aggregateMetrics] = await prisma.$queryRaw<AggregateRow[]>`
        SELECT
          COALESCE(SUM(b."totalAmount") FILTER (WHERE b."paymentStatus" = 'PAID'), 0) AS revenue_lifetime,
          COUNT(*) FILTER (WHERE b."bookingStatus" IN ('APPROVED', 'CONFIRMED')) AS approved_lifetime,
          COUNT(*) FILTER (WHERE b."bookingStatus" = 'PENDING_REVIEW') AS pending_review,
          COUNT(*) FILTER (WHERE b."bookingStatus" = 'REJECTED') AS rejected_lifetime,
          COUNT(*) FILTER (WHERE b."bookingStatus" = 'ABANDONED') AS abandoned_lifetime,
          COUNT(*) FILTER (
            WHERE b."bookingStatus" IN ('INCOMPLETE', 'AWAITING_PAYMENT', 'PAYMENT_PROCESSING')
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
            WHERE b."bookingStatus" IN ('APPROVED', 'CONFIRMED')
              AND b."createdAt" >= ${currentStart}
              AND b."createdAt" < ${now}
          ) AS approved_current,
          COUNT(*) FILTER (
            WHERE b."bookingStatus" IN ('APPROVED', 'CONFIRMED')
              AND b."createdAt" >= ${previousStart}
              AND b."createdAt" < ${currentStart}
          ) AS approved_previous,
          COUNT(*) FILTER (
            WHERE b."bookingStatus" = 'REJECTED'
              AND b."createdAt" >= ${currentStart}
              AND b."createdAt" < ${now}
          ) AS rejected_current,
          COUNT(*) FILTER (
            WHERE b."bookingStatus" = 'REJECTED'
              AND b."createdAt" >= ${previousStart}
              AND b."createdAt" < ${currentStart}
          ) AS rejected_previous,
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
        WHERE b."cancelledReason" IS DISTINCT FROM 'ADMIN_SOFT_DELETED'
      `;

    const revenueLifetime = toNumber(aggregateMetrics?.revenue_lifetime);
    const approvedLifetime = toNumber(aggregateMetrics?.approved_lifetime);
    const pendingReview = toNumber(aggregateMetrics?.pending_review);
    const rejectedLifetime = toNumber(aggregateMetrics?.rejected_lifetime);
    const abandonedLifetime = toNumber(aggregateMetrics?.abandoned_lifetime);
    const liveBookings = toNumber(aggregateMetrics?.live_bookings);
    const revenueCurrent = toNumber(aggregateMetrics?.revenue_current);
    const revenuePrevious = toNumber(aggregateMetrics?.revenue_previous);
    const approvedCurrent = toNumber(aggregateMetrics?.approved_current);
    const approvedPrevious = toNumber(aggregateMetrics?.approved_previous);
    const rejectedCurrent = toNumber(aggregateMetrics?.rejected_current);
    const rejectedPrevious = toNumber(aggregateMetrics?.rejected_previous);
    const abandonedCurrent = toNumber(aggregateMetrics?.abandoned_current);
    const abandonedPrevious = toNumber(aggregateMetrics?.abandoned_previous);

    const payload = {
      revenueLifetime,
      approvedLifetime,
      confirmedLifetime: approvedLifetime,
      pendingReview,
      rejectedLifetime,
      abandonedLifetime,
      liveBookings,
      trends: {
        periodDays: 7,
        revenue: getTrend(revenueCurrent, revenuePrevious),
        approved: getTrend(approvedCurrent, approvedPrevious),
        confirmed: getTrend(approvedCurrent, approvedPrevious),
        rejected: getTrend(rejectedCurrent, rejectedPrevious),
        abandoned: getTrend(abandonedCurrent, abandonedPrevious),
      },
    };

    if (includeCouponOps) {
      const [{ getCouponAuditReport }, { assessCouponHealth }] = await Promise.all([
        import("@/services/coupon/coupon-audit.service"),
        import("@/services/coupon/coupon-health.service"),
      ]);
      const couponAudit = await getCouponAuditReport({ mismatchLimit: 0 });
      const couponHealthAssessment = assessCouponHealth(couponAudit.summary);

      Object.assign(payload, {
        couponHealth: couponAudit.summary,
        couponOps: {
          level: couponHealthAssessment.level,
          signals: couponHealthAssessment.signals,
          generatedAt: couponAudit.generatedAt,
          alerting: {
            enabled:
              String(process.env.COUPON_HEALTH_ALERT_ENABLED ?? "").toLowerCase() ===
              "true",
            minLevel: resolveCouponAlertMinLevel(),
          },
        },
      });
    }

    kpiCache.set(cacheKey, {
      expiresAt: Date.now() + KPI_CACHE_TTL_MS,
      payload,
    });

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
