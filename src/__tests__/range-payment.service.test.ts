import { beforeEach, describe, expect, it, vi } from "vitest";

type State = ReturnType<typeof createState>;

function createState() {
  const startsAtUtc = new Date("2030-06-10T13:00:00.000Z");
  const endsAtUtc = new Date("2030-06-10T17:00:00.000Z");
  const occupiedUntilUtc = new Date("2030-06-10T18:00:00.000Z");
  return {
    booking: {
      id: "booking-1",
      bookingRef: "RANGE-1",
      slotId: null,
      theatreId: "theatre-1",
      eventDate: new Date("2030-06-10T04:00:00.000Z"),
      startsAtUtc,
      endsAtUtc,
      occupiedUntilUtc,
      lockVersion: 1,
      bookingStatus: "PAYMENT_PROCESSING",
      paymentStatus: "AWAITING_PAYMENT",
      cancelledReason: null as string | null,
      totalAmount: 2000,
      advancePaid: 750,
    },
    lock: {
      id: "lock-1",
      bookingId: "booking-1",
      theatreId: "theatre-1",
      eventDate: new Date("2030-06-10T04:00:00.000Z"),
      startsAtUtc,
      endsAtUtc,
      occupiedUntilUtc,
      expiresAt: new Date("2030-06-10T12:30:00.000Z"),
      version: 1,
      status: "ACTIVE",
    },
    payment: {
      id: "payment-1",
      bookingId: "booking-1",
      provider: "SQUARE",
      providerOrderId: "order-1",
      providerPaymentId: null as string | null,
      bookingLockVersion: 1,
      providerPayload: null as unknown,
      amount: 750,
      status: "AWAITING_PAYMENT",
    },
  };
}

let state: State;
let transactionQueue = Promise.resolve();

function txClient() {
  return {
    $queryRaw: vi.fn().mockResolvedValue([{ id: state.booking.id }]),
    booking: {
      findUnique: vi.fn().mockImplementation(() => state.booking),
      findFirst: vi.fn().mockResolvedValue(null),
      update: vi.fn().mockImplementation(({ data }) => {
        Object.assign(state.booking, data);
        return state.booking;
      }),
    },
    payment: {
      findUnique: vi.fn().mockImplementation(() => state.payment),
      update: vi.fn().mockImplementation(({ data }) => {
        Object.assign(state.payment, data);
        return state.payment;
      }),
    },
    bookingLock: {
      findUnique: vi.fn().mockImplementation(() => state.lock),
      findFirst: vi.fn().mockResolvedValue(null),
      update: vi.fn().mockImplementation(({ data }) => {
        Object.assign(state.lock, data);
        return state.lock;
      }),
      updateMany: vi.fn().mockImplementation(({ where, data }) => {
        if (
          typeof where?.id === "object" &&
          where.id?.not === state.lock.id
        ) {
          return { count: 0 };
        }
        Object.assign(state.lock, data);
        return { count: 1 };
      }),
    },
    availabilityBlock: {
      findFirst: vi.fn().mockResolvedValue(null),
    },
    bookingItem: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    productVariant: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    couponUsage: {
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
  };
}

vi.mock("@/lib/db", () => ({
  prisma: {
    payment: {
      findFirst: vi.fn().mockImplementation(() => state.payment),
    },
    $transaction: vi.fn().mockImplementation(
      (callback: (tx: ReturnType<typeof txClient>) => Promise<unknown>) => {
        const run = transactionQueue.then(() => callback(txClient()));
        transactionQueue = run.then(
          () => undefined,
          () => undefined
        );
        return run;
      }
    ),
  },
}));

import { finalizeRangePayment } from "@/services/booking/range-payment.service";

function finalize(paymentId = "square-payment-1") {
  return finalizeRangePayment({
    provider: "SQUARE",
    bookingId: "booking-1",
    providerOrderId: "order-1",
    providerPaymentId: paymentId,
    providerPayload: { eventId: "event-1" },
    amount: 750,
    now: new Date("2030-06-10T12:00:00.000Z"),
  });
}

describe("range payment finalization", () => {
  beforeEach(() => {
    state = createState();
    transactionQueue = Promise.resolve();
    process.env.RANGE_PAYMENT_FINALIZATION_ENABLED = "true";
    process.env.SUCCESS_PAGE_SECRET = "range-payment-test-secret";
  });

  it("treats duplicate webhook delivery as an idempotent success", async () => {
    const first = await finalize();
    const duplicate = await finalize();

    expect(first.status).toBe("CONFIRMED");
    expect(duplicate.status).toBe("ALREADY_CONFIRMED");
    expect(state.booking.bookingStatus).toBe("CONFIRMED");
    expect(state.lock.status).toBe("CONSUMED");
    expect(state.payment.status).toBe("PAID");
    expect(state.payment.providerPayload).toEqual({ eventId: "event-1" });
  });

  it("serializes concurrent duplicate deliveries and confirms only once", async () => {
    const results = await Promise.all([finalize(), finalize()]);

    expect(results.map((result) => result.status).sort()).toEqual([
      "ALREADY_CONFIRMED",
      "CONFIRMED",
    ]);
    expect(state.booking.bookingStatus).toBe("CONFIRMED");
    expect(state.lock.status).toBe("CONSUMED");
  });

  it("separates booking abandonment from payment manual review", async () => {
    state.lock.expiresAt = new Date("2030-06-10T11:59:00.000Z");

    const result = await finalize("square-payment-expired");

    expect(result).toMatchObject({
      status: "MANUAL_REVIEW",
      reason: "PAYMENT_CAPTURED_LOCK_EXPIRED",
    });
    expect(state.booking.bookingStatus).toBe("ABANDONED");
    expect(state.booking.paymentStatus).toBe("MANUAL_REVIEW");
    expect(state.lock.status).toBe("EXPIRED");
    expect(state.payment.status).toBe("MANUAL_REVIEW");
    expect(state.payment.providerPaymentId).toBe("square-payment-expired");
  });
});
