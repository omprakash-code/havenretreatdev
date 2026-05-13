import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    booking: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      updateMany: vi.fn(),
    },
    payment: {
      findFirst: vi.fn(),
    },
    slot: {
      updateMany: vi.fn(),
    },
    couponUsage: {
      updateMany: vi.fn(),
    },
    appSetting: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("@/services/booking/booking-abandonment-email.service", () => ({
  notifyAbandonedBookingsByIds: vi.fn().mockResolvedValue({
    notifiedBookingIds: [],
  }),
}));

import { prisma } from "@/lib/db";
import { POST } from "@/app/api/bookings/prepare-payment/route";

describe("POST /api/bookings/prepare-payment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns SESSION_EXPIRED but does not release slot/coupons for admin-created booking", async () => {
    (
      prisma.booking.findUnique as unknown as ReturnType<typeof vi.fn>
    ).mockResolvedValue({
      id: "booking-admin",
      slotId: "slot-1",
      bookingStatus: "AWAITING_PAYMENT",
      createdByRole: "ADMIN",
      termsAcceptedAt: new Date("2026-03-01T00:00:00.000Z"),
      totalAmount: 2000,
      advancePaid: 750,
      paymentStatus: "AWAITING_PAYMENT",
      slot: {
        id: "slot-1",
        status: "LOCKED",
        lockExpiresAt: new Date("2020-01-01T00:00:00.000Z"),
      },
    });
    (
      prisma.booking.findFirst as unknown as ReturnType<typeof vi.fn>
    ).mockResolvedValue(null);

    const req = new Request("http://localhost/api/bookings/prepare-payment", {
      method: "POST",
      body: JSON.stringify({ bookingId: "booking-admin" }),
    });

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(409);
    expect(json).toMatchObject({
      success: false,
      code: "SESSION_EXPIRED",
    });
    expect(prisma.booking.updateMany).not.toHaveBeenCalled();
    expect(prisma.slot.updateMany).not.toHaveBeenCalled();
    expect(prisma.couponUsage.updateMany).not.toHaveBeenCalled();
  });

  it("expires customer booking and releases slot/coupons when lock is expired", async () => {
    (
      prisma.booking.findUnique as unknown as ReturnType<typeof vi.fn>
    ).mockResolvedValue({
      id: "booking-customer",
      slotId: "slot-2",
      bookingStatus: "AWAITING_PAYMENT",
      createdByRole: "CUSTOMER",
      termsAcceptedAt: new Date("2026-03-01T00:00:00.000Z"),
      totalAmount: 2200,
      advancePaid: 750,
      paymentStatus: "AWAITING_PAYMENT",
      slot: {
        id: "slot-2",
        status: "LOCKED",
        lockExpiresAt: new Date("2020-01-01T00:00:00.000Z"),
      },
    });
    (
      prisma.booking.findFirst as unknown as ReturnType<typeof vi.fn>
    ).mockResolvedValue({
      id: "booking-customer",
      bookingStatus: "AWAITING_PAYMENT",
    });
    (
      prisma.slot.updateMany as unknown as ReturnType<typeof vi.fn>
    ).mockResolvedValue({ count: 1 });
    (
      prisma.couponUsage.updateMany as unknown as ReturnType<typeof vi.fn>
    ).mockResolvedValue({ count: 1 });
    (
      prisma.payment.findFirst as unknown as ReturnType<typeof vi.fn>
    ).mockResolvedValue(null);

    const req = new Request("http://localhost/api/bookings/prepare-payment", {
      method: "POST",
      body: JSON.stringify({ bookingId: "booking-customer" }),
    });

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(409);
    expect(json).toMatchObject({
      success: false,
      code: "SESSION_EXPIRED",
    });
    expect(prisma.booking.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          bookingStatus: "ABANDONED",
          cancelledReason: "PAYMENT_STEP_ABANDONED",
          paymentStatus: "EXPIRED",
        }),
      })
    );
    expect(prisma.slot.updateMany).toHaveBeenCalledTimes(1);
    expect(prisma.couponUsage.updateMany).toHaveBeenCalledTimes(1);
  });
});
