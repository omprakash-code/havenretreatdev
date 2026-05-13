import { NextResponse } from "next/server";

import { isInternalCouponEndpointAuthorized } from "@/app/api/internal/coupon/_auth";
import { reconcileCouponDiscountMismatches } from "@/services/coupon/coupon-reconcile.service";

type ReconcileRequestBody = {
  dryRun?: boolean;
  includeConfirmed?: boolean;
  bookingIds?: string[];
  limit?: number;
};

export async function POST(req: Request) {
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

    const body = (await req.json().catch(() => null)) as ReconcileRequestBody | null;

    const result = await reconcileCouponDiscountMismatches({
      dryRun: body?.dryRun ?? true,
      includeConfirmed: body?.includeConfirmed ?? false,
      bookingIds: body?.bookingIds,
      limit: body?.limit,
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("INTERNAL_COUPON_RECONCILE_ERROR", error);
    return NextResponse.json(
      {
        success: false,
        code: "INTERNAL_ERROR",
        message: "Failed to reconcile coupon discount mismatches.",
      },
      { status: 500 }
    );
  }
}
