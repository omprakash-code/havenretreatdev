import { describe, expect, it, vi } from "vitest";
import {
  buildBookingSuccessPurchaseEvent,
  hasTrackedBookingSuccessPurchase,
  markBookingSuccessPurchaseTracked,
  shouldTrackBookingSuccessPurchase,
} from "@/components/booking/success/metaPurchase";

const paidBooking = {
  bookingRef: "DS-BOOK-1",
  paymentStatus: "PAID",
  payment: {
    provider: "razorpay",
    method: "upi",
    transactionId: "pay_123",
  },
  totalAmount: 2000,
  advancePaid: 750,
} as const;

describe("booking success meta purchase helpers", () => {
  it("tracks purchase only for paid Razorpay bookings", () => {
    expect(shouldTrackBookingSuccessPurchase(paidBooking)).toBe(true);
    expect(
      shouldTrackBookingSuccessPurchase({
        ...paidBooking,
        paymentStatus: "PENDING",
      })
    ).toBe(false);
    expect(
      shouldTrackBookingSuccessPurchase({
        ...paidBooking,
        payment: {
          ...paidBooking.payment,
          provider: "offline",
        },
      })
    ).toBe(false);
  });

  it("builds a dedupe-safe browser purchase payload", () => {
    expect(buildBookingSuccessPurchaseEvent(paidBooking, "token-1")).toEqual({
      eventId: "purchase:DS-BOOK-1:pay_123",
      storageKey: "meta:purchase:DS-BOOK-1:token-1",
      params: {
        currency: "INR",
        value: 2000,
        advance_paid_value: 750,
        total_booking_value: 2000,
        order_id: "DS-BOOK-1",
        content_name: "Private Theatre Booking",
        content_category: "private_theatre",
        payment_method: "upi",
      },
    });
  });

  it("marks purchase tracking in storage once sent", () => {
    const storage = {
      getItem: vi.fn().mockReturnValue(null),
      setItem: vi.fn(),
    };

    expect(
      hasTrackedBookingSuccessPurchase(storage, "meta:purchase:test")
    ).toBe(false);

    markBookingSuccessPurchaseTracked(storage, "meta:purchase:test");

    expect(storage.setItem).toHaveBeenCalledWith("meta:purchase:test", "1");
  });
});
