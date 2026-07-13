// src/app/api/bookings/submit/route.ts
//
// Public booking submission. Signs the agreement and moves the booking to
// PENDING_REVIEW. No payment is created and no payment provider is called.
import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { bookingErrorResponse } from "@/lib/booking-api-response";
import { normalizeAcknowledgedClauses } from "@/lib/agreement-acknowledgments";
import { buildAgreementReference } from "@/lib/agreement-reference";
import { buildHavenAgreementHtmlSnapshot } from "@/lib/agreement-snapshot";
import { buildStoredSignedAgreementPdf } from "@/lib/pdf/stored-signed-agreement";
import { getRangeBookingApiIdentity } from "@/services/booking/range-booking-api-session";
import {
  BookingReviewError,
  submitBookingForReview,
  type BookingReviewErrorCode,
} from "@/services/booking/booking-review.service";
import { RangeBookingSessionError } from "@/services/booking/range-booking-session.service";
import { sendBookingSubmittedEmails } from "@/services/booking/booking-review-email.service";

function extractRequestIp(req: Request) {
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() ?? null;
  }

  return req.headers.get("x-real-ip");
}

/**
 * The review service speaks in workflow terms; the booking client already knows
 * how to recover from these two situations, so reuse its vocabulary.
 */
const CUSTOMER_ERROR_CODES: Partial<Record<BookingReviewErrorCode, string>> = {
  BOOKING_CONFLICT: "SLOT_ALREADY_BOOKED",
  PRODUCT_UNAVAILABLE: "PRODUCT_OUT_OF_STOCK",
};

function scheduleBookingSubmissionFollowup(input: {
  bookingId: string;
  bookingRef: string;
  agreementRef: string;
  signerName: string;
  signerEmail: string;
  signedAt: Date;
  signatureImage: string;
  agreementVersion: string;
  agreementHtmlSnapshot: string;
  acknowledgedClauses: number[];
}) {
  void (async () => {
    try {
      try {
        const storedPdf = await buildStoredSignedAgreementPdf({
          bookingRef: input.bookingRef,
          agreement: {
            id: input.agreementRef,
            signerName: input.signerName,
            signerEmail: input.signerEmail,
            signedAt: input.signedAt.toISOString(),
            signatureImage: input.signatureImage,
            agreementVersion: input.agreementVersion,
            agreementHtmlSnapshot: input.agreementHtmlSnapshot,
            acknowledgedClauses: input.acknowledgedClauses,
            confirmationAccepted: true,
          },
        });

        await prisma.signedAgreement.update({
          where: { agreementRef: input.agreementRef },
          data: {
            pdfGeneratedAt: storedPdf.generatedAt,
            pdfFileName: storedPdf.filename,
            pdfSha256: storedPdf.sha256,
            pdfContent: storedPdf.content,
          },
        });
      } catch (error) {
        console.error("BOOKING_SUBMIT_AGREEMENT_PDF_FAILED", {
          bookingId: input.bookingId,
          bookingRef: input.bookingRef,
          error,
        });
      }

      await sendBookingSubmittedEmails(input.bookingId);
    } catch (error) {
      console.error("BOOKING_SUBMIT_FOLLOWUP_FAILED", {
        bookingId: input.bookingId,
        bookingRef: input.bookingRef,
        error,
      });
    }
  })();
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as {
      bookingId?: string;
      signerName?: string;
      signatureImage?: string;
      confirmationAccepted?: boolean;
      acknowledgedClauses?: unknown;
      agreementVersion?: string;
    } | null;

    const bookingId = body?.bookingId;
    const acknowledgedClauses = normalizeAcknowledgedClauses(
      body?.acknowledgedClauses
    );

    if (
      !bookingId ||
      !body?.signerName ||
      !body?.signatureImage ||
      !body?.confirmationAccepted ||
      !acknowledgedClauses
    ) {
      return bookingErrorResponse(
        400,
        "INVALID_REQUEST",
        "All 33 agreement clauses, signerName, signatureImage, and signature confirmation are required."
      );
    }

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: { id: true, bookingRef: true, contactEmail: true },
    });
    if (!booking) {
      return bookingErrorResponse(
        404,
        "BOOKING_NOT_FOUND",
        "Booking not found."
      );
    }

    const template = await prisma.agreementTemplate.findFirst({
      where: { isActive: true },
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    });
    if (!template) {
      return bookingErrorResponse(
        409,
        "AGREEMENT_TEMPLATE_NOT_FOUND",
        "No active agreement template is available yet."
      );
    }

    const signerName = body.signerName.trim();
    const signedAt = new Date();
    const agreementVersion = body.agreementVersion ?? template.version;
    const agreementRef = buildAgreementReference(booking.bookingRef);
    const agreementHtmlSnapshot = buildHavenAgreementHtmlSnapshot({
      title: template.title,
      version: agreementVersion,
      acknowledgedClauses,
    });

    const result = await submitBookingForReview({
      bookingId,
      identity: await getRangeBookingApiIdentity(bookingId),
      now: signedAt,
      agreement: {
        agreementRef,
        agreementTemplateId: template.id,
        signerName,
        signerEmail: booking.contactEmail ?? "",
        signatureImage: body.signatureImage,
        ipAddress: extractRequestIp(req),
        userAgent: req.headers.get("user-agent"),
        agreementVersion,
        agreementHtmlSnapshot,
        acknowledgedClauses,
      },
    });

    // Slow follow-ups run after the booking is committed. The customer should
    // see success as soon as the slot is safely submitted for review.
    if (!result.alreadySubmitted) {
      scheduleBookingSubmissionFollowup({
        bookingId: result.bookingId,
        bookingRef: result.bookingRef,
        agreementRef,
        signerName,
        signerEmail: booking.contactEmail ?? "",
        signedAt,
        signatureImage: body.signatureImage,
        agreementVersion,
        agreementHtmlSnapshot,
        acknowledgedClauses,
      });
    }

    const response = NextResponse.json({
      success: true,
      bookingRef: result.bookingRef,
      bookingStatus: "PENDING_REVIEW",
      bookingStatusLabel: "Pending Review",
      paymentStatus: "UNPAID",
      paymentStatusLabel: "Unpaid",
      successToken: result.successToken,
      alreadySubmitted: result.alreadySubmitted,
    });

    // The booking session is over. Dropping the cookie here stops a later visit
    // from resuming a submitted booking (and being told its session expired).
    response.cookies.set("ds_booking_session", "", {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });

    return response;
  } catch (error) {
    if (error instanceof BookingReviewError) {
      return bookingErrorResponse(
        error.status,
        CUSTOMER_ERROR_CODES[error.code] ?? error.code,
        error.message,
        error.details
      );
    }
    if (error instanceof RangeBookingSessionError) {
      return bookingErrorResponse(
        error.code === "BOOKING_NOT_FOUND" ? 404 : 409,
        error.code,
        error.message
      );
    }
    console.error("BOOKING_SUBMIT_ERROR:", error);
    return bookingErrorResponse(
      500,
      "INTERNAL_ERROR",
      "Unable to submit your booking right now."
    );
  }
}
