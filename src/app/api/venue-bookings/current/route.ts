import { cookies } from "next/headers";
import { bookingErrorResponse } from "@/lib/booking-api-response";
import {
  VENUE_BOOKING_SESSION_COOKIE,
  verifyVenueBookingSessionToken,
} from "@/services/venue-booking/venue-booking-session.server";
import { getVenueBookingDraft } from "@/services/venue-booking/venue-booking.service";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const sessionToken =
      cookieStore.get(VENUE_BOOKING_SESSION_COOKIE)?.value ?? null;

    if (!sessionToken) {
      return bookingErrorResponse(
        401,
        "SESSION_EXPIRED",
        "Venue booking session not found."
      );
    }

    const payload = verifyVenueBookingSessionToken(sessionToken);
    if (!payload) {
      return bookingErrorResponse(
        401,
        "SESSION_EXPIRED",
        "Venue booking session expired."
      );
    }

    const draft = await getVenueBookingDraft(payload.bookingId);
    return Response.json({
      success: true,
      data: {
        draft,
      },
    });
  } catch (error) {
    const code = error instanceof Error ? error.message : "INTERNAL_ERROR";

    if (code === "BOOKING_NOT_FOUND") {
      return bookingErrorResponse(404, code, "Booking draft not found.");
    }
    if (code === "BOOKING_INVALID_DETAILS") {
      return bookingErrorResponse(
        409,
        "SESSION_EXPIRED",
        "Venue booking draft is incomplete."
      );
    }

    console.error("VENUE_BOOKING_CURRENT_ERROR", error);
    return bookingErrorResponse(
      500,
      "INTERNAL_ERROR",
      "Failed to load current venue booking draft."
    );
  }
}
