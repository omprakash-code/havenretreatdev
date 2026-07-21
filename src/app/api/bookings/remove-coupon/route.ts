import { NextResponse } from "next/server";
import { cookies } from "next/headers";
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
import { centsToMoney, toCents, toMoney } from "@/lib/money";
import { verifyBookingSessionToken } from "@/services/booking/bookingSession.server";
import {
  RangeBookingSessionError,
  requireActiveRangeBookingSession,
} from "@/services/booking/range-booking-session.service";

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

    const cookieStore = await cookies();
    const sessionToken = cookieStore.get("ds_booking_session")?.value ?? null;
    const sessionPayload = sessionToken ? verifyBookingSessionToken(sessionToken) : null;

    const { totalDiscount, appliedCoupons } = await prisma.$transaction(async tx => {
      // 1. Fetch booking snapshot and guard finalized states first
      const booking = await tx.booking.findUnique({
        where: { id: bookingId },
        include: {
          items: true,
        },
      });

      if (!booking) throw new Error("BOOKING_NOT_FOUND");
      if (booking.bookingStatus === "APPROVED") {
        throw new Error("BOOKING_FINALIZED");
      }
      if (!isEditableBookingStatus(booking.bookingStatus)) {
        throw new Error("BOOKING_INVALID_STATE");
      }
      if (
        !sessionPayload ||
        sessionPayload.bookingId !== booking.id ||
        typeof sessionPayload.lockVersion !== "number"
      ) {
        throw new Error("BOOKING_INVALID_STATE");
      }

      try {
        await requireActiveRangeBookingSession(
          {
            bookingId: booking.id,
            lockOwner: sessionPayload.lockOwner,
            lockVersion: sessionPayload.lockVersion,
          },
          new Date(),
          tx
        );
      } catch (error) {
        if (error instanceof RangeBookingSessionError) {
          throw new Error("BOOKING_INVALID_STATE");
        }
        throw error;
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
        totalPrice: toMoney(i.totalPrice),
      }));
      const productsTotal = contextItems.reduce(
        (sum, item) => sum + Math.max(Number(item.totalPrice ?? 0), 0),
        0
      );
      const slotAmount = toMoney(booking.baseAmount);
      const nonSlotAmount = centsToMoney(
        toCents(booking.extrasAmount) +
          toCents(booking.decorationAmount) +
          toCents(productsTotal)
      );
      const context = buildBookingCouponContext({
        bookingSchedule: {
          eventDate: booking.eventDate,
          eventStartTime: booking.eventStartTime,
          eventEndTime: booking.eventEndTime,
          startsAtUtc: booking.startsAtUtc,
          endsAtUtc: booking.endsAtUtc,
        },
        venueId: booking.venueId ?? '',
        locationId: '',
        userId: resolvedUserId,
        contactPhone: booking.contactPhone,
        decorationRequired: booking.decorationRequired,
        items: contextItems,
        slotAmount,
        nonSlotAmount,
        productsTotal,
        extrasTotal: toMoney(booking.extrasAmount),
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

      const newTotal = centsToMoney(
        toCents(context.amounts.bookingTotal) - toCents(totalDiscount)
      );

      // 6. Update booking totals
      await tx.booking.update({
        where: { id: bookingId },
        data: {
          discountAmount: totalDiscount,
          totalAmount: newTotal,
          remainingPayable: centsToMoney(
            Math.max(toCents(newTotal) - toCents(booking.advancePaid), 0)
          ),
          ...(booking.bookingStatus === "AWAITING_PAYMENT" ||
            booking.bookingStatus === "PAYMENT_PROCESSING"
            ? {
              bookingStatus: "AWAITING_PAYMENT" as const,
              paymentStatus: "INITIALIZED" as const,
              paymentProvider: null,
              paymentOrderId: null,
              paymentTransactionId: null,
              paymentSignature: null,
              paymentCheckoutUrl: null,
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
