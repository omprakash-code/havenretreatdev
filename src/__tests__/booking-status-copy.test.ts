import { describe, expect, it } from "vitest";

import {
  BOOKING_CONFIRMED_MESSAGE,
  BOOKING_NO_PAYMENT_DUE_MESSAGE,
  BOOKING_NO_PAYMENT_TODAY_TITLE,
  BOOKING_PAYMENT_APPLIED_MESSAGE,
  BOOKING_REVIEW_FOLLOWUP_MESSAGE,
  BOOKING_REVIEW_MESSAGE,
  BOOKING_REVIEW_TITLE,
  buildAdvancePaymentNotice,
} from "@/constants/booking-status-copy";

/**
 * The public booking journey collects no payment, so nothing a customer reads
 * while submitting or after submitting may ask for money or imply a balance is
 * owed. Payment wording survives only on the legacy payment-first copy, which
 * the review workflow never renders.
 */
describe("booking status copy", () => {
  const reviewCopy = [
    BOOKING_REVIEW_TITLE,
    BOOKING_REVIEW_MESSAGE,
    BOOKING_NO_PAYMENT_DUE_MESSAGE,
    BOOKING_NO_PAYMENT_TODAY_TITLE,
    BOOKING_REVIEW_FOLLOWUP_MESSAGE,
  ].join(" ");

  it("tells the customer no payment is required and that a review follows", () => {
    expect(BOOKING_REVIEW_TITLE).toBe("Booking Request Received");
    expect(reviewCopy).toContain("No payment is required today");
    expect(reviewCopy).toContain("contact you shortly");
  });

  /**
   * The sidebar renders the headline and the follow-up as separate blocks. If
   * the combined sentence drifts from its two parts, a surface showing both
   * would tell the customer twice that no payment is required.
   */
  it("composes the one-line message from the headline and the follow-up", () => {
    expect(BOOKING_NO_PAYMENT_DUE_MESSAGE).toBe(
      `${BOOKING_NO_PAYMENT_TODAY_TITLE}. ${BOOKING_REVIEW_FOLLOWUP_MESSAGE}`
    );
    expect(BOOKING_NO_PAYMENT_TODAY_TITLE).not.toMatch(/\.$/);
    expect(BOOKING_REVIEW_FOLLOWUP_MESSAGE).not.toContain("No payment");
  });

  it("keeps the amounts out of the headline and in the advance notice", () => {
    const notice = buildAdvancePaymentNotice("$150", "$542");

    expect(notice).toContain("advance payment of $150");
    expect(notice).toContain("remaining $542 is due one week before your event");
    expect(BOOKING_NO_PAYMENT_TODAY_TITLE).not.toMatch(/\d/);
  });

  it("never asks a review-flow customer for money", () => {
    const lowered = reviewCopy.toLowerCase();

    for (const forbidden of [
      "deposit",
      "balance",
      "pay now",
      "due now",
      "payment required",
      "continue to payment",
      "awaiting payment",
    ]) {
      expect(lowered).not.toContain(forbidden);
    }
  });

  it("avoids alarm language and premature confirmation", () => {
    const lowered = reviewCopy.toLowerCase();

    expect(lowered).not.toContain("not confirmed");
    expect(lowered).not.toContain("non-refundable");
  });

  it("keeps balance wording on the legacy payment-first copy only", () => {
    expect(BOOKING_PAYMENT_APPLIED_MESSAGE).toContain("payment has been applied");
    expect(BOOKING_CONFIRMED_MESSAGE).toContain("date is reserved");
  });
});
