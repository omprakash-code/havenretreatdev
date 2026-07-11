import { describe, expect, it } from "vitest";
import { BookingStatus, PaymentStatus } from "@prisma/client";

import {
  derivePaymentLifecycle,
  getPaymentStatusLabel,
  isApprovedBookingStatus,
  isReviewWorkflowBookingStatus,
} from "@/lib/booking-status";
import { getPaymentLifecycleDisplay } from "@/lib/admin-booking-status";

/**
 * Booking approval and payment collection are independent lifecycles.
 * These tests pin the combinations the business needs to support.
 */

/** Mirrors the admin edit route's status rule when a payment is recorded. */
function resolveBookingStatusAfterPayment(input: {
  bookingStatus: BookingStatus;
  paymentStatus: PaymentStatus;
}): BookingStatus {
  return input.paymentStatus === PaymentStatus.PAID &&
    !isReviewWorkflowBookingStatus(input.bookingStatus)
    ? BookingStatus.CONFIRMED
    : input.bookingStatus;
}

describe("recording payment never approves a booking", () => {
  it("keeps a pending request pending after a full payment is recorded", () => {
    expect(
      resolveBookingStatusAfterPayment({
        bookingStatus: BookingStatus.PENDING_REVIEW,
        paymentStatus: PaymentStatus.PAID,
      })
    ).toBe(BookingStatus.PENDING_REVIEW);
  });

  it("keeps an approved booking approved rather than rewriting it to confirmed", () => {
    expect(
      resolveBookingStatusAfterPayment({
        bookingStatus: BookingStatus.APPROVED,
        paymentStatus: PaymentStatus.PAID,
      })
    ).toBe(BookingStatus.APPROVED);
  });

  it("preserves legacy auto-confirm for payment-first bookings", () => {
    // Existing admin behavior must not regress.
    expect(
      resolveBookingStatusAfterPayment({
        bookingStatus: BookingStatus.AWAITING_PAYMENT,
        paymentStatus: PaymentStatus.PAID,
      })
    ).toBe(BookingStatus.CONFIRMED);

    expect(
      resolveBookingStatusAfterPayment({
        bookingStatus: BookingStatus.PAYMENT_PROCESSING,
        paymentStatus: PaymentStatus.PAID,
      })
    ).toBe(BookingStatus.CONFIRMED);
  });

  it("does not confirm a booking on a partial payment", () => {
    expect(
      resolveBookingStatusAfterPayment({
        bookingStatus: BookingStatus.AWAITING_PAYMENT,
        paymentStatus: PaymentStatus.OFFLINE,
      })
    ).toBe(BookingStatus.AWAITING_PAYMENT);
  });
});

describe("approval never records payment", () => {
  it("supports an approved booking that is still unpaid", () => {
    const booking = {
      bookingStatus: BookingStatus.APPROVED,
      paymentStatus: PaymentStatus.INITIALIZED,
      advancePaid: 0,
      remainingPayable: 2400,
    };

    expect(isApprovedBookingStatus(booking.bookingStatus)).toBe(true);
    expect(derivePaymentLifecycle(booking)).toBe("UNPAID");
    expect(getPaymentStatusLabel(booking)).toBe("Unpaid");
  });

  it("supports an approved booking with a recorded advance", () => {
    const booking = {
      bookingStatus: BookingStatus.APPROVED,
      paymentStatus: PaymentStatus.OFFLINE,
      advancePaid: 750,
      remainingPayable: 1650,
    };

    expect(isApprovedBookingStatus(booking.bookingStatus)).toBe(true);
    expect(derivePaymentLifecycle(booking)).toBe("PARTIAL");
    expect(getPaymentStatusLabel(booking)).toBe("Partial");
  });

  it("supports an approved booking paid in full", () => {
    const booking = {
      bookingStatus: BookingStatus.APPROVED,
      paymentStatus: PaymentStatus.PAID,
      advancePaid: 2400,
      remainingPayable: 0,
    };

    expect(derivePaymentLifecycle(booking)).toBe("PAID");
  });

  it("supports a pending request with no payment requested", () => {
    const booking = {
      bookingStatus: BookingStatus.PENDING_REVIEW,
      paymentStatus: PaymentStatus.INITIALIZED,
      advancePaid: 0,
      remainingPayable: 2400,
    };

    expect(derivePaymentLifecycle(booking)).toBe("UNPAID");
  });
});

describe("admin manual payment display", () => {
  it("shows an offline advance as partial", () => {
    const display = getPaymentLifecycleDisplay({
      paymentStatus: PaymentStatus.OFFLINE,
      advancePaid: 750,
      remainingPayable: 1650,
    });

    expect(display.lifecycle).toBe("PARTIAL");
    expect(display.label).toBe("Partial");
    expect(display.title).toContain("tracked separately from approval");
  });

  it("shows a fully collected offline payment as paid", () => {
    const display = getPaymentLifecycleDisplay({
      paymentStatus: PaymentStatus.OFFLINE,
      advancePaid: 2400,
      remainingPayable: 0,
    });

    expect(display.lifecycle).toBe("PAID");
    expect(display.label).toBe("Paid");
  });

  it("shows a booking with nothing collected as unpaid", () => {
    const display = getPaymentLifecycleDisplay({
      paymentStatus: PaymentStatus.INITIALIZED,
      advancePaid: 0,
      remainingPayable: 2400,
    });

    expect(display.lifecycle).toBe("UNPAID");
    expect(display.label).toBe("Unpaid");
  });
});
