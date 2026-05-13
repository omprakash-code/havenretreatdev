import { describe, expect, it, vi } from "vitest";
import {
  expireBookingLockSession,
  releaseSiblingSessionLocks,
} from "@/services/booking/booking-lock-lifecycle.service";

function createDbMock() {
  return {
    booking: {
      findFirst: vi.fn(),
      updateMany: vi.fn(),
      findMany: vi.fn(),
    },
    slot: {
      updateMany: vi.fn(),
      findMany: vi.fn(),
    },
    couponUsage: {
      updateMany: vi.fn(),
    },
    payment: {
      findFirst: vi.fn(),
    },
  };
}

describe("booking-lock-lifecycle.service", () => {
  it("does not expire/release slot or coupons for admin-created booking", async () => {
    const db = createDbMock();
    db.booking.findFirst.mockResolvedValue(null);

    await expireBookingLockSession(db as never, {
      bookingId: "booking_admin",
      slotId: "slot_1",
      now: new Date("2026-03-01T10:00:00.000Z"),
      cancelledReason: "SESSION_EXPIRED",
    });

    expect(db.booking.updateMany).not.toHaveBeenCalled();
    expect(db.slot.updateMany).not.toHaveBeenCalled();
    expect(db.couponUsage.updateMany).not.toHaveBeenCalled();
  });

  it("expires customer booking and releases lock/coupon usage", async () => {
    const db = createDbMock();
    db.booking.findFirst.mockResolvedValue({
      id: "booking_customer",
      bookingStatus: "INCOMPLETE",
    });
    db.booking.updateMany.mockResolvedValue({ count: 1 });
    db.slot.updateMany.mockResolvedValue({ count: 1 });
    db.couponUsage.updateMany.mockResolvedValue({ count: 1 });
    db.payment.findFirst.mockResolvedValue(null);

    await expireBookingLockSession(db as never, {
      bookingId: "booking_customer",
      slotId: "slot_1",
      now: new Date("2026-03-01T10:00:00.000Z"),
      cancelledReason: "SESSION_EXPIRED",
    });

    expect(db.booking.updateMany).toHaveBeenCalledTimes(1);
    expect(db.slot.updateMany).toHaveBeenCalledTimes(1);
    expect(db.couponUsage.updateMany).toHaveBeenCalledTimes(1);
  });

  it("expires payment-stage booking as abandoned instead of leaving it processing", async () => {
    const db = createDbMock();
    db.booking.findFirst.mockResolvedValue({
      id: "booking_payment",
      bookingStatus: "PAYMENT_PROCESSING",
    });
    db.booking.updateMany.mockResolvedValue({ count: 1 });
    db.slot.updateMany.mockResolvedValue({ count: 1 });
    db.couponUsage.updateMany.mockResolvedValue({ count: 1 });
    db.payment.findFirst.mockResolvedValue(null);

    await expireBookingLockSession(db as never, {
      bookingId: "booking_payment",
      slotId: "slot_1",
      now: new Date("2026-03-01T10:00:00.000Z"),
      cancelledReason: "SESSION_EXPIRED",
    });

    expect(db.booking.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          bookingStatus: "ABANDONED",
          cancelledReason: "PAYMENT_STEP_ABANDONED",
          paymentStatus: "EXPIRED",
        }),
      })
    );
  });

  it("releases sibling locks only for customer-created active bookings", async () => {
    const db = createDbMock();
    db.slot.findMany.mockResolvedValue([{ id: "slot_cust" }, { id: "slot_admin" }]);
    db.booking.findMany.mockResolvedValue([
      { id: "booking_cust", slotId: "slot_cust", bookingStatus: "INCOMPLETE" },
    ]);
    db.slot.updateMany.mockResolvedValue({ count: 1 });
    db.booking.updateMany.mockResolvedValue({ count: 1 });
    db.couponUsage.updateMany.mockResolvedValue({ count: 1 });
    db.payment.findFirst.mockResolvedValue(null);

    const result = await releaseSiblingSessionLocks(db as never, {
      lockOwner: "owner_1",
      keepSlotId: "slot_keep",
      now: new Date("2026-03-01T10:00:00.000Z"),
      cancelledReason: "SESSION_SLOT_SWITCHED",
    });

    expect(result).toEqual({
      releasedSlotIds: ["slot_cust"],
      releasedBookingIds: ["booking_cust"],
    });
    expect(db.slot.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: { in: ["slot_cust"] },
        }),
      })
    );
  });
});
