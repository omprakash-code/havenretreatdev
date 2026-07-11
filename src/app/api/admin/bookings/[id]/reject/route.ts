import { NextResponse } from "next/server";

import { bookingErrorResponse } from "@/lib/booking-api-response";
import { getAuthenticatedAdminIdFromCookies } from "@/services/auth/adminAuth.server";
import {
  BookingReviewError,
  rejectBooking,
} from "@/services/booking/booking-review.service";
import { sendBookingRejectedEmail } from "@/services/booking/booking-review-email.service";

/**
 * Rejects a booking request. A reason is mandatory and may be shared with the
 * customer. Rejection releases the reserved range and the coupon reservations.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const adminId = await getAuthenticatedAdminIdFromCookies();
    if (!adminId) {
      return bookingErrorResponse(401, "UNAUTHORIZED", "Unauthorized");
    }

    const { id } = await params;
    if (!id) {
      return bookingErrorResponse(400, "INVALID_REQUEST", "Booking id is required.");
    }

    const body = (await req.json().catch(() => null)) as {
      reason?: string;
    } | null;

    const result = await rejectBooking({
      bookingId: id,
      adminId,
      reason: body?.reason ?? "",
    });

    if (!result.alreadyDecided) {
      await sendBookingRejectedEmail(result.bookingId);
    }

    return NextResponse.json({
      success: true,
      bookingId: result.bookingId,
      bookingRef: result.bookingRef,
      bookingStatus: result.bookingStatus,
      bookingStatusLabel: "Rejected",
      alreadyDecided: result.alreadyDecided,
    });
  } catch (error) {
    if (error instanceof BookingReviewError) {
      return bookingErrorResponse(
        error.status,
        error.code,
        error.message,
        error.details
      );
    }
    console.error("ADMIN_BOOKING_REJECT_ERROR", error);
    return bookingErrorResponse(
      500,
      "INTERNAL_ERROR",
      "Unable to reject this booking right now."
    );
  }
}
