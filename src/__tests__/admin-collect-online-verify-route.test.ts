import crypto from "crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/services/auth/adminAuth.server", () => ({
  getAuthenticatedAdminIdFromCookies: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    $transaction: vi.fn(),
  },
}));

vi.mock("@/services/booking/admin-booking-confirmation-email.service", () => ({
  sendAdminBookingConfirmationEmailByBookingId: vi
    .fn()
    .mockResolvedValue({ sentCount: 0 }),
}));

import { prisma } from "@/lib/db";
import { getAuthenticatedAdminIdFromCookies } from "@/services/auth/adminAuth.server";
import { POST } from "@/app/api/admin/bookings/[id]/collect-online/verify/route";

type TxMock = {
  $queryRaw: ReturnType<typeof vi.fn>;
  booking: {
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  payment: {
    findFirst: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    updateMany: ReturnType<typeof vi.fn>;
  };
};

function createTxMock(): TxMock {
  return {
    $queryRaw: vi.fn().mockResolvedValue([{ id: "booking-1" }]),
    booking: {
      findUnique: vi.fn(),
      update: vi.fn().mockResolvedValue({
        bookingRef: "DS-BOOK-1",
        advancePaid: 1200,
        remainingPayable: 800,
      }),
    },
    payment: {
      findFirst: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
      updateMany: vi.fn().mockResolvedValue({ count: 2 }),
    },
  };
}

function mockTransaction(tx: TxMock) {
  (prisma.$transaction as unknown as ReturnType<typeof vi.fn>).mockImplementation(
    async (cb: (innerTx: TxMock) => Promise<unknown>) => cb(tx)
  );
}

function buildRequest(input?: { orderId?: string; paymentId?: string; signature?: string }) {
  const orderId = input?.orderId ?? "order-1";
  const paymentId = input?.paymentId ?? "payment-1";
  const secret = process.env.RAZORPAY_KEY_SECRET ?? "test_razorpay_secret";
  process.env.RAZORPAY_KEY_SECRET = secret;
  const signature =
    input?.signature ??
    crypto
      .createHmac("sha256", secret)
      .update(`${orderId}|${paymentId}`)
      .digest("hex");

  return new Request("http://localhost/api/admin/bookings/booking-1/collect-online/verify", {
    method: "POST",
    body: JSON.stringify({
      razorpay_order_id: orderId,
      razorpay_payment_id: paymentId,
      razorpay_signature: signature,
    }),
  });
}

describe("POST /api/admin/bookings/[id]/collect-online/verify", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.RAZORPAY_KEY_SECRET = "test_razorpay_secret";
  });

  it("returns 401 when admin is not authenticated", async () => {
    (
      getAuthenticatedAdminIdFromCookies as unknown as ReturnType<typeof vi.fn>
    ).mockResolvedValue(null);

    const res = await POST(buildRequest(), {
      params: Promise.resolve({ id: "booking-1" }),
    });
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json).toMatchObject({
      success: false,
      code: "UNAUTHORIZED",
    });
  });

  it("returns idempotent success when booking already has same payment id", async () => {
    (
      getAuthenticatedAdminIdFromCookies as unknown as ReturnType<typeof vi.fn>
    ).mockResolvedValue("admin-1");

    const tx = createTxMock();
    mockTransaction(tx);
    tx.booking.findUnique.mockResolvedValue({
      id: "booking-1",
      bookingRef: "DS-BOOK-1",
      cancelledReason: null,
      totalAmount: 2000,
      advancePaid: 500,
      remainingPayable: 1500,
      razorpayOrderId: "order-1",
      razorpayPaymentId: "payment-1",
    });

    const res = await POST(buildRequest(), {
      params: Promise.resolve({ id: "booking-1" }),
    });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toMatchObject({
      success: true,
      data: {
        bookingRef: "DS-BOOK-1",
        idempotent: true,
      },
    });
    expect(tx.payment.findFirst).not.toHaveBeenCalled();
    expect(tx.payment.update).not.toHaveBeenCalled();
    expect(tx.payment.updateMany).not.toHaveBeenCalled();
  });

  it("returns ORDER_MISMATCH when booking order id differs from verify payload", async () => {
    (
      getAuthenticatedAdminIdFromCookies as unknown as ReturnType<typeof vi.fn>
    ).mockResolvedValue("admin-1");

    const tx = createTxMock();
    mockTransaction(tx);
    tx.booking.findUnique.mockResolvedValue({
      id: "booking-1",
      bookingRef: "DS-BOOK-1",
      cancelledReason: null,
      totalAmount: 2000,
      advancePaid: 500,
      remainingPayable: 1500,
      razorpayOrderId: "order-other",
      razorpayPaymentId: null,
    });

    const res = await POST(buildRequest({ orderId: "order-1" }), {
      params: Promise.resolve({ id: "booking-1" }),
    });
    const json = await res.json();

    expect(res.status).toBe(409);
    expect(json).toMatchObject({
      success: false,
      code: "ORDER_MISMATCH",
    });
  });

  it("returns PAYMENT_NOT_INITIALIZED when there is no pending initialized payment for order", async () => {
    (
      getAuthenticatedAdminIdFromCookies as unknown as ReturnType<typeof vi.fn>
    ).mockResolvedValue("admin-1");

    const tx = createTxMock();
    mockTransaction(tx);
    tx.booking.findUnique.mockResolvedValue({
      id: "booking-1",
      bookingRef: "DS-BOOK-1",
      cancelledReason: null,
      totalAmount: 2000,
      advancePaid: 500,
      remainingPayable: 1500,
      razorpayOrderId: "order-1",
      razorpayPaymentId: null,
    });
    tx.payment.findFirst.mockResolvedValue(null);

    const res = await POST(buildRequest(), {
      params: Promise.resolve({ id: "booking-1" }),
    });
    const json = await res.json();

    expect(res.status).toBe(409);
    expect(json).toMatchObject({
      success: false,
      code: "PAYMENT_NOT_INITIALIZED",
    });
  });

  it("marks pending payment paid and cancels stale initialized attempts on successful verification", async () => {
    (
      getAuthenticatedAdminIdFromCookies as unknown as ReturnType<typeof vi.fn>
    ).mockResolvedValue("admin-9");

    const tx = createTxMock();
    mockTransaction(tx);
    tx.booking.findUnique.mockResolvedValue({
      id: "booking-1",
      bookingRef: "DS-BOOK-1",
      cancelledReason: null,
      totalAmount: 2000,
      advancePaid: 500,
      remainingPayable: 1500,
      razorpayOrderId: "order-1",
      razorpayPaymentId: null,
    });
    tx.payment.findFirst.mockResolvedValue({
      id: "pay-init-1",
      bookingId: "booking-1",
      provider: "RAZORPAY",
      status: "INITIALIZED",
      transactionId: "order-1",
      amount: 700,
      recordedByAdminId: null,
    });

    const res = await POST(buildRequest(), {
      params: Promise.resolve({ id: "booking-1" }),
    });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toMatchObject({
      success: true,
      data: {
        bookingRef: "DS-BOOK-1",
        idempotent: false,
      },
    });

    expect(tx.booking.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "booking-1" },
        data: expect.objectContaining({
          bookingStatus: "CONFIRMED",
          paymentStatus: "PAID",
          razorpayOrderId: "order-1",
          razorpayPaymentId: "payment-1",
        }),
      })
    );

    expect(tx.payment.update).toHaveBeenCalledWith({
      where: { id: "pay-init-1" },
      data: {
        status: "PAID",
        transactionId: "payment-1",
        method: "ONLINE",
        recordedByAdminId: "admin-9",
      },
    });

    expect(tx.payment.updateMany).toHaveBeenCalledWith({
      where: {
        bookingId: "booking-1",
        provider: "RAZORPAY",
        status: "INITIALIZED",
        id: {
          not: "pay-init-1",
        },
      },
      data: {
        status: "CANCELLED",
      },
    });
  });
});
