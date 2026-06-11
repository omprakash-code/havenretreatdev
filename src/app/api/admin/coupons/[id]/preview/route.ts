// src/app/api/admin/coupons/[id]/preview/route.ts

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { toUiCouponScope } from "@/lib/coupon-scope";
import { getAuthenticatedAdminIdFromCookies } from "@/services/auth/adminAuth.server";
import {
  AdminBookingApiError,
  getRequiredAdminAdvanceAmount,
} from "@/app/api/admin/bookings/_shared";
import { previewAdminCoupon } from "@/app/api/admin/bookings/_coupon";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const adminId = await getAuthenticatedAdminIdFromCookies();
    if (!adminId) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const { id: couponId } = await params;

    const {
      userId,
      userPhone,
      items = [],
      extrasAmount = 0,
      slotAmount: bodySlotAmount = 0,
      venueId: bodyVenueId = "",
      locationId: bodyLocationId = "",
      decorationRequired = false,
      bookingSchedule,
    } = await req.json();

    if (!couponId) {
      return NextResponse.json(
        { success: false, message: "Missing couponId" },
        { status: 400 }
      );
    }

    /* ---------------------------------
       Fetch coupon + rules
    ---------------------------------- */
    const rawCoupon = await prisma.coupon.findUnique({
      where: { id: couponId },
      include: { rules: true },
    });

    if (!rawCoupon) {
      return NextResponse.json(
        { success: false, message: "Coupon not found" },
        { status: 404 }
      );
    }

    const productsTotal = items.reduce(
      (sum: number, i: { totalPrice: number }) => sum + i.totalPrice,
      0
    );
    const slotAmount = Math.max(Number(bodySlotAmount ?? 0), 0);
    const nonSlotAmount = extrasAmount + productsTotal;
    const minAdvanceAmount = await getRequiredAdminAdvanceAmount(prisma);
    if (
      !bookingSchedule?.eventDate ||
      !bookingSchedule?.eventStartTime ||
      !bookingSchedule?.eventEndTime
    ) {
      return NextResponse.json(
        { success: false, message: "Booking schedule is required for preview." },
        { status: 400 }
      );
    }
    const result = await previewAdminCoupon(prisma, {
      rawCoupon,
      couponCode: rawCoupon.code,
      bookingSchedule: {
        eventDate: new Date(bookingSchedule.eventDate),
        eventStartTime: String(bookingSchedule.eventStartTime),
        eventEndTime: String(bookingSchedule.eventEndTime),
      },
      venueId: bodyVenueId ? String(bodyVenueId) : "",
      locationId: bodyLocationId ? String(bodyLocationId) : "",
      userId: userId ? String(userId) : null,
      userPhone: userPhone ? String(userPhone) : null,
      decorationRequired: Boolean(decorationRequired),
      items,
      bookingSubtotal: slotAmount + nonSlotAmount,
      slotAmount,
      nonSlotAmount,
      productsTotal,
      extrasTotal: extrasAmount,
      advanceFloor: minAdvanceAmount,
    });

    return NextResponse.json(
      result.valid
        ? {
            valid: true,
            scope: toUiCouponScope(result.scope),
            bookingTotal: result.bookingTotal,
            discountAmount: result.discountAmount,
            finalPayable: result.finalPayable,
            debug: result.debug,
          }
        : result
    );
  } catch (error) {
    if (error instanceof AdminBookingApiError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status }
      );
    }

    console.error("[ADMIN_COUPON_PREVIEW]", error);
    return NextResponse.json(
      { success: false, message: "Preview failed" },
      { status: 500 }
    );
  }
}
