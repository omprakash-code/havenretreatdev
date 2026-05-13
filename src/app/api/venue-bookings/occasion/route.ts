import { cookies } from "next/headers";
import { bookingErrorResponse } from "@/lib/booking-api-response";
import {
  VENUE_BOOKING_SESSION_COOKIE,
  verifyVenueBookingSessionToken,
} from "@/services/venue-booking/venue-booking-session.server";
import { attachVenueOccasion } from "@/services/venue-booking/venue-booking.service";

export async function POST(req: Request) {
  try {
    const { bookingId, occasionKey, occasionData } = await req.json();

    if (!bookingId || !occasionKey) {
      return bookingErrorResponse(
        400,
        "INVALID_REQUEST",
        "bookingId and occasionKey are required."
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

    const draft = await attachVenueOccasion({
      bookingId,
      occasionKey,
      occasionData:
        typeof occasionData === "object" && occasionData
          ? occasionData
          : {},
    });

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
    if (code === "BOOKING_FINALIZED") {
      return bookingErrorResponse(409, code, "This booking is already confirmed.");
    }
    if (code === "BOOKING_INVALID_STATE" || code === "BOOKING_INVALID_DETAILS") {
      return bookingErrorResponse(
        409,
        "SESSION_EXPIRED",
        "Venue booking draft is no longer editable."
      );
    }
    if (code === "INVALID_OCCASION") {
      return bookingErrorResponse(400, code, "Selected occasion is invalid.");
    }

    console.error("VENUE_BOOKING_OCCASION_ERROR", error);
    return bookingErrorResponse(
      500,
      "INTERNAL_ERROR",
      "Failed to save venue occasion."
    );
  }
}
