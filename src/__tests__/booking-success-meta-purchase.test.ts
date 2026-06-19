import { describe, expect, it, vi } from "vitest";
import {
  buildBookingSuccessPurchaseEvent,
  hasTrackedBookingSuccessPurchase,
  markBookingSuccessPurchaseTracked,
  shouldTrackBookingSuccessPurchase,
} from "@/components/booking/success/metaPurchase";

const paidBooking = {
  bookingRef: "HR-BOOK-1",
  paymentStatus: "PAID",
  payment: {
    provider: "square",
    method: "card",
    transactionId: "pay_123",
  },
  totalAmount: 2000,
  advancePaid: 750,
} as const;

describe("booking success meta purchase helpers", () => {
  it("tracks purchase only for paid Square bookings", () => {
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
      eventId: "purchase:HR-BOOK-1:pay_123",
      storageKey: "meta:purchase:HR-BOOK-1:token-1",
      params: {
        currency: "USD",
        value: 2000,
        advance_paid_value: 750,
        total_booking_value: 2000,
        order_id: "HR-BOOK-1",
        content_name: "Haven Retreat Booking",
        content_category: "event_venue",
        payment_method: "card",
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
