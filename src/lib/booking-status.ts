import type { BookingStatus, PaymentStatus } from "@prisma/client";

/**
 * Booking approval and payment collection are independent lifecycles.
 * Approval answers "do we accept this event request?"; payment answers "how much
 * money has been collected?". A booking can be APPROVED and UNPAID.
 *
 * Persisted enum values are never renamed for display purposes; the labels below
 * are the only place customer/admin copy is derived from a status.
 */

const BOOKING_STATUS_LABELS: Record<BookingStatus, string> = {
  INCOMPLETE: "Draft",
  PENDING_REVIEW: "Pending Review",
  APPROVED: "Approved",
  COMPLETED: "Completed",
  REJECTED: "Rejected",
  CANCELLED: "Cancelled",
  ABANDONED: "Abandoned",
  // Legacy payment-first values.
  AWAITING_PAYMENT: "Awaiting Payment",
  PAYMENT_PROCESSING: "Payment Processing",
  PAID_EXPIRED: "Payment Incident",
};

export function getBookingStatusLabel(
  status: BookingStatus | string | null | undefined
): string {
  if (!status) return "Unknown";
  return BOOKING_STATUS_LABELS[status as BookingStatus] ?? String(status);
}

/** A completed booking was approved; completion only marks the event as done. */
export function isApprovedBookingStatus(
  status: BookingStatus | string | null | undefined
) {
  return status === "APPROVED" || status === "COMPLETED";
}

export function isPendingReviewBookingStatus(
  status: BookingStatus | string | null | undefined
) {
  return status === "PENDING_REVIEW";
}

/** A submitted booking is no longer an editable public session. */
export function isCustomerEditableBookingStatus(
  status: BookingStatus | string | null | undefined
) {
  return status === "INCOMPLETE";
}

/**
 * Statuses owned by the review workflow. Their booking status is decided by an
 * admin approving or rejecting — never as a side effect of recording a payment.
 * Legacy payment-first statuses are excluded so their existing normalize-on-
 * payment behavior is preserved.
 */
export function isReviewWorkflowBookingStatus(
  status: BookingStatus | string | null | undefined
) {
  return (
    status === "PENDING_REVIEW" ||
    status === "APPROVED" ||
    status === "COMPLETED" ||
    status === "REJECTED"
  );
}

/**
 * Booking-level payment summary. Derived from amounts already stored on the
 * booking rather than a new enum: `PaymentStatus` mixes booking summary states
 * with provider-attempt states, so provider attempts stay on `Payment` rows.
 */
export type PaymentLifecycle = "UNPAID" | "PARTIAL" | "PAID";

const PAYMENT_LIFECYCLE_LABELS: Record<PaymentLifecycle, string> = {
  UNPAID: "Unpaid",
  PARTIAL: "Partial",
  PAID: "Paid",
};

export function derivePaymentLifecycle(input: {
  paymentStatus?: PaymentStatus | string | null;
  advancePaid?: number | null;
  remainingPayable?: number | null;
}): PaymentLifecycle {
  const collected = input.advancePaid ?? 0;
  const remaining = input.remainingPayable ?? 0;

  // PAID means money was captured, not that the booking is settled: an offline
  // advance is captured while a balance is still owed.
  if (input.paymentStatus === "PAID") return remaining > 0 ? "PARTIAL" : "PAID";
  // No money collected: INITIALIZED, a disabled/failed provider attempt, or a
  // freshly submitted request all read as Unpaid.
  if (collected <= 0) return "UNPAID";
  return remaining > 0 ? "PARTIAL" : "PAID";
}

export function getPaymentLifecycleLabel(lifecycle: PaymentLifecycle): string {
  return PAYMENT_LIFECYCLE_LABELS[lifecycle];
}

export function getPaymentStatusLabel(input: {
  paymentStatus?: PaymentStatus | string | null;
  advancePaid?: number | null;
  remainingPayable?: number | null;
}): string {
  return getPaymentLifecycleLabel(derivePaymentLifecycle(input));
}

/** Reject reason bounds (doc §18: min 3, max 1000; internal notes max 2000). */
export const REJECTION_REASON_MIN_LENGTH = 3;
export const REJECTION_REASON_MAX_LENGTH = 1000;
export const INTERNAL_NOTES_MAX_LENGTH = 2000;
export const APPROVAL_NOTES_MAX_LENGTH = 2000;

const ALLOWED_TRANSITIONS: Partial<Record<BookingStatus, BookingStatus[]>> = {
  INCOMPLETE: ["PENDING_REVIEW", "ABANDONED", "CANCELLED"],
  PENDING_REVIEW: ["APPROVED", "REJECTED", "CANCELLED"],
  // COMPLETED is terminal: it records that the event happened.
  APPROVED: ["CANCELLED", "COMPLETED"],
};

export function canTransitionBookingStatus(
  from: BookingStatus | string | null | undefined,
  to: BookingStatus
) {
  if (!from) return false;
  return (ALLOWED_TRANSITIONS[from as BookingStatus] ?? []).includes(to);
}
