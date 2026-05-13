import { beforeEach, describe, expect, it, vi } from "vitest";

const { razorpayOrdersCreateMock } = vi.hoisted(() => ({
  razorpayOrdersCreateMock: vi.fn(),
}));

vi.mock("razorpay", () => ({
  default: class RazorpayMock {
    orders = {
      create: razorpayOrdersCreateMock,
    };
  },
}));

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
      update: vi.fn(),
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
    $transaction: vi.fn(),
  },
}));

import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { verifyBookingSessionToken } from "@/services/booking/bookingSession.server";
import { POST } from "@/app/api/payments/razorpay/create-order/route";

function createCookieStore(input: {
  lockOwner?: string | null;
  bookingSession?: string | null;
}) {
  return {
    get: vi.fn((key: string) => {
      if (key === "ds_lock_owner" && input.lockOwner) {
        return { value: input.lockOwner };
      }
      if (key === "ds_booking_session" && input.bookingSession) {
        return { value: input.bookingSession };
      }
      return undefined;
    }),
  };
}

function mockPayableBooking() {
  (
    prisma.booking.findUnique as unknown as ReturnType<typeof vi.fn>
  ).mockResolvedValue({
    id: "booking-1",
    bookingRef: "DS-BOOK-1",
    bookingStatus: "AWAITING_PAYMENT",
    termsAcceptedAt: new Date("2026-01-01T00:00:00.000Z"),
    totalAmount: 2500,
    advancePaid: 750,
    razorpayOrderId: null,
    slot: {
      id: "slot-1",
      status: "LOCKED",
      lockedBy: "owner-1",
    },
  });
}

describe("POST /api/payments/razorpay/create-order", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SUCCESS_PAGE_SECRET = "test-success-secret";
  });

  it("returns order payload with pricing details in a single call", async () => {
    (
      prisma.booking.findUnique as unknown as ReturnType<typeof vi.fn>
    ).mockResolvedValue({
      id: "booking-1",
      bookingRef: "DS-BOOK-1",
      bookingStatus: "AWAITING_PAYMENT",
      createdByRole: "CUSTOMER",
      termsAcceptedAt: new Date("2026-03-01T00:00:00.000Z"),
      totalAmount: 2500,
      advancePaid: 750,
      razorpayOrderId: "order_existing_1",
      slotId: "slot-1",
      slot: {
        id: "slot-1",
        status: "LOCKED",
        lockedBy: "owner-1",
        lockExpiresAt: new Date("2099-01-01T00:00:00.000Z"),
      },
    });
    (
      prisma.appSetting.findUnique as unknown as ReturnType<typeof vi.fn>
    ).mockResolvedValue({ key: "ADVANCE_PAYMENT_AMOUNT", value: "750" });
    (
      cookies as unknown as ReturnType<typeof vi.fn>
    ).mockResolvedValue(
      createCookieStore({
        lockOwner: "owner-1",
        bookingSession: "session-token",
      })
    );
    (
      verifyBookingSessionToken as unknown as ReturnType<typeof vi.fn>
    ).mockReturnValue({
      bookingId: "booking-1",
      lockOwner: "owner-1",
    });

    (
      prisma.$transaction as unknown as ReturnType<typeof vi.fn>
    ).mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) =>
      callback({
        $queryRaw: vi.fn().mockResolvedValue([{ id: "booking-1" }]),
        booking: {
          findUnique: vi.fn().mockResolvedValue({
            id: "booking-1",
            bookingRef: "DS-BOOK-1",
            totalAmount: 2500,
            advancePaid: 750,
            razorpayOrderId: "order_existing_1",
          }),
          update: vi.fn().mockResolvedValue({}),
        },
      })
    );

    const req = new Request("http://localhost/api/payments/razorpay/create-order", {
      method: "POST",
      body: JSON.stringify({ bookingId: "booking-1" }),
    });

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toMatchObject({
      success: true,
      orderId: "order_existing_1",
      amount: 75000,
      advancePayable: 750,
      totalAmount: 2500,
      remainingPayable: 1750,
    });
    expect(razorpayOrdersCreateMock).not.toHaveBeenCalled();
  });

  it("returns SESSION_EXPIRED when booking session cookie is missing", async () => {
    mockPayableBooking();
    (cookies as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      createCookieStore({
        lockOwner: "owner-1",
        bookingSession: null,
      })
    );

    const req = new Request("http://localhost/api/payments/razorpay/create-order", {
      method: "POST",
      body: JSON.stringify({ bookingId: "booking-1" }),
    });

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(403);
    expect(json).toMatchObject({
      success: false,
      code: "SESSION_EXPIRED",
    });
  });

  it("returns UNAUTHORIZED when lock owner does not match current slot lock", async () => {
    mockPayableBooking();
    (cookies as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      createCookieStore({
        lockOwner: "owner-2",
        bookingSession: "session-token",
      })
    );
    (
      verifyBookingSessionToken as unknown as ReturnType<typeof vi.fn>
    ).mockReturnValue({
      bookingId: "booking-1",
      lockOwner: "owner-2",
    });

    const req = new Request("http://localhost/api/payments/razorpay/create-order", {
      method: "POST",
      body: JSON.stringify({ bookingId: "booking-1" }),
    });

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(403);
    expect(json).toMatchObject({
      success: false,
      code: "UNAUTHORIZED",
      message: "This booking session is no longer valid.",
    });
  });

  it("returns BOOKING_FINALIZED for confirmed booking", async () => {
    (
      prisma.booking.findUnique as unknown as ReturnType<typeof vi.fn>
    ).mockResolvedValue({
      id: "booking-1",
      bookingRef: "DS-BOOK-1",
      bookingStatus: "CONFIRMED",
      slot: {
        status: "BOOKED",
      },
    });

    const req = new Request("http://localhost/api/payments/razorpay/create-order", {
      method: "POST",
      body: JSON.stringify({ bookingId: "booking-1" }),
    });

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(409);
    expect(json).toMatchObject({
      success: false,
      code: "BOOKING_FINALIZED",
      bookingRef: "DS-BOOK-1",
    });
  });

  it("returns SESSION_EXPIRED and does not release slot/coupons for admin-created booking", async () => {
    (
      prisma.booking.findUnique as unknown as ReturnType<typeof vi.fn>
    ).mockResolvedValue({
      id: "booking-admin",
      bookingRef: "DS-BOOK-ADMIN",
      bookingStatus: "AWAITING_PAYMENT",
      createdByRole: "ADMIN",
      termsAcceptedAt: new Date("2026-03-01T00:00:00.000Z"),
      totalAmount: 2500,
      advancePaid: 750,
      slotId: "slot-1",
      slot: {
        id: "slot-1",
        status: "LOCKED",
        lockedBy: "owner-1",
        lockExpiresAt: new Date("2020-01-01T00:00:00.000Z"),
      },
    });
    (
      prisma.booking.findFirst as unknown as ReturnType<typeof vi.fn>
    ).mockResolvedValue(null);

    const req = new Request("http://localhost/api/payments/razorpay/create-order", {
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

  it("returns SESSION_EXPIRED and releases customer slot/coupons when lock has expired", async () => {
    (
      prisma.booking.findUnique as unknown as ReturnType<typeof vi.fn>
    ).mockResolvedValue({
      id: "booking-customer",
      bookingRef: "DS-BOOK-CUSTOMER",
      bookingStatus: "AWAITING_PAYMENT",
      createdByRole: "CUSTOMER",
      termsAcceptedAt: new Date("2026-03-01T00:00:00.000Z"),
      totalAmount: 2500,
      advancePaid: 750,
      slotId: "slot-2",
      slot: {
        id: "slot-2",
        status: "LOCKED",
        lockedBy: "owner-1",
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

    const req = new Request("http://localhost/api/payments/razorpay/create-order", {
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
