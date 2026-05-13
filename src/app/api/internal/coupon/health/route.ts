import { NextResponse } from "next/server";

import { isInternalCouponEndpointAuthorized } from "@/app/api/internal/coupon/_auth";
import { getCouponAuditReport } from "@/services/coupon/coupon-audit.service";
import { assessCouponHealth } from "@/services/coupon/coupon-health.service";

export async function GET(req: Request) {
  try {
    const authorized = await isInternalCouponEndpointAuthorized(req);
    if (!authorized) {
      return NextResponse.json(
        {
          success: false,
          code: "UNAUTHORIZED",
          message: "Unauthorized",
        },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const includeMismatches = searchParams.get("includeMismatches") === "true";
    const limitParam = Number(searchParams.get("limit") ?? "25");
    const mismatchLimit = includeMismatches
      ? Number.isFinite(limitParam)
        ? Math.min(Math.max(Math.trunc(limitParam), 0), 200)
        : 25
      : 0;

    const report = await getCouponAuditReport({ mismatchLimit });
    const health = assessCouponHealth(report.summary);

    return NextResponse.json({
      success: true,
      data: {
        level: health.level,
        signals: health.signals,
        summary: report.summary,
        generatedAt: report.generatedAt,
        lockWindowMinutes: report.lockWindowMinutes,
        mismatches: includeMismatches ? report.mismatches : [],
      },
    });
  } catch (error) {
    console.error("INTERNAL_COUPON_HEALTH_ERROR", error);
    return NextResponse.json(
      {
        success: false,
        code: "INTERNAL_ERROR",
        message: "Failed to generate coupon health report.",
      },
      { status: 500 }
    );
  }
}
