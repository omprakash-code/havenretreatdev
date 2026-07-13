import { bookingErrorResponse } from "@/lib/booking-api-response";
import { verifySuccessToken } from "@/services/booking/successToken.server";
import { isReviewWorkflowBookingStatus } from "@/lib/booking-status";
import {
  buildBookingSuccessData,
  loadBookingWithSuccessRelations,
} from "@/services/booking/booking-success-data.service";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get("t");

    if (!token) {
      return bookingErrorResponse(
        400,
        "INVALID_TOKEN",
        "Invalid or expired success link"
      );
    }

    const verification = verifySuccessToken(token);
    if (!verification.valid || !verification.payload) {
      return bookingErrorResponse(
        400,
        "INVALID_TOKEN",
        "Invalid or expired success link"
      );
    }

    const { bookingId, bookingRef } = verification.payload;

    const booking = await loadBookingWithSuccessRelations(bookingId);

    // Statuses a success link may show: a submitted request and its outcome,
    // plus legacy CONFIRMED bookings. A draft has no success link.
    const isViewableBooking =
      isReviewWorkflowBookingStatus(booking?.bookingStatus) ||
      booking?.bookingStatus === "CONFIRMED";

    if (!booking || !isViewableBooking || booking.bookingRef !== bookingRef) {
      return bookingErrorResponse(
        404,
        "INVALID_TOKEN",
        "Invalid or expired success link"
      );
    }

    const built = await buildBookingSuccessData(booking);

    if (!built) {
      return bookingErrorResponse(
        404,
        "BOOKING_NOT_FOUND",
        "Booking schedule details not found."
      );
    }

    if (
      built.successTokenExpiresAt &&
      Date.now() > built.successTokenExpiresAt.getTime()
    ) {
      return bookingErrorResponse(
        410,
        "TOKEN_EXPIRED",
        "This confirmation link has expired. Please check your email for the latest confirmation."
      );
    }

    return Response.json({
      success: true,
      ...built.data,
    });
  } catch (error) {
    console.error("BOOKING_BY_SUCCESS_TOKEN_ERROR", error);
    return bookingErrorResponse(
      500,
      "INTERNAL_ERROR",
      "Failed to load booking confirmation."
    );
  }
}
