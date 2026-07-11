import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";
import { buildRangeConflictFilter } from "@/lib/booking-policy";
import {
  REJECTION_REASON_MAX_LENGTH,
  REJECTION_REASON_MIN_LENGTH,
  canTransitionBookingStatus,
  isApprovedBookingStatus,
} from "@/lib/booking-status";
import { createSuccessToken } from "@/services/booking/successToken.server";
import {
  requireActiveRangeBookingSession,
  type RangeBookingSessionIdentity,
} from "@/services/booking/range-booking-session.service";

type DbClient = Prisma.TransactionClient;

export type BookingReviewErrorCode =
  | "BOOKING_NOT_FOUND"
  | "BOOKING_INVALID_STATE"
  | "BOOKING_CONFLICT"
  | "BOOKING_INCOMPLETE"
  | "PRODUCT_UNAVAILABLE"
  | "REASON_REQUIRED";

export class BookingReviewError extends Error {
  constructor(
    public readonly code: BookingReviewErrorCode,
    message: string,
    public readonly status: number,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
  }
}

export type SignedAgreementInput = {
  agreementRef: string;
  agreementTemplateId: string;
  signerName: string;
  signerEmail: string;
  signatureImage: string;
  ipAddress: string | null;
  userAgent: string | null;
  agreementVersion: string;
  agreementHtmlSnapshot: string;
  acknowledgedClauses: Prisma.InputJsonValue;
  pdf: {
    generatedAt: Date;
    filename: string;
    sha256: string;
    content: Uint8Array<ArrayBuffer>;
  };
};

export type SubmitBookingResult = {
  bookingId: string;
  bookingRef: string;
  successToken: string;
  /** True when the booking was already submitted; the caller should treat this as success. */
  alreadySubmitted: boolean;
};

/**
 * Takes the row lock for a booking so concurrent submit/approve/reject calls
 * serialize on it.
 */
async function lockBookingRow(tx: DbClient, bookingId: string) {
  await tx.$queryRaw`SELECT id FROM "Booking" WHERE id = ${bookingId} FOR UPDATE`;
}

/** Serializes range-conflict checks for a venue/date pair. */
async function lockVenueDate(
  tx: DbClient,
  venueId: string | null,
  eventDate: Date | null
) {
  if (!venueId || !eventDate) return;
  const dateKey = eventDate.toISOString().slice(0, 10);
  await tx.$queryRaw`
    SELECT pg_advisory_xact_lock(hashtext(${venueId}), hashtext(${dateKey}))::text AS "lock"
  `;
}

async function assertNoRangeConflict(
  tx: DbClient,
  booking: {
    id: string;
    venueId: string | null;
    startsAtUtc: Date | null;
    occupiedUntilUtc: Date | null;
  },
  now: Date
) {
  if (!booking.venueId || !booking.startsAtUtc || !booking.occupiedUntilUtc) {
    return;
  }

  const conflict = await tx.booking.findFirst({
    where: {
      venueId: booking.venueId,
      id: { not: booking.id },
      OR: buildRangeConflictFilter(now),
      startsAtUtc: { lt: booking.occupiedUntilUtc },
      occupiedUntilUtc: { gt: booking.startsAtUtc },
    },
    select: { id: true, bookingRef: true },
  });

  if (conflict) {
    throw new BookingReviewError(
      "BOOKING_CONFLICT",
      "This time overlaps another booking. Please choose a different time.",
      409
    );
  }
}

/**
 * Stock is reserved by the customer's items but only decremented on approval,
 * so a request that is never approved never consumes inventory.
 */
async function assertItemsInStock(tx: DbClient, bookingId: string) {
  const items = await tx.bookingItem.findMany({
    where: { bookingId },
    select: { variantId: true, quantity: true },
  });

  for (const item of items) {
    const variant = await tx.productVariant.findUnique({
      where: { id: item.variantId },
      select: { stock: true },
    });
    // stock === null means unlimited / untracked → never unavailable.
    if (!variant || (variant.stock !== null && variant.stock < item.quantity)) {
      throw new BookingReviewError(
        "PRODUCT_UNAVAILABLE",
        "One of the selected add-ons is no longer available.",
        409
      );
    }
  }

  return items;
}

/**
 * Public submission. Signs the agreement, reserves the range for review, and
 * moves the booking to PENDING_REVIEW. It never creates a payment: payment
 * collection is a separate lifecycle handled by admins.
 *
 * Idempotent — resubmitting an already-submitted booking returns the same
 * pending-review result instead of failing.
 */
export async function submitBookingForReview(input: {
  bookingId: string;
  identity: RangeBookingSessionIdentity | null;
  agreement: SignedAgreementInput;
  now?: Date;
}): Promise<SubmitBookingResult> {
  const now = input.now ?? new Date();
  const { bookingId, agreement } = input;

  const existing = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: { id: true, bookingRef: true, bookingStatus: true },
  });

  if (!existing) {
    throw new BookingReviewError("BOOKING_NOT_FOUND", "Booking not found.", 404);
  }

  // Duplicate submit (refresh / double click / browser back): return the same
  // success result rather than a conflict.
  if (
    existing.bookingStatus === "PENDING_REVIEW" ||
    isApprovedBookingStatus(existing.bookingStatus)
  ) {
    return {
      bookingId: existing.id,
      bookingRef: existing.bookingRef,
      successToken: createSuccessToken(existing.id, existing.bookingRef),
      alreadySubmitted: true,
    };
  }

  if (!canTransitionBookingStatus(existing.bookingStatus, "PENDING_REVIEW")) {
    throw new BookingReviewError(
      "BOOKING_INVALID_STATE",
      "This booking can no longer be submitted.",
      409,
      { bookingStatus: existing.bookingStatus }
    );
  }

  return prisma.$transaction(async (tx) => {
    // Re-validate the hold inside the transaction: the session must still be
    // live at the moment we reserve the range.
    if (input.identity) {
      await requireActiveRangeBookingSession(input.identity, now, tx);
    }

    await lockBookingRow(tx, bookingId);

    const booking = await tx.booking.findUnique({
      where: { id: bookingId },
      select: {
        id: true,
        bookingRef: true,
        bookingStatus: true,
        venueId: true,
        packageId: true,
        eventDate: true,
        startsAtUtc: true,
        occupiedUntilUtc: true,
        contactName: true,
        contactPhone: true,
        contactEmail: true,
        termsAcceptedAt: true,
      },
    });

    if (!booking) {
      throw new BookingReviewError(
        "BOOKING_NOT_FOUND",
        "Booking not found.",
        404
      );
    }

    if (booking.bookingStatus === "PENDING_REVIEW") {
      return {
        bookingId: booking.id,
        bookingRef: booking.bookingRef,
        successToken: createSuccessToken(booking.id, booking.bookingRef),
        alreadySubmitted: true,
      };
    }

    if (
      !booking.packageId ||
      !booking.startsAtUtc ||
      !booking.occupiedUntilUtc ||
      !booking.contactName ||
      !booking.contactPhone
    ) {
      throw new BookingReviewError(
        "BOOKING_INCOMPLETE",
        "Booking details are incomplete. Please review your booking and try again.",
        400
      );
    }

    await lockVenueDate(tx, booking.venueId, booking.eventDate);
    await assertNoRangeConflict(tx, booking, now);
    await assertItemsInStock(tx, bookingId);

    await tx.signedAgreement.deleteMany({ where: { bookingId } });
    await tx.signedAgreement.create({
      data: {
        agreementRef: agreement.agreementRef,
        bookingId,
        agreementTemplateId: agreement.agreementTemplateId,
        signerName: agreement.signerName,
        signerEmail: agreement.signerEmail,
        signedAt: now,
        signatureImage: agreement.signatureImage,
        ipAddress: agreement.ipAddress,
        userAgent: agreement.userAgent,
        agreementVersion: agreement.agreementVersion,
        agreementHtmlSnapshot: agreement.agreementHtmlSnapshot,
        acknowledgedClauses: agreement.acknowledgedClauses,
        confirmationAccepted: true,
        pdfGeneratedAt: agreement.pdf.generatedAt,
        pdfFileName: agreement.pdf.filename,
        pdfSha256: agreement.pdf.sha256,
        pdfContent: agreement.pdf.content,
      },
    });

    const updated = await tx.booking.update({
      where: { id: bookingId },
      data: {
        bookingStatus: "PENDING_REVIEW",
        reviewSubmittedAt: now,
        termsAcceptedAt: booking.termsAcceptedAt ?? now,
        // The range is now reserved by status, not by a countdown hold.
        holdExpiresAt: null,
        // No payment attempt exists. This reads as "Unpaid" everywhere.
        paymentStatus: "INITIALIZED",
        paymentProvider: null,
        paymentOrderId: null,
        paymentTransactionId: null,
        paymentSignature: null,
        paymentCheckoutUrl: null,
      },
      select: { id: true, bookingRef: true },
    });

    // Coupons stay RESERVED through review: they are confirmed on approval and
    // released on rejection/cancellation.

    return {
      bookingId: updated.id,
      bookingRef: updated.bookingRef,
      successToken: createSuccessToken(updated.id, updated.bookingRef),
      alreadySubmitted: false,
    };
  });
}

export type ReviewDecisionResult = {
  bookingId: string;
  bookingRef: string;
  bookingStatus: "APPROVED" | "REJECTED";
  /** True when the booking already held this decision. */
  alreadyDecided: boolean;
};

/**
 * Admin approval. Re-checks the range and stock, decrements inventory once, and
 * confirms coupon reservations. It deliberately does not touch payment: an
 * approved booking may be unpaid, partially paid, or paid.
 */
export async function approveBooking(input: {
  bookingId: string;
  adminId: string;
  approvalNotes?: string | null;
  now?: Date;
}): Promise<ReviewDecisionResult> {
  const now = input.now ?? new Date();

  return prisma.$transaction(async (tx) => {
    await lockBookingRow(tx, input.bookingId);

    const booking = await tx.booking.findUnique({
      where: { id: input.bookingId },
      select: {
        id: true,
        bookingRef: true,
        bookingStatus: true,
        venueId: true,
        eventDate: true,
        startsAtUtc: true,
        occupiedUntilUtc: true,
      },
    });

    if (!booking) {
      throw new BookingReviewError(
        "BOOKING_NOT_FOUND",
        "Booking not found.",
        404
      );
    }

    if (isApprovedBookingStatus(booking.bookingStatus)) {
      return {
        bookingId: booking.id,
        bookingRef: booking.bookingRef,
        bookingStatus: "APPROVED" as const,
        alreadyDecided: true,
      };
    }

    if (!canTransitionBookingStatus(booking.bookingStatus, "APPROVED")) {
      throw new BookingReviewError(
        "BOOKING_INVALID_STATE",
        "Only a booking pending review can be approved.",
        409,
        { bookingStatus: booking.bookingStatus }
      );
    }

    const agreement = await tx.signedAgreement.findFirst({
      where: { bookingId: booking.id },
      select: { id: true },
    });
    if (!agreement) {
      throw new BookingReviewError(
        "BOOKING_INCOMPLETE",
        "This booking has no signed agreement and cannot be approved.",
        409
      );
    }

    await lockVenueDate(tx, booking.venueId, booking.eventDate);
    await assertNoRangeConflict(tx, booking, now);
    const items = await assertItemsInStock(tx, booking.id);

    for (const item of items) {
      // Only decrement tracked inventory; unlimited (null) stock is left untouched.
      await tx.productVariant.updateMany({
        where: { id: item.variantId, stock: { not: null } },
        data: { stock: { decrement: item.quantity } },
      });
    }

    const updated = await tx.booking.update({
      where: { id: booking.id },
      data: {
        bookingStatus: "APPROVED",
        reviewedAt: now,
        reviewedByAdminId: input.adminId,
        approvalNotes: input.approvalNotes?.trim() || null,
        holdExpiresAt: null,
      },
      select: { id: true, bookingRef: true },
    });

    await tx.couponUsage.updateMany({
      where: { bookingId: booking.id, status: "RESERVED" },
      data: { status: "CONFIRMED", confirmedAt: now },
    });

    return {
      bookingId: updated.id,
      bookingRef: updated.bookingRef,
      bookingStatus: "APPROVED" as const,
      alreadyDecided: false,
    };
  });
}

/**
 * Admin rejection. Requires a reason, releases the range and coupon
 * reservations, and leaves inventory untouched (it was never decremented).
 */
export async function rejectBooking(input: {
  bookingId: string;
  adminId: string;
  reason: string;
  now?: Date;
}): Promise<ReviewDecisionResult> {
  const now = input.now ?? new Date();
  const reason = input.reason?.trim() ?? "";

  if (
    reason.length < REJECTION_REASON_MIN_LENGTH ||
    reason.length > REJECTION_REASON_MAX_LENGTH
  ) {
    throw new BookingReviewError(
      "REASON_REQUIRED",
      `A rejection reason of ${REJECTION_REASON_MIN_LENGTH}–${REJECTION_REASON_MAX_LENGTH} characters is required.`,
      400
    );
  }

  return prisma.$transaction(async (tx) => {
    await lockBookingRow(tx, input.bookingId);

    const booking = await tx.booking.findUnique({
      where: { id: input.bookingId },
      select: { id: true, bookingRef: true, bookingStatus: true },
    });

    if (!booking) {
      throw new BookingReviewError(
        "BOOKING_NOT_FOUND",
        "Booking not found.",
        404
      );
    }

    if (booking.bookingStatus === "REJECTED") {
      return {
        bookingId: booking.id,
        bookingRef: booking.bookingRef,
        bookingStatus: "REJECTED" as const,
        alreadyDecided: true,
      };
    }

    if (!canTransitionBookingStatus(booking.bookingStatus, "REJECTED")) {
      throw new BookingReviewError(
        "BOOKING_INVALID_STATE",
        isApprovedBookingStatus(booking.bookingStatus)
          ? "This booking is already approved. Cancel it instead of rejecting it."
          : "Only a booking pending review can be rejected.",
        409,
        { bookingStatus: booking.bookingStatus }
      );
    }

    const updated = await tx.booking.update({
      where: { id: booking.id },
      data: {
        bookingStatus: "REJECTED",
        reviewedAt: now,
        reviewedByAdminId: input.adminId,
        rejectionReason: reason,
        // Release the reserved range.
        holdExpiresAt: null,
      },
      select: { id: true, bookingRef: true },
    });

    await tx.couponUsage.updateMany({
      where: { bookingId: booking.id, status: "RESERVED" },
      data: {
        status: "RELEASED",
        discountAmount: 0,
        releasedAt: now,
        confirmedAt: null,
      },
    });

    return {
      bookingId: updated.id,
      bookingRef: updated.bookingRef,
      bookingStatus: "REJECTED" as const,
      alreadyDecided: false,
    };
  });
}
