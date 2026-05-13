import { beforeEach, describe, expect, it, vi } from "vitest";

import { persistAdminBookingCoupons, type EvaluatedAdminCoupon } from "@/app/api/admin/bookings/_coupon";

type CouponUsageMock = {
  updateMany: ReturnType<typeof vi.fn>;
  createMany: ReturnType<typeof vi.fn>;
  upsert: ReturnType<typeof vi.fn>;
};

type TxMock = {
  couponUsage: CouponUsageMock;
};

function createTxMock(): TxMock {
  return {
    couponUsage: {
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      createMany: vi.fn().mockResolvedValue({ count: 0 }),
      upsert: vi.fn().mockResolvedValue({}),
    },
  };
}

const coupons: EvaluatedAdminCoupon[] = [
  {
    couponId: "coupon-1",
    code: "SAVE100",
    discountAmount: 100,
  },
  {
    couponId: "coupon-2",
    code: "SAVE200",
    discountAmount: 200,
  },
];

describe("persistAdminBookingCoupons", () => {
  let tx: TxMock;
  const now = new Date("2026-03-18T12:00:00.000Z");

  beforeEach(() => {
    tx = createTxMock();
  });

  it("creates coupon usages and releases conflicting reserved usages for create mode", async () => {
    await persistAdminBookingCoupons({
      tx: tx as never,
      bookingId: "booking-1",
      userId: "user-1",
      coupons,
      status: "RESERVED",
      now,
      mode: "create",
    });

    expect(tx.couponUsage.updateMany).toHaveBeenCalledTimes(1);
    expect(tx.couponUsage.updateMany).toHaveBeenCalledWith({
      where: {
        couponId: { in: ["coupon-1", "coupon-2"] },
        userId: "user-1",
        status: "RESERVED",
      },
      data: {
        status: "RELEASED",
        releasedAt: now,
        confirmedAt: null,
      },
    });
    expect(tx.couponUsage.createMany).toHaveBeenCalledWith({
      data: [
        {
          couponId: "coupon-1",
          bookingId: "booking-1",
          userId: "user-1",
          status: "RESERVED",
          discountAmount: 100,
          confirmedAt: null,
        },
        {
          couponId: "coupon-2",
          bookingId: "booking-1",
          userId: "user-1",
          status: "RESERVED",
          discountAmount: 200,
          confirmedAt: null,
        },
      ],
    });
    expect(tx.couponUsage.upsert).not.toHaveBeenCalled();
  });

  it("replaces booking coupon usages and upserts the new set for replace mode", async () => {
    await persistAdminBookingCoupons({
      tx: tx as never,
      bookingId: "booking-2",
      userId: "user-2",
      coupons,
      status: "CONFIRMED",
      now,
      mode: "replace",
    });

    expect(tx.couponUsage.updateMany).toHaveBeenCalledTimes(1);
    expect(tx.couponUsage.updateMany).toHaveBeenCalledWith({
      where: {
        bookingId: "booking-2",
        status: {
          in: ["RESERVED", "CONFIRMED"],
        },
      },
      data: {
        status: "RELEASED",
        releasedAt: now,
        confirmedAt: null,
      },
    });
    expect(tx.couponUsage.upsert).toHaveBeenCalledTimes(2);
    expect(tx.couponUsage.createMany).not.toHaveBeenCalled();
  });
});
