import { beforeEach, describe, expect, it, vi } from "vitest";

const { findUniqueMock, createSuccessTokenMock } = vi.hoisted(() => ({
  findUniqueMock: vi.fn(),
  createSuccessTokenMock: vi.fn(() => "success-token"),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    booking: {
      findUnique: findUniqueMock,
    },
  },
}));

vi.mock("@/services/booking/successToken.server", () => ({
  createSuccessToken: createSuccessTokenMock,
}));

import { GET } from "@/app/api/payments/square/status/route";

describe("Square payment status route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("clears the booking session after confirmation", async () => {
    findUniqueMock.mockResolvedValue({
      id: "booking-1",
      bookingRef: "HR-001",
      bookingStatus: "CONFIRMED",
      paymentStatus: "PAID",
      cancelledReason: null,
    });

    const response = await GET(
      new Request("http://localhost/api/payments/square/status?bookingId=booking-1")
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      success: true,
      status: "CONFIRMED",
      successToken: "success-token",
    });

    const cookies = response.headers.getSetCookie().join("\n");
    expect(cookies).toContain("ds_booking_session=");
    expect(cookies).toContain("ds_lock_owner=");
    expect(cookies).toContain("Max-Age=0");
  });

  it("keeps the active session while payment is still processing", async () => {
    findUniqueMock.mockResolvedValue({
      id: "booking-1",
      bookingRef: "HR-001",
      bookingStatus: "PAYMENT_PROCESSING",
      paymentStatus: "AWAITING_PAYMENT",
      cancelledReason: null,
    });

    const response = await GET(
      new Request("http://localhost/api/payments/square/status?bookingId=booking-1")
    );

    expect(response.status).toBe(200);
    expect(response.headers.getSetCookie()).toEqual([]);
  });
});
