import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

vi.mock("@/services/booking/bookingSession.server", () => ({
  verifyBookingSessionToken: vi.fn(),
}));

vi.mock("@/services/booking/booking-abandonment-email.service", () => ({
  notifyAbandonedBookingsByIds: vi.fn().mockResolvedValue({
    notifiedBookingIds: [],
  }),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    booking: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      updateMany: vi.fn(),
    },
    slot: {
      updateMany: vi.fn(),
    },
    couponUsage: {
      updateMany: vi.fn(),
    },
    payment: {
      findFirst: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

import { cookies } from "next/headers";
import { verifyBookingSessionToken } from "@/services/booking/bookingSession.server";
import { prisma } from "@/lib/db";
import { GET } from "@/app/api/bookings/current/route";

function createCookieStore() {
  return {
    get: vi.fn((key: string) =>
      key === "ds_booking_session" ? { value: "session-token" } : undefined
    ),
    set: vi.fn(),
  };
}

describe("GET /api/bookings/current", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (cookies as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      createCookieStore()
    );
    (
      verifyBookingSessionToken as unknown as ReturnType<typeof vi.fn>
    ).mockReturnValue({
      bookingId: "booking-1",
      lockOwner: "owner-1",
    });
  });

  it("returns SESSION_EXPIRED but does not release slot/coupons for admin-created booking", async () => {
    (
      prisma.booking.findUnique as unknown as ReturnType<typeof vi.fn>
    ).mockResolvedValue({
      id: "booking-1",
      slotId: "slot-1",
      bookingStatus: "AWAITING_PAYMENT",
      slot: {
        status: "LOCKED",
        lockExpiresAt: new Date("2020-01-01T00:00:00.000Z"),
      },
    });
    (
      prisma.booking.findFirst as unknown as ReturnType<typeof vi.fn>
    ).mockResolvedValue(null);

    const res = await GET();
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

  it("returns SESSION_EXPIRED and releases slot/coupons for customer booking", async () => {
    (
      prisma.booking.findUnique as unknown as ReturnType<typeof vi.fn>
    ).mockResolvedValue({
      id: "booking-1",
      slotId: "slot-1",
      bookingStatus: "AWAITING_PAYMENT",
      slot: {
        status: "LOCKED",
        lockExpiresAt: new Date("2020-01-01T00:00:00.000Z"),
      },
    });
    (
      prisma.booking.findFirst as unknown as ReturnType<typeof vi.fn>
    ).mockResolvedValue({
      id: "booking-1",
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

    const res = await GET();
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
