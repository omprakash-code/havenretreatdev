import { cookies } from "next/headers";
import { bookingErrorResponse } from "@/lib/booking-api-response";
import {
  VENUE_BOOKING_SESSION_COOKIE,
  verifyVenueBookingSessionToken,
} from "@/services/venue-booking/venue-booking-session.server";
import { attachVenueAddons } from "@/services/venue-booking/venue-booking.service";

export async function POST(req: Request) {
  try {
    const { bookingId, selectedAddons } = await req.json();

    if (!bookingId || !Array.isArray(selectedAddons)) {
      return bookingErrorResponse(
        400,
        "INVALID_REQUEST",
        "bookingId and selectedAddons are required."
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

    const draft = await attachVenueAddons({
      bookingId,
      selectedAddons,
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
    if (code === "PACKAGE_NOT_FOUND" || code === "INVALID_ADDON_SELECTION") {
      return bookingErrorResponse(
        400,
        code,
        "One or more selected add-ons are invalid for this package."
      );
    }

    console.error("VENUE_BOOKING_ADDONS_ERROR", error);
    return bookingErrorResponse(
      500,
      "INTERNAL_ERROR",
      "Failed to save venue add-ons."
    );
  }
}
