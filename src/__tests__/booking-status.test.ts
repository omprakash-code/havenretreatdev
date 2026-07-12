import { describe, expect, it } from "vitest";

import {
  canTransitionBookingStatus,
  derivePaymentLifecycle,
  getBookingStatusLabel,
  getPaymentStatusLabel,
  isApprovedBookingStatus,
  isCustomerEditableBookingStatus,
} from "@/lib/booking-status";
import {
  buildRangeConflictFilter,
  isReservedRangeStatus,
} from "@/lib/booking-policy";

describe("booking status labels", () => {
  it("labels review statuses with business language", () => {
    expect(getBookingStatusLabel("INCOMPLETE")).toBe("Draft");
    expect(getBookingStatusLabel("PENDING_REVIEW")).toBe("Pending Review");
    expect(getBookingStatusLabel("APPROVED")).toBe("Approved");
    expect(getBookingStatusLabel("REJECTED")).toBe("Rejected");
  });

  it("displays legacy CONFIRMED bookings as approved", () => {
    expect(getBookingStatusLabel("CONFIRMED")).toBe("Approved");
    expect(isApprovedBookingStatus("CONFIRMED")).toBe(true);
    expect(isApprovedBookingStatus("APPROVED")).toBe(true);
    expect(isApprovedBookingStatus("PENDING_REVIEW")).toBe(false);
  });

  it("keeps a submitted booking out of the editable public session", () => {
    expect(isCustomerEditableBookingStatus("INCOMPLETE")).toBe(true);
    expect(isCustomerEditableBookingStatus("PENDING_REVIEW")).toBe(false);
  });
});

describe("payment lifecycle", () => {
  it("reads an initialized booking with no money collected as unpaid", () => {
    expect(
      derivePaymentLifecycle({
        paymentStatus: "INITIALIZED",
        advancePaid: 0,
        remainingPayable: 1200,
      })
    ).toBe("UNPAID");
    expect(getPaymentStatusLabel({ advancePaid: 0, remainingPayable: 1200 })).toBe(
      "Unpaid"
    );
  });

  it("reads a recorded advance with an outstanding balance as partial", () => {
    expect(
      derivePaymentLifecycle({
        paymentStatus: "OFFLINE",
        advancePaid: 400,
        remainingPayable: 800,
      })
    ).toBe("PARTIAL");
  });

  it("reads a fully collected booking as paid", () => {
    expect(
      derivePaymentLifecycle({
        paymentStatus: "OFFLINE",
        advancePaid: 1200,
        remainingPayable: 0,
      })
    ).toBe("PAID");
    expect(derivePaymentLifecycle({ paymentStatus: "PAID" })).toBe("PAID");
  });

  it("does not report a zero-total unpaid booking as paid", () => {
    expect(
      derivePaymentLifecycle({ advancePaid: 0, remainingPayable: 0 })
    ).toBe("UNPAID");
  });

  it("stays independent of booking approval", () => {
    // An approved booking with nothing collected is a supported combination.
    expect(isApprovedBookingStatus("APPROVED")).toBe(true);
    expect(
      derivePaymentLifecycle({ advancePaid: 0, remainingPayable: 1200 })
    ).toBe("UNPAID");
  });
});

describe("booking status transitions", () => {
  it("allows the review workflow transitions", () => {
    expect(canTransitionBookingStatus("INCOMPLETE", "PENDING_REVIEW")).toBe(true);
    expect(canTransitionBookingStatus("PENDING_REVIEW", "APPROVED")).toBe(true);
    expect(canTransitionBookingStatus("PENDING_REVIEW", "REJECTED")).toBe(true);
    expect(canTransitionBookingStatus("PENDING_REVIEW", "CANCELLED")).toBe(true);
    expect(canTransitionBookingStatus("APPROVED", "CANCELLED")).toBe(true);
  });

  it("blocks rejecting an already approved booking", () => {
    expect(canTransitionBookingStatus("APPROVED", "REJECTED")).toBe(false);
    expect(canTransitionBookingStatus("REJECTED", "APPROVED")).toBe(false);
    expect(canTransitionBookingStatus("CANCELLED", "APPROVED")).toBe(false);
  });

  it("blocks approving a draft that was never submitted", () => {
    expect(canTransitionBookingStatus("INCOMPLETE", "APPROVED")).toBe(false);
  });
});

describe("range conflict policy", () => {
  it("reserves ranges for pending review, approved, and legacy confirmed", () => {
    expect(isReservedRangeStatus("PENDING_REVIEW")).toBe(true);
    expect(isReservedRangeStatus("APPROVED")).toBe(true);
    expect(isReservedRangeStatus("CONFIRMED")).toBe(true);
    expect(isReservedRangeStatus("INCOMPLETE")).toBe(false);
    expect(isReservedRangeStatus("REJECTED")).toBe(false);
    expect(isReservedRangeStatus("CANCELLED")).toBe(false);
  });

  it("blocks reserved ranges regardless of hold expiry", () => {
    const now = new Date("2026-07-12T12:00:00.000Z");
    const [reserved, held] = buildRangeConflictFilter(now);

    expect(reserved).toMatchObject({
      bookingStatus: { in: ["PENDING_REVIEW", "APPROVED", "CONFIRMED"] },
    });
    expect(reserved).not.toHaveProperty("holdExpiresAt");
    expect(held).toMatchObject({ holdExpiresAt: { gt: now } });
  });

  it("narrows only the draft-hold branch with the caller's own booking", () => {
    const now = new Date("2026-07-12T12:00:00.000Z");
    const [reserved, held] = buildRangeConflictFilter(now, {
      id: { not: "booking_1" },
    });

    expect(reserved).not.toHaveProperty("id");
    expect(held).toMatchObject({ id: { not: "booking_1" } });
  });
});
