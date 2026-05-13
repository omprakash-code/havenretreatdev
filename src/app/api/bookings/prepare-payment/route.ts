// src/app/api/bookings/prepare-payment/route.ts

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  AdvancePaymentConfigError,
  getRequiredAdvancePaymentAmount,
} from "@/lib/advance-payment";
import { bookingErrorResponse } from "@/lib/booking-api-response";
import { createSuccessToken } from "@/services/booking/successToken.server";
import {
  expireBookingLockSession,
  isStrictLockExpired,
} from "@/services/booking/booking-lock-lifecycle.service";
import { RESERVATION_TIMED_OUT_MESSAGE } from "@/lib/booking-session-expiry";
import { notifyAbandonedBookingsByIds } from "@/services/booking/booking-abandonment-email.service";

export async function POST(req: Request) {
  try {
    const { bookingId } = await req.json();

    if (!bookingId) {
      return bookingErrorResponse(
        400,
        "INVALID_REQUEST",
        "bookingId is required."
      );
    }

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { slot: true },
    });

    if (!booking) {
      return bookingErrorResponse(
        404,
        "BOOKING_NOT_FOUND",
        "Booking not found."
      );
    }

    const now = new Date();
    if (isStrictLockExpired(booking, now)) {
      const expireResult = await expireBookingLockSession(prisma, {
        bookingId: booking.id,
        slotId: booking.slotId,
        now,
        cancelledReason: "SESSION_EXPIRED",
      });
      if (expireResult.abandonedBookingIds.length > 0) {
        try {
          await notifyAbandonedBookingsByIds(expireResult.abandonedBookingIds);
        } catch (notifyError) {
          console.error("PREPARE_PAYMENT_ABANDONMENT_NOTIFY_FAILED", notifyError);
        }
      }

      return bookingErrorResponse(
        409,
        "SESSION_EXPIRED",
        RESERVATION_TIMED_OUT_MESSAGE
      );
    }

    if (booking.bookingStatus === "CONFIRMED") {
      return bookingErrorResponse(
        409,
        "BOOKING_FINALIZED",
        "This booking is already confirmed.",
        {
          bookingRef: booking.bookingRef,
          successToken: createSuccessToken(
            booking.id,
            booking.bookingRef
          ),
        }
      );
    }

    if (!booking.slot || booking.slot.status !== "LOCKED") {
      return bookingErrorResponse(
        409,
        "SLOT_EXPIRED",
        "Reservation expired, please choose a slot again.",
        { slotStatus: booking.slot?.status ?? null }
      );
    }

    // User can re-open payment while processing.
    if (
      booking.bookingStatus !== "AWAITING_PAYMENT" &&
      booking.bookingStatus !== "PAYMENT_PROCESSING"
    ) {
      return bookingErrorResponse(
        409,
        "BOOKING_INVALID_STATE",
        "Booking is not ready for payment."
      );
    }

    if (!booking.termsAcceptedAt) {
      return bookingErrorResponse(
        409,
        "BOOKING_INVALID_STATE",
        "Please accept terms before payment."
      );
    }

    if (booking.totalAmount <= 0) {
      return bookingErrorResponse(
        409,
        "BOOKING_INVALID_STATE",
        "Invalid booking amount."
      );
    }

    const configuredAdvance = await getRequiredAdvancePaymentAmount(prisma);
    const resolvedAdvancePayable =
      booking.advancePaid && booking.advancePaid > 0
        ? booking.advancePaid
        : configuredAdvance;

    return NextResponse.json({
      success: true,
      message: "Booking ready for payment",
      bookingStatus: booking.bookingStatus,
      paymentStatus: booking.paymentStatus,
      slotStatus: booking.slot?.status ?? null,
      advancePayable: resolvedAdvancePayable,
      totalAmount: booking.totalAmount,
      remainingPayable: Math.max(booking.totalAmount - resolvedAdvancePayable, 0),
    });
  } catch (error) {
    console.error("PREPARE PAYMENT ERROR:", error);

    if (error instanceof AdvancePaymentConfigError) {
      return bookingErrorResponse(
        500,
        "CONFIG_MISSING",
        error.message
      );
    }

    return bookingErrorResponse(
      500,
      "INTERNAL_ERROR",
      "Failed to prepare payment."
    );
  }
}
