import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  prismaMock,
  getAuthenticatedAdminIdFromCookiesMock,
  sendBookingApprovedEmailMock,
  sendBookingRejectedEmailMock,
} = vi.hoisted(() => ({
  prismaMock: {
    booking: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    bookingItem: {
      findMany: vi.fn(),
    },
    productVariant: {
      findUnique: vi.fn(),
      updateMany: vi.fn(),
    },
    signedAgreement: {
      findFirst: vi.fn(),
    },
    couponUsage: {
      updateMany: vi.fn(),
    },
    $queryRaw: vi.fn(),
    $transaction: vi.fn(),
  },
  getAuthenticatedAdminIdFromCookiesMock: vi.fn(),
  sendBookingApprovedEmailMock: vi.fn(async () => undefined),
  sendBookingRejectedEmailMock: vi.fn(async () => undefined),
}));

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

vi.mock("@/services/auth/adminAuth.server", () => ({
  getAuthenticatedAdminIdFromCookies: getAuthenticatedAdminIdFromCookiesMock,
}));

vi.mock("@/services/booking/booking-review-email.service", () => ({
  sendBookingApprovedEmail: sendBookingApprovedEmailMock,
  sendBookingRejectedEmail: sendBookingRejectedEmailMock,
}));

vi.mock("@/services/booking/successToken.server", () => ({
  createSuccessToken: vi.fn(() => "success-token"),
}));

import { POST as approve } from "@/app/api/admin/bookings/[id]/approve/route";
import { POST as reject } from "@/app/api/admin/bookings/[id]/reject/route";

const PENDING_BOOKING = {
  id: "booking_1",
  bookingRef: "HR0712202600001",
  bookingStatus: "PENDING_REVIEW",
  venueId: "venue_1",
  eventDate: new Date("2026-08-01T00:00:00.000Z"),
  startsAtUtc: new Date("2026-08-01T18:00:00.000Z"),
  occupiedUntilUtc: new Date("2026-08-01T23:00:00.000Z"),
};

const params = Promise.resolve({ id: "booking_1" });

function request(body: Record<string, unknown> = {}) {
  return new Request("http://localhost/api/admin/bookings/booking_1/decision", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();

  getAuthenticatedAdminIdFromCookiesMock.mockResolvedValue("admin_1");
  prismaMock.$transaction.mockImplementation(
    async (fn: (tx: typeof prismaMock) => Promise<unknown>) => fn(prismaMock)
  );
  prismaMock.$queryRaw.mockResolvedValue([]);
  prismaMock.booking.findUnique.mockResolvedValue(PENDING_BOOKING);
  prismaMock.booking.findFirst.mockResolvedValue(null);
  prismaMock.booking.update.mockResolvedValue({
    id: "booking_1",
    bookingRef: "HR0712202600001",
  });
  prismaMock.bookingItem.findMany.mockResolvedValue([]);
  prismaMock.signedAgreement.findFirst.mockResolvedValue({ id: "agreement_1" });
});

describe("POST /api/admin/bookings/[id]/approve", () => {
  it("approves a pending booking and confirms its coupons", async () => {
    const res = await approve(request({}), { params });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.bookingStatus).toBe("APPROVED");

    const update = prismaMock.booking.update.mock.calls[0]?.[0];
    expect(update.data.bookingStatus).toBe("APPROVED");
    expect(update.data.reviewedByAdminId).toBe("admin_1");
    expect(update.data.reviewedAt).toBeInstanceOf(Date);

    expect(prismaMock.couponUsage.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "CONFIRMED" }),
      })
    );
    expect(sendBookingApprovedEmailMock).toHaveBeenCalledExactlyOnceWith(
      "booking_1"
    );
  });

  it("does not record a payment when approving", async () => {
    await approve(request({}), { params });

    const update = prismaMock.booking.update.mock.calls[0]?.[0];
    expect(update.data).not.toHaveProperty("paymentStatus");
    expect(update.data).not.toHaveProperty("advancePaid");
  });

  it("decrements tracked stock once on approval", async () => {
    prismaMock.bookingItem.findMany.mockResolvedValue([
      { variantId: "variant_1", quantity: 2 },
    ]);
    prismaMock.productVariant.findUnique.mockResolvedValue({ stock: 5 });

    await approve(request({}), { params });

    expect(prismaMock.productVariant.updateMany).toHaveBeenCalledExactlyOnceWith({
      where: { id: "variant_1", stock: { not: null } },
      data: { stock: { decrement: 2 } },
    });
  });

  it("blocks approval when an add-on is out of stock", async () => {
    prismaMock.bookingItem.findMany.mockResolvedValue([
      { variantId: "variant_1", quantity: 4 },
    ]);
    prismaMock.productVariant.findUnique.mockResolvedValue({ stock: 1 });

    const res = await approve(request({}), { params });
    const json = await res.json();

    expect(res.status).toBe(409);
    expect(json.code).toBe("PRODUCT_UNAVAILABLE");
    expect(prismaMock.booking.update).not.toHaveBeenCalled();
    expect(prismaMock.productVariant.updateMany).not.toHaveBeenCalled();
  });

  it("blocks approval when the range now conflicts with another booking", async () => {
    prismaMock.booking.findFirst.mockResolvedValue({
      id: "booking_2",
      bookingRef: "HR0712202600002",
    });

    const res = await approve(request({}), { params });
    const json = await res.json();

    expect(res.status).toBe(409);
    expect(json.code).toBe("BOOKING_CONFLICT");
    expect(prismaMock.booking.update).not.toHaveBeenCalled();
  });

  it("blocks approval without a signed agreement", async () => {
    prismaMock.signedAgreement.findFirst.mockResolvedValue(null);

    const res = await approve(request({}), { params });
    const json = await res.json();

    expect(res.status).toBe(409);
    expect(json.code).toBe("BOOKING_INCOMPLETE");
    expect(prismaMock.booking.update).not.toHaveBeenCalled();
  });

  it("is idempotent for an already approved booking", async () => {
    prismaMock.booking.findUnique.mockResolvedValue({
      ...PENDING_BOOKING,
      bookingStatus: "APPROVED",
    });

    const res = await approve(request({}), { params });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.alreadyDecided).toBe(true);
    expect(prismaMock.booking.update).not.toHaveBeenCalled();
    expect(sendBookingApprovedEmailMock).not.toHaveBeenCalled();
  });

  it("rejects an unauthenticated caller", async () => {
    getAuthenticatedAdminIdFromCookiesMock.mockResolvedValue(null);

    const res = await approve(request({}), { params });

    expect(res.status).toBe(401);
    expect(prismaMock.booking.update).not.toHaveBeenCalled();
  });
});

describe("POST /api/admin/bookings/[id]/reject", () => {
  it("rejects a pending booking and releases its coupons", async () => {
    const res = await reject(
      request({ reason: "The venue is closed for maintenance." }),
      { params }
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.bookingStatus).toBe("REJECTED");

    const update = prismaMock.booking.update.mock.calls[0]?.[0];
    expect(update.data.bookingStatus).toBe("REJECTED");
    expect(update.data.rejectionReason).toBe(
      "The venue is closed for maintenance."
    );
    expect(update.data.reviewedByAdminId).toBe("admin_1");
    // The reserved range is released.
    expect(update.data.holdExpiresAt).toBeNull();

    expect(prismaMock.couponUsage.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "RELEASED", discountAmount: 0 }),
      })
    );
    expect(sendBookingRejectedEmailMock).toHaveBeenCalledExactlyOnceWith(
      "booking_1"
    );
  });

  it("requires a reason", async () => {
    const res = await reject(request({}), { params });
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.code).toBe("REASON_REQUIRED");
    expect(prismaMock.booking.update).not.toHaveBeenCalled();
    expect(sendBookingRejectedEmailMock).not.toHaveBeenCalled();
  });

  it("requires a reason with real content", async () => {
    const res = await reject(request({ reason: "  x  " }), { params });

    expect(res.status).toBe(400);
    expect(prismaMock.booking.update).not.toHaveBeenCalled();
  });

  it("blocks rejecting an already approved booking", async () => {
    prismaMock.booking.findUnique.mockResolvedValue({
      ...PENDING_BOOKING,
      bookingStatus: "APPROVED",
    });

    const res = await reject(
      request({ reason: "Changed our mind about this date." }),
      { params }
    );
    const json = await res.json();

    expect(res.status).toBe(409);
    expect(json.code).toBe("BOOKING_INVALID_STATE");
    expect(json.message).toContain("Cancel it instead");
    expect(prismaMock.booking.update).not.toHaveBeenCalled();
  });

  it("does not decrement stock on rejection", async () => {
    prismaMock.bookingItem.findMany.mockResolvedValue([
      { variantId: "variant_1", quantity: 2 },
    ]);

    await reject(request({ reason: "Double booked that evening." }), { params });

    expect(prismaMock.productVariant.updateMany).not.toHaveBeenCalled();
  });

  it("rejects an unauthenticated caller", async () => {
    getAuthenticatedAdminIdFromCookiesMock.mockResolvedValue(null);

    const res = await reject(request({ reason: "Not available." }), { params });

    expect(res.status).toBe(401);
    expect(prismaMock.booking.update).not.toHaveBeenCalled();
  });
});
