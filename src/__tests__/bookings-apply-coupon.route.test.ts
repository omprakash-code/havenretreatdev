import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  prismaMock,
  evaluateCouponMock,
  resolveCouponBaseAmountMock,
  calculateDiscountBreakdownMock,
  resolveBookingCouponUserIdMock,
  buildBookingCouponContextMock,
  rebalanceReservedBookingCouponsMock,
  findCouponCombinationConflictMock,
  getRequiredAdvancePaymentAmountMock,
} = vi.hoisted(() => ({
  prismaMock: {
    booking: {
      findUnique: vi.fn(),
    },
    coupon: {
      findUnique: vi.fn(),
    },
    couponUsage: {
      count: vi.fn(),
    },
    $transaction: vi.fn(),
  },
  evaluateCouponMock: vi.fn(),
  resolveCouponBaseAmountMock: vi.fn(),
  calculateDiscountBreakdownMock: vi.fn(),
  resolveBookingCouponUserIdMock: vi.fn(),
  buildBookingCouponContextMock: vi.fn(),
  rebalanceReservedBookingCouponsMock: vi.fn(),
  findCouponCombinationConflictMock: vi.fn(),
  getRequiredAdvancePaymentAmountMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: prismaMock,
}));

vi.mock("@/services/coupon", () => ({
  evaluateCoupon: evaluateCouponMock,
}));

vi.mock("@/services/coupon/coupon-targeting", () => ({
  resolveCouponBaseAmount: resolveCouponBaseAmountMock,
}));

vi.mock("@/services/coupon/coupon-discount", () => ({
  calculateDiscountBreakdown: calculateDiscountBreakdownMock,
}));

vi.mock("@/services/coupon/booking-coupon.service", () => ({
  resolveBookingCouponUserId: resolveBookingCouponUserIdMock,
  buildBookingCouponContext: buildBookingCouponContextMock,
  rebalanceReservedBookingCoupons: rebalanceReservedBookingCouponsMock,
  BookingCouponMinimumPayableError: class BookingCouponMinimumPayableError extends Error {},
}));

vi.mock("@/services/coupon/coupon-combination", () => ({
  findCouponCombinationConflict: findCouponCombinationConflictMock,
  buildCouponCombinationConflictMessage: vi.fn(() => "Conflict"),
}));

vi.mock("@/lib/advance-payment", () => ({
  getRequiredAdvancePaymentAmount: getRequiredAdvancePaymentAmountMock,
}));

vi.mock("@/services/coupon/coupon-rule.mapper", () => ({
  mapPrismaRuleToDomain: vi.fn((rule) => rule),
}));

import { POST } from "@/app/api/bookings/apply-coupon/route";

function createTxMock() {
  return {
    couponUsage: {
      findMany: vi.fn().mockResolvedValue([]),
      upsert: vi.fn().mockResolvedValue({}),
    },
    booking: {
      update: vi.fn().mockResolvedValue({}),
    },
  };
}

describe("POST /api/bookings/apply-coupon", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    prismaMock.booking.findUnique.mockResolvedValue({
      id: "booking_1",
      bookingRef: "BK-1",
      bookingStatus: "INCOMPLETE",
      paymentStatus: null,
      advancePaid: 500,
      baseAmount: 1000,
      extrasAmount: 0,
      decorationAmount: 0,
      userId: null,
      contactPhone: "9999999999",
      decorationRequired: false,
      theatreId: "theatre_1",
      theatre: {
        locationId: "location_1",
      },
      slot: {
        id: "slot_1",
        status: "LOCKED",
        date: new Date("2026-03-25T12:00:00.000Z"),
        startTime: "10:00",
        endTime: "13:00",
      },
      items: [],
    });

    prismaMock.coupon.findUnique.mockResolvedValue({
      id: "coupon_1",
      code: "SAVE100",
      discountType: "FLAT",
      discountValue: 100,
      maxDiscount: null,
      isStackable: false,
      stackableCouponIds: [],
      validFrom: new Date("2026-03-01T00:00:00.000Z"),
      validTill: null,
      scope: "BOOKING_TOTAL",
      usageLimit: null,
      perUserUsageLimit: null,
      minimumAmount: null,
      locationId: null,
      isActive: true,
      isDeleted: false,
      rules: [],
    });

    prismaMock.couponUsage.count.mockResolvedValue(0);
    resolveBookingCouponUserIdMock.mockResolvedValue(null);
    buildBookingCouponContextMock.mockReturnValue({
      amounts: {
        bookingTotal: 1000,
        slotAmount: 1000,
        nonSlotAmount: 0,
        bookingSubtotal: 1000,
        productsTotal: 0,
      },
    });
    evaluateCouponMock.mockReturnValue({
      valid: true,
      discountAmount: 100,
    });
    resolveCouponBaseAmountMock.mockReturnValue(1000);
    calculateDiscountBreakdownMock.mockReturnValue({
      rawDiscount: 100,
      afterMaxDiscount: 100,
    });
    findCouponCombinationConflictMock.mockReturnValue(null);
    getRequiredAdvancePaymentAmountMock.mockResolvedValue(500);
    rebalanceReservedBookingCouponsMock.mockResolvedValue({
      totalDiscount: 100,
      appliedCoupons: [{ couponId: "coupon_1", discountAmount: 100 }],
      allocations: [{ couponId: "coupon_1", discountAmount: 100 }],
    });
  });

  it("reuses coupon usage row via upsert when applying to the same booking again", async () => {
    const tx = createTxMock();
    prismaMock.$transaction.mockImplementation(async (cb: (inner: typeof tx) => Promise<unknown>) =>
      cb(tx)
    );

    const res = await POST(
      new Request("http://localhost/api/bookings/apply-coupon", {
        method: "POST",
        body: JSON.stringify({
          bookingId: "booking_1",
          couponCode: "SAVE100",
        }),
      })
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(tx.couponUsage.upsert).toHaveBeenCalledTimes(1);
    expect(tx.couponUsage.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          couponId_bookingId: {
            couponId: "coupon_1",
            bookingId: "booking_1",
          },
        },
      })
    );
  });

  it("returns stackable conflict without logging an internal server error", async () => {
    const tx = createTxMock();
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    prismaMock.$transaction.mockImplementation(async (cb: (inner: typeof tx) => Promise<unknown>) =>
      cb(tx)
    );
    findCouponCombinationConflictMock.mockReturnValue({
      id: "coupon_2",
      code: "DS600",
      isStackable: true,
      stackableCouponIds: [],
    });

    const res = await POST(
      new Request("http://localhost/api/bookings/apply-coupon", {
        method: "POST",
        body: JSON.stringify({
          bookingId: "booking_1",
          couponCode: "SAVE100",
        }),
      })
    );
    const json = await res.json();

    expect(res.status).toBe(409);
    expect(json.message).toBe("Conflict");
    expect(consoleErrorSpy).not.toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });

  it("uses the in-progress contact phone override when resolving coupon identity", async () => {
    const tx = createTxMock();
    prismaMock.$transaction.mockImplementation(async (cb: (inner: typeof tx) => Promise<unknown>) =>
      cb(tx)
    );

    const res = await POST(
      new Request("http://localhost/api/bookings/apply-coupon", {
        method: "POST",
        body: JSON.stringify({
          bookingId: "booking_1",
          couponCode: "SAVE100",
          contactPhone: "8888888888",
        }),
      })
    );

    expect(res.status).toBe(200);
    expect(resolveBookingCouponUserIdMock).toHaveBeenCalledWith(
      prismaMock,
      expect.objectContaining({
        contactPhone: "8888888888",
      })
    );
    expect(buildBookingCouponContextMock).toHaveBeenCalledWith(
      expect.objectContaining({
        contactPhone: "8888888888",
      })
    );
  });
});
