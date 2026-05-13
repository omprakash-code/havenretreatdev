import { cookies } from "next/headers";
import { bookingErrorResponse } from "@/lib/booking-api-response";
import {
  VENUE_BOOKING_SESSION_COOKIE,
  verifyVenueBookingSessionToken,
} from "@/services/venue-booking/venue-booking-session.server";
import { attachVenueAgreement } from "@/services/venue-booking/venue-booking.service";

function extractRequestIp(req: Request) {
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() ?? null;
  }

  return req.headers.get("x-real-ip");
}

export async function POST(req: Request) {
  try {
    const { bookingId, signerName, signatureImage } = await req.json();

    if (!bookingId || !signerName || !signatureImage) {
      return bookingErrorResponse(
        400,
        "INVALID_REQUEST",
        "bookingId, signerName, and signatureImage are required."
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

    const draft = await attachVenueAgreement({
      bookingId,
      signerName,
      signatureImage,
      ipAddress: extractRequestIp(req),
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
    if (code === "AGREEMENT_TEMPLATE_NOT_FOUND") {
      return bookingErrorResponse(
        409,
        code,
        "No active agreement template is available yet."
      );
    }
    if (code === "CONTACT_EMAIL_REQUIRED") {
      return bookingErrorResponse(
        409,
        code,
        "Contact email is required before signing the agreement."
      );
    }
    if (code === "SIGNATURE_REQUIRED") {
      return bookingErrorResponse(
        400,
        code,
        "Typed signer name and signature are required."
      );
    }

    console.error("VENUE_BOOKING_AGREEMENT_ERROR", error);
    return bookingErrorResponse(
      500,
      "INTERNAL_ERROR",
      "Failed to save signed agreement."
    );
  }
}
