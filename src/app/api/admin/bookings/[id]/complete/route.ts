import { NextResponse } from "next/server";

import { bookingErrorResponse } from "@/lib/booking-api-response";
import { getAuthenticatedAdminIdFromCookies } from "@/services/auth/adminAuth.server";
import {
  BookingReviewError,
  completeBooking,
} from "@/services/booking/booking-review.service";

/**
 * Marks an approved booking COMPLETED once its event has ended. Completion is
 * a lifecycle transition only — payment, stock, and coupons are untouched.
 */
export async function POST(
  _req: Request,
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

    const result = await completeBooking({
      bookingId: id,
      adminId,
    });

    return NextResponse.json({
      success: true,
      bookingId: result.bookingId,
      bookingRef: result.bookingRef,
      bookingStatus: result.bookingStatus,
      bookingStatusLabel: "Completed",
      alreadyCompleted: result.alreadyCompleted,
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
    console.error("ADMIN_BOOKING_COMPLETE_ERROR", error);
    return bookingErrorResponse(
      500,
      "INTERNAL_ERROR",
      "Unable to complete this booking right now."
    );
  }
}
