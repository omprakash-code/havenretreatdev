import type { BookingStatus, PaymentStatus } from "@prisma/client";
import { isPaymentCapturedBookingFailure } from "@/lib/payment-capture-failure";
import {
  derivePaymentLifecycle,
  getPaymentLifecycleLabel,
  type PaymentLifecycle,
} from "@/lib/booking-status";

export const PAYMENT_STEP_ABANDONED_REASON = "PAYMENT_STEP_ABANDONED";
export const PAYMENT_CHECKOUT_ABANDONED_REASON = "PAYMENT_CHECKOUT_ABANDONED";

export function isPaymentStageAbandoned(input: {
  bookingStatus?: BookingStatus | string | null;
  cancelledReason?: string | null;
}) {
  return (
    input.bookingStatus === "ABANDONED" &&
    (input.cancelledReason === PAYMENT_STEP_ABANDONED_REASON ||
      input.cancelledReason === PAYMENT_CHECKOUT_ABANDONED_REASON)
  );
}

export function getAdminBookingStatusDisplay(input: {
  bookingStatus?: BookingStatus | string | null;
  paymentStatus?: PaymentStatus | string | null;
  cancelledReason?: string | null;
}) {
  if (
    isPaymentCapturedBookingFailure({
      bookingStatus: input.bookingStatus,
      paymentStatus: input.paymentStatus,
      cancelledReason: input.cancelledReason,
    })
  ) {
    return {
      label: "PAID - EXPIRED",
      title: "PAID - EXPIRED",
      className: "bg-amber-50 text-amber-900 border border-amber-300",
    };
  }

  if (
    isPaymentStageAbandoned({
      bookingStatus: input.bookingStatus,
      cancelledReason: input.cancelledReason,
    })
  ) {
    return {
      label: "PAY ABANDONED",
      title: "PAY ABANDONED",
      className: "bg-orange-50 text-orange-800 border border-orange-300",
    };
  }

  return null;
}

type BadgeStyle = { label: string; title: string; className: string };

const REVIEW_STATUS_STYLES: Partial<Record<BookingStatus, BadgeStyle>> = {
  PENDING_REVIEW: {
    label: "PENDING REVIEW",
    title: "Awaiting admin approval",
    className: "bg-amber-50 text-amber-900 border border-amber-300",
  },
  APPROVED: {
    label: "APPROVED",
    title: "Approved by admin",
    className: "bg-emerald-50 text-emerald-800 border border-emerald-300",
  },
  REJECTED: {
    label: "REJECTED",
    title: "Rejected by admin",
    className: "bg-rose-50 text-rose-800 border border-rose-300",
  },
  COMPLETED: {
    label: "COMPLETED",
    title: "Event finished",
    className: "bg-slate-100 text-slate-700 border border-slate-300",
  },
};

/**
 * Review-workflow badge styling. Returns null for statuses the existing pill
 * already handles, so legacy display stays untouched.
 */
export function getReviewStatusDisplay(
  bookingStatus?: BookingStatus | string | null
): BadgeStyle | null {
  return REVIEW_STATUS_STYLES[bookingStatus as BookingStatus] ?? null;
}

const PAYMENT_LIFECYCLE_STYLES: Record<PaymentLifecycle, string> = {
  UNPAID: "bg-slate-50 text-slate-700 border border-slate-300",
  PARTIAL: "bg-amber-50 text-amber-900 border border-amber-300",
  PAID: "bg-emerald-50 text-emerald-800 border border-emerald-300",
};

/** Payment summary shown independently of booking approval. */
export function getPaymentLifecycleDisplay(input: {
  paymentStatus?: PaymentStatus | string | null;
  advancePaid?: number | null;
  remainingPayable?: number | null;
}): BadgeStyle & { lifecycle: PaymentLifecycle } {
  const lifecycle = derivePaymentLifecycle(input);
  const label = getPaymentLifecycleLabel(lifecycle);
  return {
    lifecycle,
    label,
    title: `Payment is tracked separately from approval — ${label}`,
    className: PAYMENT_LIFECYCLE_STYLES[lifecycle],
  };
}
