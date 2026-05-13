import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  buildMinimumPayableMessage,
} from "@/services/coupon/coupon-minimum-payable";
import {
  buildBookingCouponContext,
  BookingCouponMinimumPayableError,
  rebalanceReservedBookingCoupons,
  resolveBookingCouponUserId,
} from "@/services/coupon/booking-coupon.service";
import { getRequiredAdvancePaymentAmount } from "@/lib/advance-payment";
import { bookingErrorResponse } from "@/lib/booking-api-response";
import { BOOKING_SESSION_EXPIRED_MODAL_MESSAGE } from "@/lib/booking-session-expiry";
import { getCouponDisplayCode } from "@/lib/coupon-display";

function isEditableBookingStatus(status: string) {
  return (
    status === "INCOMPLETE" ||
    status === "AWAITING_PAYMENT" ||
    status === "PAYMENT_PROCESSING"
  );
}

export async function POST(req: Request) {
  let minimumPayableForError = 0;
  try {
    const body = (await req
      .json()
      .catch(() => null)) as
      | {
          bookingId?: string;
          couponId?: string;
        }
      | null;
    const bookingId = body?.bookingId;
    const couponId = body?.couponId;

    if (!bookingId || !couponId) {
      return bookingErrorResponse(
        400,
        "INVALID_REQUEST",
        "Missing coupon removal payload."
      );
    }

    const { totalDiscount, appliedCoupons } = await prisma.$transaction(async tx => {
      // 1. Fetch booking snapshot and guard finalized states first
      const booking = await tx.booking.findUnique({
        where: { id: bookingId },
        include: {
          slot: true,
          theatre: true,
          items: true,
        },
      });

      if (!booking) throw new Error("BOOKING_NOT_FOUND");
      if (booking.bookingStatus === "CONFIRMED") {
        throw new Error("BOOKING_FINALIZED");
      }
      if (!isEditableBookingStatus(booking.bookingStatus)) {
        throw new Error("BOOKING_INVALID_STATE");
      }
      if (!booking.slot || booking.slot.status !== "LOCKED") {
        throw new Error("SLOT_EXPIRED");
      }

      const resolvedUserId = await resolveBookingCouponUserId(tx, {
        userId: booking.userId,
        contactPhone: booking.contactPhone,
      });

      // 2. Release coupon
      await tx.couponUsage.updateMany({
        where: {
          bookingId,
          couponId,
          status: "RESERVED",
        },
        data: {
          status: "RELEASED",
          discountAmount: 0,
          releasedAt: new Date(),
          confirmedAt: null,
        },
      });

      // 3. Build evaluation context
      const contextItems = booking.items.map(i => ({
        itemKey: i.id,
        productId: i.productId,
        category: i.category,
        totalPrice: i.totalPrice,
      }));
      const productsTotal = contextItems.reduce(
        (sum, item) => sum + Math.max(Number(item.totalPrice ?? 0), 0),
        0
      );
      const slotAmount =
        booking.baseAmount;
      const nonSlotAmount =
        booking.extrasAmount +
        booking.decorationAmount +
        productsTotal;
      const context = buildBookingCouponContext({
        slot: {
          id: booking.slot.id,
          date: booking.slot.date,
          startTime: booking.slot.startTime,
          endTime: booking.slot.endTime,
          durationMin: booking.slot.durationMin,
        },
        theatreId: booking.theatreId,
        locationId: booking.theatre.locationId,
        userId: resolvedUserId,
        contactPhone: booking.contactPhone,
        decorationRequired: booking.decorationRequired,
        items: contextItems,
        slotAmount,
        nonSlotAmount,
        productsTotal,
        extrasTotal: booking.extrasAmount,
      });

      const advanceFloor = await getRequiredAdvancePaymentAmount(tx);
      minimumPayableForError = advanceFloor;
      const { totalDiscount, appliedCoupons } =
        await rebalanceReservedBookingCoupons({
          tx,
          bookingId,
          context,
          resolvedUserId,
          minimumPayable: advanceFloor,
        });

      const newTotal = context.amounts.bookingTotal - totalDiscount;

      // 6. Update booking totals
      await tx.booking.update({
        where: { id: bookingId },
        data: {
          discountAmount: totalDiscount,
          totalAmount: newTotal,
          remainingPayable: Math.max(newTotal - booking.advancePaid, 0),
          ...(booking.bookingStatus === "AWAITING_PAYMENT" ||
            booking.bookingStatus === "PAYMENT_PROCESSING"
            ? {
              bookingStatus: "AWAITING_PAYMENT" as const,
              paymentStatus: "INITIALIZED" as const,
              razorpayOrderId: null,
              razorpayPaymentId: null,
              razorpaySignature: null,
            }
            : {}),
        },
      });

      return {
        totalDiscount,
        appliedCoupons,
      };
    });

    return NextResponse.json({
      success: true,
      discountAmount: totalDiscount,
      appliedCoupons: appliedCoupons.map((coupon) => ({
        ...coupon,
        code: getCouponDisplayCode(coupon.code),
      })),
    });
  } catch (err) {
    if (err instanceof Error && err.message === "BOOKING_NOT_FOUND") {
      return bookingErrorResponse(404, "BOOKING_NOT_FOUND", "Booking not found.");
    }
    if (err instanceof Error && err.message === "BOOKING_FINALIZED") {
      return bookingErrorResponse(
        409,
        "BOOKING_FINALIZED",
        "This booking is already confirmed."
      );
    }
    if (err instanceof Error && err.message === "BOOKING_INVALID_STATE") {
      return bookingErrorResponse(
        409,
        "SESSION_EXPIRED",
        BOOKING_SESSION_EXPIRED_MODAL_MESSAGE
      );
    }
    if (err instanceof Error && err.message === "SLOT_EXPIRED") {
      return bookingErrorResponse(
        409,
        "SLOT_EXPIRED",
        "Selected slot has expired. Please choose a slot again."
      );
    }
    if (
      (err instanceof Error && err.message === "COUPON_MINIMUM_PAYABLE_NOT_MET") ||
      err instanceof BookingCouponMinimumPayableError
    ) {
      return bookingErrorResponse(
        409,
        "COUPON_NOT_APPLICABLE",
        buildMinimumPayableMessage(minimumPayableForError),
        {
          severity: "info",
        }
      );
    }

    console.error("[REMOVE COUPON]", err);

    return bookingErrorResponse(
      500,
      "INTERNAL_ERROR",
      "Failed to remove coupon."
    );
  }
}
