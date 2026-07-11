import { NextResponse } from "next/server";

import { bookingErrorResponse } from "@/lib/booking-api-response";
import { APPROVAL_NOTES_MAX_LENGTH } from "@/lib/booking-status";
import { getAuthenticatedAdminIdFromCookies } from "@/services/auth/adminAuth.server";
import {
  BookingReviewError,
  approveBooking,
} from "@/services/booking/booking-review.service";
import { sendBookingApprovedEmail } from "@/services/booking/booking-review-email.service";

/**
 * Approves a booking request. Approval never records a payment: an approved
 * booking may be unpaid, and payment is recorded through the existing admin
 * payment flow.
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
      approvalNotes?: string;
    } | null;

    const approvalNotes = body?.approvalNotes?.trim() ?? "";
    if (approvalNotes.length > APPROVAL_NOTES_MAX_LENGTH) {
      return bookingErrorResponse(
        400,
        "INVALID_REQUEST",
        `Approval notes must be ${APPROVAL_NOTES_MAX_LENGTH} characters or fewer.`
      );
    }

    const result = await approveBooking({
      bookingId: id,
      adminId,
      approvalNotes: approvalNotes || null,
    });

    if (!result.alreadyDecided) {
      await sendBookingApprovedEmail(result.bookingId);
    }

    return NextResponse.json({
      success: true,
      bookingId: result.bookingId,
      bookingRef: result.bookingRef,
      bookingStatus: result.bookingStatus,
      bookingStatusLabel: "Approved",
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
    console.error("ADMIN_BOOKING_APPROVE_ERROR", error);
    return bookingErrorResponse(
      500,
      "INTERNAL_ERROR",
      "Unable to approve this booking right now."
    );
  }
}
