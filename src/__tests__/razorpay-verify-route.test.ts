import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import crypto from "crypto";

const { sendPaymentCapturedBookingFailedNotificationsMock } = vi.hoisted(() => ({
  sendPaymentCapturedBookingFailedNotificationsMock: vi.fn().mockResolvedValue(
    undefined
  ),
}));

const { sendMetaCapiEventMock, getClientIpAddressMock } = vi.hoisted(() => ({
  sendMetaCapiEventMock: vi.fn().mockResolvedValue({ sent: true }),
  getClientIpAddressMock: vi.fn().mockReturnValue("127.0.0.1"),
}));

vi.mock("@/services/email.service", () => ({
  sendEmail: vi.fn(),
}));

vi.mock("@/services/whatsapp.service", () => ({
  sendBookingConfirmationWhatsApp: vi.fn(),
}));

vi.mock("@/services/booking/admin-booking-confirmation-email.service", () => ({
  sendAdminBookingConfirmationEmail: vi.fn().mockResolvedValue({ sentCount: 0 }),
}));

vi.mock("@/services/booking/booking-abandonment-email.service", () => ({
  notifyAbandonedBookingsByIds: vi.fn().mockResolvedValue({
    notifiedBookingIds: [],
  }),
}));

vi.mock("@/services/booking/payment-captured-booking-failed-email.service", () => ({
  sendPaymentCapturedBookingFailedNotifications:
    sendPaymentCapturedBookingFailedNotificationsMock,
}));

vi.mock("@/lib/meta/server", () => ({
  sendMetaCapiEvent: sendMetaCapiEventMock,
  getClientIpAddress: getClientIpAddressMock,
}));

vi.mock("@/emails/BookingConfirmationEmail", () => ({
  default: vi.fn(() => null),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    booking: {
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    payment: {
      create: vi.fn(),
      update: vi.fn(),
    },
    slot: {
      updateMany: vi.fn(),
    },
    couponUsage: {
      updateMany: vi.fn(),
    },
    location: {
      findUnique: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

import { prisma } from "@/lib/db";
import { POST } from "@/app/api/payments/razorpay/verify/route";
import { buildMetaPurchaseEventId } from "@/lib/meta/shared";

let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

type TxMock = {
  $queryRaw: ReturnType<typeof vi.fn>;
  booking: {
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  bookingItem: {
    findMany: ReturnType<typeof vi.fn>;
  };
  location: {
    findUnique: ReturnType<typeof vi.fn>;
  };
  payment: {
    update: ReturnType<typeof vi.fn>;
  };
  slot: {
    update: ReturnType<typeof vi.fn>;
    updateMany: ReturnType<typeof vi.fn>;
  };
  couponUsage: {
    findMany: ReturnType<typeof vi.fn>;
    updateMany: ReturnType<typeof vi.fn>;
  };
};

function createTxMock(): TxMock {
  return {
    $queryRaw: vi.fn().mockResolvedValue([{ id: "booking-1" }]),
    booking: {
      findUnique: vi.fn(),
      update: vi.fn().mockResolvedValue({
        ...baseBooking,
        bookingRef: "DS-BOOK-1",
        bookingStatus: "CONFIRMED",
        paymentStatus: "PAID",
        paymentMethod: "razorpay",
        razorpayPaymentId: "payment-1",
      }),
    },
    bookingItem: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    location: {
      findUnique: vi.fn().mockResolvedValue({ id: "loc-1", name: "Pitampura" }),
    },
    payment: {
      update: vi.fn().mockResolvedValue({}),
    },
    slot: {
      update: vi.fn().mockResolvedValue({}),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    couponUsage: {
      findMany: vi.fn().mockResolvedValue([]),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
  };
}

function mockTransaction(tx: TxMock) {
  (
    prisma.$transaction as unknown as ReturnType<typeof vi.fn>
  ).mockImplementation(async (cb: (innerTx: TxMock) => Promise<unknown>) => cb(tx));
}

const baseBooking = {
  id: "booking-1",
  bookingRef: "DS-BOOK-1",
  contactName: "Test User",
  contactPhone: "9999999999",
  contactEmail: null,
  occasionLabel: null,
  occasionData: null,
  items: [],
  confirmationEmailSent: true,
  bookingStatus: "PAYMENT_PROCESSING",
  paymentStatus: "AWAITING_PAYMENT",
  slotId: "slot-1",
  slot: {
    id: "slot-1",
    date: new Date("2026-01-01T00:00:00.000Z"),
    startTime: "10:00",
    endTime: "11:00",
    status: "LOCKED",
    lockedBy: "owner-1",
  },
  theatre: {
    id: "theatre-1",
    name: "Theatre 1",
    locationId: "loc-1",
    advanceAmount: 750,
  },
  user: null,
  guestCount: 2,
  baseAmount: 2000,
  extrasAmount: 0,
  productsAmount: 0,
  decorationAmount: 0,
  discountAmount: 0,
  totalAmount: 2000,
  advancePaid: 750,
  remainingPayable: 1250,
  razorpayOrderId: "order-1",
  razorpayPaymentId: null,
};

function buildVerifyRequest(paymentId = "payment-1") {
  const secret = process.env.RAZORPAY_KEY_SECRET ?? "test_secret";
  process.env.RAZORPAY_KEY_SECRET = secret;
  const orderId = "order-1";
  const signature = crypto
    .createHmac("sha256", secret)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");

  return new Request("http://localhost/api/payments/razorpay/verify", {
    method: "POST",
    body: JSON.stringify({
      bookingId: "booking-1",
      razorpay_order_id: orderId,
      razorpay_payment_id: paymentId,
      razorpay_signature: signature,
    }),
  });
}

describe("POST /api/payments/razorpay/verify", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    process.env.SUCCESS_PAGE_SECRET = "test-success-secret";
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost";

    (
      prisma.payment.create as unknown as ReturnType<typeof vi.fn>
    ).mockResolvedValue({ id: "pay-attempt-1" });
    (
      prisma.payment.update as unknown as ReturnType<typeof vi.fn>
    ).mockResolvedValue({});
    (
      prisma.location.findUnique as unknown as ReturnType<typeof vi.fn>
    ).mockResolvedValue({ id: "loc-1", name: "Pitampura" });
    (
      prisma.booking.updateMany as unknown as ReturnType<typeof vi.fn>
    ).mockResolvedValue({ count: 1 });
    (
      prisma.slot.updateMany as unknown as ReturnType<typeof vi.fn>
    ).mockResolvedValue({ count: 1 });
    (
      prisma.couponUsage.updateMany as unknown as ReturnType<typeof vi.fn>
    ).mockResolvedValue({ count: 1 });
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  it("treats confirmed booking with same payment id as idempotent success", async () => {
    (
      prisma.booking.findUnique as unknown as ReturnType<typeof vi.fn>
    ).mockResolvedValue({
      ...baseBooking,
      bookingStatus: "CONFIRMED",
      paymentStatus: "PAID",
      razorpayPaymentId: "payment-1",
    });

    const res = await POST(buildVerifyRequest("payment-1"));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toMatchObject({
      success: true,
      bookingRef: "DS-BOOK-1",
    });
    expect(prisma.payment.create).toHaveBeenCalledTimes(1);
    expect(prisma.payment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: "PAID" },
      })
    );
  });

  it("returns DUPLICATE_PAYMENT_ATTEMPT and keeps failed ledger for confirmed booking with different payment id", async () => {
    (
      prisma.booking.findUnique as unknown as ReturnType<typeof vi.fn>
    ).mockResolvedValue({
      ...baseBooking,
      bookingStatus: "CONFIRMED",
      paymentStatus: "PAID",
      razorpayPaymentId: "payment-older",
    });

    const res = await POST(buildVerifyRequest("payment-new"));
    const json = await res.json();

    expect(res.status).toBe(409);
    expect(json).toMatchObject({
      success: false,
      code: "DUPLICATE_PAYMENT_ATTEMPT",
      bookingRef: "DS-BOOK-1",
    });
    expect(prisma.payment.create).toHaveBeenCalledTimes(1);
    expect(prisma.payment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: "FAILED" },
      })
    );
  });

  it("returns SLOT_ALREADY_BOOKED and marks payment attempt paid-expired", async () => {
    (
      prisma.booking.findUnique as unknown as ReturnType<typeof vi.fn>
    ).mockResolvedValue({
      ...baseBooking,
    });

    const tx = createTxMock();
    mockTransaction(tx);
    tx.booking.findUnique.mockResolvedValue({
      ...baseBooking,
      slot: {
        ...baseBooking.slot,
        status: "BOOKED",
      },
    });

    const res = await POST(buildVerifyRequest("payment-slot"));
    const json = await res.json();

    expect(res.status).toBe(409);
    expect(json).toMatchObject({
      success: false,
      code: "SLOT_ALREADY_BOOKED",
      paymentCaptured: true,
    });
    expect(tx.booking.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          bookingStatus: "PAID_EXPIRED",
          paymentStatus: "PAID",
          cancelledReason: "PAYMENT_CAPTURED_SLOT_UNAVAILABLE",
        }),
      })
    );
    expect(tx.payment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          status: "PAID",
          transactionId: "payment-slot",
        },
      })
    );
    expect(sendPaymentCapturedBookingFailedNotificationsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        bookingRef: "DS-BOOK-1",
        paymentReference: "payment-slot",
      })
    );
  });

  it("returns BOOKING_NOT_FOUND before creating ledger for invalid booking id", async () => {
    (
      prisma.booking.findUnique as unknown as ReturnType<typeof vi.fn>
    ).mockResolvedValue(null);

    const res = await POST(buildVerifyRequest("payment-missing"));
    const json = await res.json();

    expect(res.status).toBe(404);
    expect(json).toMatchObject({
      success: false,
      code: "BOOKING_NOT_FOUND",
    });
    expect(prisma.payment.create).not.toHaveBeenCalled();
  });

  it("transitions slot from LOCKED to BOOKED on successful payment verification", async () => {
    (
      prisma.booking.findUnique as unknown as ReturnType<typeof vi.fn>
    ).mockResolvedValue({
      ...baseBooking,
      slot: {
        ...baseBooking.slot,
        status: "LOCKED",
        lockedBy: null,
      },
    });

    const tx = createTxMock();
    mockTransaction(tx);
    tx.booking.findUnique.mockResolvedValue({
      ...baseBooking,
      slot: {
        ...baseBooking.slot,
        status: "LOCKED",
        lockedBy: null,
      },
    });
    tx.booking.update.mockResolvedValue({
      ...baseBooking,
      bookingStatus: "CONFIRMED",
      paymentStatus: "PAID",
      paymentMethod: "razorpay",
      razorpayPaymentId: "payment-success",
    });

    const res = await POST(buildVerifyRequest("payment-success"));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toMatchObject({
      success: true,
      bookingRef: "DS-BOOK-1",
    });
    expect(tx.slot.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "slot-1" },
        data: expect.objectContaining({
          status: "BOOKED",
          lockedAt: null,
          lockExpiresAt: null,
          lockedBy: null,
        }),
      })
    );
    expect(sendMetaCapiEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: "Purchase",
        eventId: buildMetaPurchaseEventId({
          bookingRef: "DS-BOOK-1",
          paymentReference: "payment-success",
        }),
        customData: expect.objectContaining({
          currency: "INR",
          value: 2000,
          advance_paid_value: 750,
          total_booking_value: 2000,
          order_id: "DS-BOOK-1",
        }),
        eventSourceUrl: expect.stringContaining("/booking/success?t="),
        clientIpAddress: "127.0.0.1",
        phone: "9999999999",
        externalId: "DS-BOOK-1",
      })
    );
  });

  it("returns payment-captured SESSION_EXPIRED response when lock has expired", async () => {
    (
      prisma.booking.findUnique as unknown as ReturnType<typeof vi.fn>
    ).mockResolvedValue({
      ...baseBooking,
      slotId: "slot-1",
      slot: {
        ...baseBooking.slot,
        status: "LOCKED",
        lockExpiresAt: new Date("2020-01-01T00:00:00.000Z"),
      },
    });
    const tx = createTxMock();
    mockTransaction(tx);
    tx.booking.findUnique.mockResolvedValue({
      ...baseBooking,
      slot: {
        ...baseBooking.slot,
        status: "LOCKED",
        lockExpiresAt: new Date("2020-01-01T00:00:00.000Z"),
      },
      theatre: {
        ...baseBooking.theatre,
        location: {
          id: "loc-1",
          name: "Pitampura",
        },
      },
    });

    const res = await POST(buildVerifyRequest("payment-exp-admin"));
    const json = await res.json();

    expect(res.status).toBe(409);
    expect(json).toMatchObject({
      success: false,
      code: "SESSION_EXPIRED",
      paymentCaptured: true,
    });
    expect(tx.booking.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: "booking-1",
        },
        data: expect.objectContaining({
          bookingStatus: "PAID_EXPIRED",
          paymentStatus: "PAID",
          cancelledReason: "PAYMENT_CAPTURED_SESSION_EXPIRED",
        }),
      })
    );
    expect(tx.slot.updateMany).toHaveBeenCalledTimes(1);
    expect(tx.payment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          status: "PAID",
          transactionId: "payment-exp-admin",
        },
      })
    );
    expect(sendPaymentCapturedBookingFailedNotificationsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        bookingRef: "DS-BOOK-1",
        paymentReference: "payment-exp-admin",
      })
    );
  });

  it("treats prior payment-captured failure with same payment id as idempotent", async () => {
    (
      prisma.booking.findUnique as unknown as ReturnType<typeof vi.fn>
    ).mockResolvedValue({
      ...baseBooking,
      bookingStatus: "ABANDONED",
      paymentStatus: "PAID",
      cancelledReason: "PAYMENT_CAPTURED_SESSION_EXPIRED",
      razorpayPaymentId: "payment-exp-customer",
    });

    const res = await POST(buildVerifyRequest("payment-exp-customer"));
    const json = await res.json();

    expect(res.status).toBe(409);
    expect(json).toMatchObject({
      success: false,
      code: "SESSION_EXPIRED",
      paymentCaptured: true,
    });
    expect(prisma.payment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: "PAID" },
      })
    );
    expect(sendPaymentCapturedBookingFailedNotificationsMock).not.toHaveBeenCalled();
  });

  it("logs the reason when the purchase CAPI event is skipped", async () => {
    (
      prisma.booking.findUnique as unknown as ReturnType<typeof vi.fn>
    ).mockResolvedValue({
      ...baseBooking,
      slot: {
        ...baseBooking.slot,
        status: "LOCKED",
        lockedBy: null,
      },
    });
    const tx = createTxMock();
    mockTransaction(tx);
    tx.booking.findUnique.mockResolvedValue({
      ...baseBooking,
      slot: {
        ...baseBooking.slot,
        status: "LOCKED",
        lockedBy: null,
      },
      theatre: {
        ...baseBooking.theatre,
        location: {
          id: "loc-1",
          name: "Pitampura",
        },
      },
    });
    tx.booking.update.mockResolvedValue({
      ...baseBooking,
      bookingStatus: "CONFIRMED",
      paymentStatus: "PAID",
      paymentMethod: "razorpay",
      razorpayPaymentId: "payment-meta-skipped",
    });
    sendMetaCapiEventMock.mockResolvedValueOnce({
      sent: false,
      reason: "no_consent",
    });

    const res = await POST(buildVerifyRequest("payment-meta-skipped"));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(consoleWarnSpy).toHaveBeenCalledWith("META_PURCHASE_EVENT_SKIPPED", {
      sent: false,
      reason: "no_consent",
    });
  });
});
