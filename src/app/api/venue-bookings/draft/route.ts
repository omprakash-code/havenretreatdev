import { cookies } from "next/headers";
import { bookingErrorResponse } from "@/lib/booking-api-response";
import {
  createVenueBookingSessionToken,
  getVenueBookingSessionCookieOptions,
  VENUE_BOOKING_SESSION_COOKIE,
  verifyVenueBookingSessionToken,
} from "@/services/venue-booking/venue-booking-session.server";
import { createVenueBookingDraft } from "@/services/venue-booking/venue-booking.service";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      bookingId,
      venueId,
      packageId,
      eventDate,
      eventStartTime,
      eventEndTime,
      guestCount,
      specialInstructions,
      contact,
    } = body;

    if (
      !venueId ||
      !packageId ||
      !eventDate ||
      !eventStartTime ||
      !eventEndTime ||
      guestCount == null ||
      !contact?.fullName ||
      !contact?.email ||
      !contact?.phone
    ) {
      return bookingErrorResponse(
        400,
        "INVALID_REQUEST",
        "Missing required booking draft fields."
      );
    }

    const cookieStore = await cookies();
    if (bookingId) {
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
    }

    const result = await createVenueBookingDraft({
      bookingId: bookingId || undefined,
      venueId,
      packageId,
      eventDate,
      eventStartTime,
      eventEndTime,
      guestCount: Number(guestCount),
      specialInstructions,
      contact: {
        fullName: contact.fullName,
        email: contact.email,
        phone: contact.phone,
      },
    });

    const sessionToken = createVenueBookingSessionToken(
      result.draft.bookingId,
      result.sessionOwner
    );
    cookieStore.set(
      VENUE_BOOKING_SESSION_COOKIE,
      sessionToken,
      getVenueBookingSessionCookieOptions()
    );

    return Response.json({
      success: true,
      data: {
        draft: result.draft,
      },
    });
  } catch (error) {
    const code = error instanceof Error ? error.message : "INTERNAL_ERROR";

    if (code === "PACKAGE_NOT_FOUND") {
      return bookingErrorResponse(404, code, "Selected package was not found.");
    }
    if (code === "INVALID_GUEST_COUNT") {
      return bookingErrorResponse(
        400,
        code,
        "Guest count is outside the selected package limit."
      );
    }
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

    console.error("VENUE_BOOKING_DRAFT_ERROR", error);
    return bookingErrorResponse(
      500,
      "INTERNAL_ERROR",
      "Failed to save venue booking draft."
    );
  }
}
