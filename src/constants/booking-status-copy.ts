// Public booking submits for admin review; no payment is collected in the flow.
// Every customer-facing surface — booking sidebar, success page, emails, PDF —
// reads its copy from here, so the review workflow speaks with one voice.
export const BOOKING_REVIEW_TITLE = "Booking Request Received";

export const BOOKING_REVIEW_MESSAGE =
  "Thank you for your booking request. We'll review your booking and contact you shortly.";

// The booking sidebar leads with the takeaway and explains underneath, so the
// headline and the follow-up are separate. Surfaces with room for only one line
// (emails, PDF, the success page) use the combined sentence instead. Rendering
// both the headline and the combined sentence together would say "no payment"
// twice.
export const BOOKING_NO_PAYMENT_TODAY_TITLE = "No payment is required today";

export const BOOKING_REVIEW_FOLLOWUP_TITLE =
  "What happens after you submit?";

export const BOOKING_REVIEW_FOLLOWUP_STEPS = [
  "Submit your booking request.",
] as const;

export const BOOKING_REVIEW_FOLLOWUP_MESSAGE =
  "What happens next?";

  /**
 * Payment timeline shown after the booking process.
 */
export function buildAdvancePaymentSteps(
  advanceAmount: string,
  remainingAmount: string
) {
  return [
    `Once your reservation is approved, we'll email you a secure payment link for the ${advanceAmount} deposit.`,
    `The remaining ${remainingAmount} is due one week before your event.`,
  ];
}

export const BOOKING_NO_PAYMENT_DUE_MESSAGE = `${BOOKING_NO_PAYMENT_TODAY_TITLE}. ${BOOKING_REVIEW_FOLLOWUP_MESSAGE}`;


// The ticket card and PDF list a status and a payment line as summary rows
// rather than a sentence. The status value is only a fallback: a booking that
// has since been approved or rejected shows its own label.
export const BOOKING_PENDING_REVIEW_STATUS_VALUE = "Pending Review";

export const BOOKING_PAYMENT_NOT_REQUIRED_VALUE = "Not required today";

export const BOOKING_APPROVED_TITLE = "Booking approved";

export const BOOKING_APPROVED_MESSAGE =
  "Haven Retreat has approved your event. We will contact you with the next steps.";

export const BOOKING_REJECTED_TITLE = "Booking request update";

export const BOOKING_REJECTED_MESSAGE =
  "Haven Retreat could not accept this request. Reach out to us and we will help you find another date.";

// Legacy payment-first bookings only: Square checkout and admin-recorded
// payments. These never appear in the public review journey, so they keep their
// confirmation and balance wording.
export const BOOKING_CONFIRMED_TITLE = "Booking confirmed";

export const BOOKING_CONFIRMED_MESSAGE =
  "Your date is reserved. Haven Retreat will confirm the final details with you shortly.";

export const BOOKING_PAYMENT_APPLIED_MESSAGE =
  "Your payment has been applied. The remaining balance is due one week before your event.";
