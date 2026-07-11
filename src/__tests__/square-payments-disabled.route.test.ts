import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock, createSquarePaymentLinkMock } = vi.hoisted(() => ({
  prismaMock: {
    booking: { findUnique: vi.fn() },
    payment: { create: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
    $transaction: vi.fn(),
  },
  createSquarePaymentLinkMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

vi.mock("@/lib/square/server", () => ({
  createSquarePaymentLink: createSquarePaymentLinkMock,
  getSquareCurrency: vi.fn(() => "USD"),
  SquareServerError: class SquareServerError extends Error {},
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({ get: vi.fn(() => undefined) })),
}));

import { POST } from "@/app/api/payments/square/create-checkout/route";
import { POST as preparePayment } from "@/app/api/bookings/prepare-payment/route";

const ORIGINAL_ENV = { ...process.env };

function request(body: Record<string, unknown> = { bookingId: "booking_1" }) {
  return new Request("http://localhost/api/payments/square/create-checkout", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("Square checkout while public payments are disabled", () => {
  it("refuses to create a checkout by default", async () => {
    delete process.env.PUBLIC_BOOKING_PAYMENTS_ENABLED;
    delete process.env.SQUARE_PAYMENTS_ENABLED;

    const res = await POST(request());
    const json = await res.json();

    expect(res.status).toBe(503);
    expect(json.code).toBe("PAYMENTS_DISABLED");
  });

  it("never reads the booking or calls Square when disabled", async () => {
    process.env.PUBLIC_BOOKING_PAYMENTS_ENABLED = "false";

    await POST(request());

    // No Payment row, no provider call, no booking lookup.
    expect(prismaMock.booking.findUnique).not.toHaveBeenCalled();
    expect(prismaMock.payment.create).not.toHaveBeenCalled();
    expect(createSquarePaymentLinkMock).not.toHaveBeenCalled();
  });

  it("stays disabled when Square is on but public payments are off", async () => {
    process.env.PUBLIC_BOOKING_PAYMENTS_ENABLED = "false";
    process.env.SQUARE_PAYMENTS_ENABLED = "true";

    const res = await POST(request());

    expect(res.status).toBe(503);
    expect(createSquarePaymentLinkMock).not.toHaveBeenCalled();
  });

  it("stays disabled when public payments are on but Square is off", async () => {
    process.env.PUBLIC_BOOKING_PAYMENTS_ENABLED = "true";
    process.env.SQUARE_PAYMENTS_ENABLED = "false";

    const res = await POST(request());

    expect(res.status).toBe(503);
    expect(createSquarePaymentLinkMock).not.toHaveBeenCalled();
  });

  it("reaches the Square path again once both flags are enabled", async () => {
    process.env.PUBLIC_BOOKING_PAYMENTS_ENABLED = "true";
    process.env.SQUARE_PAYMENTS_ENABLED = "true";
    prismaMock.booking.findUnique.mockResolvedValue(null);

    const res = await POST(request());

    // Past the flag guard: the route now does its normal work (and 404s on a
    // missing booking) instead of refusing outright.
    expect(res.status).toBe(404);
    expect(prismaMock.booking.findUnique).toHaveBeenCalled();
  });
});

describe("prepare-payment while public payments are disabled", () => {
  it("refuses and creates nothing", async () => {
    delete process.env.PUBLIC_BOOKING_PAYMENTS_ENABLED;

    const res = await preparePayment(
      new Request("http://localhost/api/bookings/prepare-payment", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ bookingId: "booking_1" }),
      })
    );
    const json = await res.json();

    expect(res.status).toBe(503);
    expect(json.code).toBe("PAYMENTS_DISABLED");
    expect(prismaMock.payment.create).not.toHaveBeenCalled();
  });
});
