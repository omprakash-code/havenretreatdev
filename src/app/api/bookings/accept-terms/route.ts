// src/app/api/bookings/accept-terms/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { bookingErrorResponse } from "@/lib/booking-api-response";
import { BOOKING_SESSION_EXPIRED_MODAL_MESSAGE } from "@/lib/booking-session-expiry";

function isEditableBookingStatus(status: string) {
  return (
    status === "INCOMPLETE" ||
    status === "AWAITING_PAYMENT" ||
    status === "PAYMENT_PROCESSING"
  );
}

export async function POST(req: Request) {
  try {
    const body = (await req
      .json()
      .catch(() => null)) as { bookingId?: string } | null;
    const bookingId = body?.bookingId;

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

    if (booking.bookingStatus === "CONFIRMED") {
      return bookingErrorResponse(
        409,
        "BOOKING_FINALIZED",
        "This booking is already confirmed.",
        { bookingRef: booking.bookingRef }
      );
    }

    if (!isEditableBookingStatus(booking.bookingStatus)) {
      return bookingErrorResponse(
        409,
        "SESSION_EXPIRED",
        BOOKING_SESSION_EXPIRED_MODAL_MESSAGE
      );
    }

    if (!booking.slot || booking.slot.status !== "LOCKED") {
      return bookingErrorResponse(
        409,
        "SLOT_EXPIRED",
        "Selected slot has expired. Please choose a slot again."
      );
    }

    await prisma.booking.update({
      where: { id: bookingId },
      data: {
        termsAcceptedAt: booking.termsAcceptedAt ?? new Date(),
        bookingStatus: "AWAITING_PAYMENT",
        paymentStatus: "INITIALIZED",
        razorpayOrderId: null,
        razorpayPaymentId: null,
        razorpaySignature: null,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("ACCEPT_TERMS_ERROR:", error);
    return bookingErrorResponse(
      500,
      "INTERNAL_ERROR",
      "Unable to accept terms right now."
    );
  }
}
