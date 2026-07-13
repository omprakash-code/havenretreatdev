/**
 * Booking/payment feature flags.
 *
 * The public booking flow submits for admin review and never collects payment.
 * The Square integration stays in the codebase, disabled, so a future provider
 * rollout is a flag change rather than a rewrite.
 */

function readBooleanFlag(value: string | undefined, fallback: boolean) {
  if (value === undefined || value === "") return fallback;
  return value === "true" || value === "1";
}

/** Customer-facing payment collection. Off: the public flow ends at submit. */
export function isPublicBookingPaymentsEnabled() {
  return readBooleanFlag(process.env.PUBLIC_BOOKING_PAYMENTS_ENABLED, false);
}

/** Square as a provider. Off: checkout creation is refused. */
export function isSquarePaymentsEnabled() {
  return readBooleanFlag(process.env.SQUARE_PAYMENTS_ENABLED, false);
}

/** Admin-issued payment links. Reserved for future payment work. */
export function isPaymentLinksEnabled() {
  return readBooleanFlag(process.env.PAYMENT_LINKS_ENABLED, false);
}

/** Admin review workflow. On by default; the public flow depends on it. */
export function isBookingReviewWorkflowEnabled() {
  return readBooleanFlag(process.env.BOOKING_REVIEW_WORKFLOW_ENABLED, true);
}

export const PAYMENTS_DISABLED_CODE = "PAYMENTS_DISABLED";
export const PAYMENTS_DISABLED_MESSAGE =
  "Online payment is not being collected right now. Haven Retreat will contact you with payment options after your booking is reviewed.";
