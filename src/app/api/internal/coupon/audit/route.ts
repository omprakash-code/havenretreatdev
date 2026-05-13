import { NextResponse } from "next/server";

import { isInternalCouponEndpointAuthorized } from "@/app/api/internal/coupon/_auth";
import { getCouponAuditReport } from "@/services/coupon/coupon-audit.service";

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
    const limitParam = Number(searchParams.get("limit") ?? "50");
    const mismatchLimit = Number.isFinite(limitParam)
      ? Math.min(Math.max(Math.trunc(limitParam), 0), 200)
      : 50;

    const report = await getCouponAuditReport({ mismatchLimit });

    return NextResponse.json({
      success: true,
      data: report,
    });
  } catch (error) {
    console.error("INTERNAL_COUPON_AUDIT_ERROR", error);
    return NextResponse.json(
      {
        success: false,
        code: "INTERNAL_ERROR",
        message: "Failed to generate coupon audit report.",
      },
      { status: 500 }
    );
  }
}
