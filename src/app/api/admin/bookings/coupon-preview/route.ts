import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  AdminBookingApiError,
  getRequiredAdminAdvanceAmount,
} from "@/app/api/admin/bookings/_shared";
import { evaluateAdminCoupons } from "@/app/api/admin/bookings/_coupon";
import { getAuthenticatedAdminIdFromCookies } from "@/services/auth/adminAuth.server";

type CouponPreviewPayload = {
  couponCode?: string;
  couponCodes?: string[];
  existingCouponCodes?: string[];
  venueId?: string;
  locationId?: string;
  date?: string;
  startTime?: string;
  endTime?: string;
  userId?: string | null;
  userPhone?: string | null;
  decorationRequired?: boolean;
  items?: Array<{
    itemKey?: string;
    productId?: string;
    category?: "CAKE" | "DECORATION" | "GIFT";
    totalPrice?: number;
  }>;
  amounts?: {
    bookingSubtotal?: number;
    bookingTotal?: number;
    slotAmount?: number;
    slotTotal?: number;
    nonSlotAmount?: number;
    productsTotal?: number;
    extrasTotal?: number;
  };
};

export async function POST(req: Request) {
  try {
    const adminId = await getAuthenticatedAdminIdFromCookies();
    if (!adminId) {
      return NextResponse.json(
        { success: false, code: "UNAUTHORIZED", message: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = (await req.json().catch(() => null)) as CouponPreviewPayload | null;
    const nextCouponCodes = Array.isArray(body?.couponCodes)
      ? body!.couponCodes
      : [
          ...(Array.isArray(body?.existingCouponCodes) ? body!.existingCouponCodes : []),
          body?.couponCode ?? "",
        ];

    const slotAmount = Math.max(
      Number(body?.amounts?.slotAmount ?? body?.amounts?.slotTotal ?? 0),
      0
    );
    const productsTotal = Math.max(Number(body?.amounts?.productsTotal ?? 0), 0);
    const extrasTotal = Math.max(Number(body?.amounts?.extrasTotal ?? 0), 0);
    const nonSlotAmount = Math.max(
      Number(body?.amounts?.nonSlotAmount ?? productsTotal + extrasTotal),
      0
    );
    const bookingSubtotal = slotAmount + nonSlotAmount;

    const items = Array.isArray(body?.items)
      ? body.items
          .map((item, index) => ({
            itemKey:
              String(item.itemKey ?? "").trim() ||
              `${String(item.productId ?? "").trim()}:${index}`,
            productId: String(item.productId ?? "").trim(),
            category: item.category,
            totalPrice: Math.max(Number(item.totalPrice ?? 0), 0),
          }))
          .filter(
            (item): item is {
              itemKey: string;
              productId: string;
              category: "CAKE" | "DECORATION" | "GIFT";
              totalPrice: number;
            } =>
              Boolean(item.productId) &&
              (item.category === "CAKE" || item.category === "DECORATION" || item.category === "GIFT")
          )
      : [];

    const minAdvanceAmount = await getRequiredAdminAdvanceAmount(prisma);
    const date = String(body?.date ?? "").trim();
    const startTime = String(body?.startTime ?? "").trim();
    const endTime = String(body?.endTime ?? "").trim();
    if (!date || !startTime || !endTime) {
      return NextResponse.json(
        { success: false, message: "Booking date and time range are required." },
        { status: 400 }
      );
    }

    const result = await prisma.$transaction((tx) =>
      evaluateAdminCoupons(tx, {
        couponCodes: nextCouponCodes,
        bookingSchedule: {
          eventDate: new Date(`${date}T00:00:00`),
          eventStartTime: startTime,
          eventEndTime: endTime,
        },
        venueId: String(body?.venueId ?? ""),
        locationId: String(body?.locationId ?? ""),
        userId: body?.userId ?? null,
        userPhone: body?.userPhone ?? null,
        decorationRequired: Boolean(body?.decorationRequired),
        items,
        bookingSubtotal,
        slotAmount,
        nonSlotAmount,
        productsTotal,
        extrasTotal,
        advanceFloor: minAdvanceAmount,
      })
    );

    return NextResponse.json({
      success: true,
      data: {
        discountAmount: result.totalDiscount,
        finalPayable: Math.max(bookingSubtotal - result.totalDiscount, 0),
        couponDebug: result.debug,
        appliedCoupons: result.coupons.map((coupon) => ({
          couponId: coupon.couponId,
          code: coupon.code,
          discountAmount: coupon.discountAmount,
        })),
      },
    });
  } catch (error) {
    if (error instanceof AdminBookingApiError) {
      return NextResponse.json(
        {
          success: false,
          code: error.code,
          message: error.message,
          ...(error.extra ? { data: error.extra } : {}),
        },
        { status: error.status }
      );
    }

    console.error("ADMIN_BOOKING_COUPON_PREVIEW_ERROR", error);
    return NextResponse.json(
      {
        success: false,
        code: "INTERNAL_ERROR",
        message: "Failed to preview coupon.",
      },
      { status: 500 }
    );
  }
}
