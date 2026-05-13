import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { releaseStaleReservedCoupons } from "@/services/coupon/coupon-release.service";
import { isInternalCouponEndpointAuthorized } from "@/app/api/internal/coupon/_auth";

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

    const result = await releaseStaleReservedCoupons();
    const bookings = result.affectedBookings.length
      ? await prisma.booking.findMany({
          where: {
            id: {
              in: result.affectedBookings,
            },
          },
          select: {
            id: true,
            bookingRef: true,
          },
        })
      : [];

    return NextResponse.json({
      success: true,
      releasedCount: result.releasedCount,
      affectedBookings: bookings.map((booking) => booking.bookingRef),
      affectedBookingIds: result.affectedBookings,
    });
  } catch (error) {
    console.error("INTERNAL_COUPON_SWEEP_ERROR", error);
    return NextResponse.json(
      {
        success: false,
        code: "INTERNAL_ERROR",
        message: "Failed to sweep stale reserved coupons.",
      },
      { status: 500 }
    );
  }
}
