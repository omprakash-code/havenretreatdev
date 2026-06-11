import { describe, expect, it } from "vitest";

import {
  BOOKING_PAYMENT_APPLIED_MESSAGE,
  BOOKING_PREPAYMENT_MESSAGE,
  BOOKING_REVIEW_MESSAGE,
  BOOKING_REVIEW_TITLE,
} from "@/constants/booking-status-copy";

describe("booking status copy", () => {
  it("presents review and payment status without alarm language", () => {
    const copy = [
      BOOKING_REVIEW_TITLE,
      BOOKING_REVIEW_MESSAGE,
      BOOKING_PAYMENT_APPLIED_MESSAGE,
      BOOKING_PREPAYMENT_MESSAGE,
    ].join(" ");

    expect(copy).toContain("date is reserved");
    expect(copy).toContain("payment has been applied");
    expect(copy.toLowerCase()).not.toContain("not confirmed");
    expect(copy.toLowerCase()).not.toContain("non-refundable");
  });
});
