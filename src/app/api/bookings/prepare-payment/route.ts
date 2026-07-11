// src/app/api/bookings/prepare-payment/route.ts

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  AdvancePaymentConfigError,
  getRequiredAdvancePaymentAmount,
} from "@/lib/advance-payment";
import { bookingErrorResponse } from "@/lib/booking-api-response";
import {
  PAYMENTS_DISABLED_CODE,
  PAYMENTS_DISABLED_MESSAGE,
  isPublicBookingPaymentsEnabled,
} from "@/lib/booking-feature-flags";
import { createSuccessToken } from "@/services/booking/successToken.server";
import { getRangeBookingApiIdentity } from "@/services/booking/range-booking-api-session";
import {
  RangeBookingSessionError,
  requireActiveRangeBookingSession,
} from "@/services/booking/range-booking-session.service";

export async function POST(req: Request) {
  try {
    // Public booking no longer collects payment. The route stays in place for
    // future provider work and returns a clear error while payments are off.
    if (!isPublicBookingPaymentsEnabled()) {
      return bookingErrorResponse(
        503,
        PAYMENTS_DISABLED_CODE,
        PAYMENTS_DISABLED_MESSAGE
      );
    }

    const { bookingId } = await req.json();

    if (!bookingId) {
      return bookingErrorResponse(
        400,
        "INVALID_REQUEST",
        "bookingId is required."
      );
    }

    const rangeIdentity = await getRangeBookingApiIdentity(bookingId);
    if (rangeIdentity) {
      const { booking } =
        await requireActiveRangeBookingSession(rangeIdentity);
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
      if (!booking.termsAcceptedAt || booking.totalAmount <= 0) {
        return bookingErrorResponse(
          409,
          "BOOKING_INVALID_STATE",
          "Booking agreement or amount is incomplete."
        );
      }

      const configuredAdvance =
        await getRequiredAdvancePaymentAmount(prisma);
      const advancePayable =
        booking.advancePaid > 0 ? booking.advancePaid : configuredAdvance;
      return NextResponse.json({
        success: true,
        message: "Range booking ready for payment provider migration",
        bookingStatus: booking.bookingStatus,
        paymentStatus: booking.paymentStatus,
        lockVersion: booking.lockVersion,
        lockExpiresAt: booking.holdExpiresAt,
        advancePayable,
        totalAmount: booking.totalAmount,
        remainingPayable: Math.max(
          booking.totalAmount - advancePayable,
          0
        ),
        paymentProviderReady: false,
      });
    }

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
    });

    if (!booking) {
      return bookingErrorResponse(
        404,
        "BOOKING_NOT_FOUND",
        "Booking not found."
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
      slotStatus: null,
      advancePayable: resolvedAdvancePayable,
      totalAmount: booking.totalAmount,
      remainingPayable: Math.max(booking.totalAmount - resolvedAdvancePayable, 0),
    });
  } catch (error) {
    if (error instanceof RangeBookingSessionError) {
      return bookingErrorResponse(
        error.code === "BOOKING_NOT_FOUND" ? 404 : 409,
        error.code,
        error.message
      );
    }
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
