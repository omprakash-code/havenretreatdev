import { cookies } from "next/headers";
import { bookingErrorResponse } from "@/lib/booking-api-response";
import {
  VENUE_BOOKING_SESSION_COOKIE,
  verifyVenueBookingSessionToken,
} from "@/services/venue-booking/venue-booking-session.server";
import { prepareVenuePayment } from "@/services/venue-booking/venue-booking.service";

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

    const cookieStore = await cookies();
    const sessionToken =
      cookieStore.get(VENUE_BOOKING_SESSION_COOKIE)?.value ?? null;
    const payload = sessionToken
      ? verifyVenueBookingSessionToken(sessionToken)
      : null;

    if (!payload || payload.bookingId !== bookingId) {
      return bookingErrorResponse(
        401,
        "SESSION_EXPIRED",
        "Venue booking session expired. Please restart the flow."
      );
    }

    const result = await prepareVenuePayment(bookingId);
    return Response.json({
      success: true,
      data: result,
    });
  } catch (error) {
    const code = error instanceof Error ? error.message : "INTERNAL_ERROR";

    if (code === "BOOKING_NOT_FOUND") {
      return bookingErrorResponse(404, code, "Booking draft not found.");
    }
    if (code === "BOOKING_FINALIZED") {
      return bookingErrorResponse(409, code, "This booking is already confirmed.");
    }
    if (code === "BOOKING_INVALID_STATE") {
      return bookingErrorResponse(
        409,
        code,
        "Venue booking is not ready for payment."
      );
    }
    if (code === "AGREEMENT_PENDING") {
      return bookingErrorResponse(
        409,
        code,
        "Please complete agreement signing before payment."
      );
    }
    if (code === "BOOKING_INVALID_AMOUNT") {
      return bookingErrorResponse(
        409,
        code,
        "Venue booking amount is invalid."
      );
    }

    console.error("VENUE_BOOKING_PREPARE_PAYMENT_ERROR", error);
    return bookingErrorResponse(
      500,
      "INTERNAL_ERROR",
      "Failed to prepare venue booking for payment."
    );
  }
}
