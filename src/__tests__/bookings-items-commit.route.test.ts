import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  prismaMock,
  calculateBookingPricingMock,
  resolveBookingCouponUserIdMock,
  buildBookingCouponContextMock,
  rebalanceReservedBookingCouponsMock,
  getRequiredAdvancePaymentAmountMock,
  isNumberDecorationProductMock,
} = vi.hoisted(() => ({
  prismaMock: {
    $transaction: vi.fn(),
    couponUsage: {
      findMany: vi.fn(),
    },
  },
  calculateBookingPricingMock: vi.fn(),
  resolveBookingCouponUserIdMock: vi.fn(),
  buildBookingCouponContextMock: vi.fn(),
  rebalanceReservedBookingCouponsMock: vi.fn(),
  getRequiredAdvancePaymentAmountMock: vi.fn(),
  isNumberDecorationProductMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: prismaMock,
}));

vi.mock("@/lib/booking-pricing", () => ({
  calculateBookingPricing: calculateBookingPricingMock,
}));

vi.mock("@/services/coupon/booking-coupon.service", () => ({
  buildBookingCouponContext: buildBookingCouponContextMock,
  rebalanceReservedBookingCoupons: rebalanceReservedBookingCouponsMock,
  resolveBookingCouponUserId: resolveBookingCouponUserIdMock,
  BookingCouponMinimumPayableError: class BookingCouponMinimumPayableError extends Error {},
}));

vi.mock("@/lib/advance-payment", () => ({
  getRequiredAdvancePaymentAmount: getRequiredAdvancePaymentAmountMock,
}));

vi.mock("@/lib/product-numbering", () => ({
  isNumberDecorationProduct: isNumberDecorationProductMock,
}));

vi.mock("@/lib/coupon-display", () => ({
  getCouponDisplayCode: vi.fn((code: string) => code),
}));

vi.mock("@/services/coupon/coupon-minimum-payable", () => ({
  buildMinimumPayableMessage: vi.fn(() => "Minimum payable not met."),
}));

import { POST } from "@/app/api/bookings/items/commit/route";

function createTxMock() {
  return {
    $queryRaw: vi.fn().mockResolvedValue([{ id: "booking_1" }]),
    booking: {
      findUnique: vi.fn().mockResolvedValue({
        id: "booking_1",
        bookingStatus: "INCOMPLETE",
        advancePaid: 500,
        extrasAmount: 0,
        discountAmount: 0,
        guestCount: 2,
        userId: null,
        contactPhone: "9999999999",
        decorationRequired: false,
        occasionData: null,
        theatreId: "theatre_1",
        theatre: {
          locationId: "location_1",
          baseGuests: 2,
          capacity: 6,
          extraPersonPrice: 200,
          decorationPrice: 300,
        },
        slot: {
          id: "slot_1",
          status: "LOCKED",
          date: new Date("2026-03-25T12:00:00.000Z"),
          startTime: "10:00",
          endTime: "13:00",
          durationMin: 180,
          basePrice: 1000,
          finalPrice: 1000,
          decorationMandatory: false,
        },
      }),
      update: vi.fn().mockResolvedValue({}),
    },
    productVariant: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    bookingItem: {
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      create: vi.fn(),
    },
  };
}

describe("POST /api/bookings/items/commit", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    calculateBookingPricingMock.mockReturnValue({
      baseAmount: 1000,
      extrasAmount: 0,
      decorationAmount: 0,
    });
    resolveBookingCouponUserIdMock.mockResolvedValue(null);
    buildBookingCouponContextMock.mockReturnValue({});
    rebalanceReservedBookingCouponsMock.mockResolvedValue({
      totalDiscount: 0,
      appliedCoupons: [],
      allocations: [],
    });
    getRequiredAdvancePaymentAmountMock.mockResolvedValue(500);
    isNumberDecorationProductMock.mockReturnValue(false);
    prismaMock.couponUsage.findMany.mockResolvedValue([]);
  });

  it("locks the booking row before replacing booking items", async () => {
    const tx = createTxMock();
    prismaMock.$transaction.mockImplementation(async (cb: (inner: typeof tx) => Promise<unknown>) =>
      cb(tx)
    );

    const res = await POST(
      new Request("http://localhost/api/bookings/items/commit", {
        method: "POST",
        body: JSON.stringify({
          bookingId: "booking_1",
          items: [],
        }),
      })
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(tx.booking.findUnique).toHaveBeenCalledTimes(1);
    expect(tx.bookingItem.deleteMany).toHaveBeenCalledTimes(1);
    expect(tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      tx.booking.findUnique.mock.invocationCallOrder[0]
    );
    expect(tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      tx.bookingItem.deleteMany.mock.invocationCallOrder[0]
    );
  });
});
