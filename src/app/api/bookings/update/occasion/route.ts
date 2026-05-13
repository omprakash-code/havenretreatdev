// src/app/api/bookings/update/occasion/route.ts
// Updates selected occasion + dynamic occasion form data for a booking
// Used by Occasion step only

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
    const body = await req.json();

    const {
      bookingId,
      occasionKey,   // e.g. "BIRTHDAY"
      occasionData,  // e.g. { name: "Rahul" }
    } = body;

    /* -----------------------------
       Basic validation
    ------------------------------ */
    if (!bookingId || !occasionKey) {
      return bookingErrorResponse(
        400,
        "INVALID_REQUEST",
        "Missing required fields."
      );
    }

    /* -----------------------------
       Validate occasion from DB
       (never trust frontend labels)
    ------------------------------ */
    const occasion = await prisma.occasion.findFirst({
      where: {
        key: occasionKey,
        isActive: true,
      },
    });

    if (!occasion) {
      return bookingErrorResponse(
        400,
        "INVALID_REQUEST",
        "Invalid occasion selected."
      );
    }

    /* -----------------------------
       Validate booking
    ------------------------------ */
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: {
        id: true,
        bookingStatus: true,
        bookingRef: true,
        slot: {
          select: {
            status: true,
          },
        },
      },
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


    /* -----------------------------
       Update booking with occasion
    ------------------------------ */
    await prisma.booking.update({
      where: { id: bookingId },
      data: {
        occasionKey: occasion.key,
        occasionLabel: occasion.label,
        occasionData: typeof occasionData === "object" ? occasionData : {}
      },
    });

    return NextResponse.json({
      success: true,
      message: "Occasion updated successfully",
    });
  } catch (error) {
    console.error("BOOKING OCCASION UPDATE ERROR:", error);

    return bookingErrorResponse(
      500,
      "INTERNAL_ERROR",
      "Failed to update occasion."
    );
  }
}
