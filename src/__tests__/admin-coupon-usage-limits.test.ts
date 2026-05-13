import { describe, expect, it } from "vitest";

import { evaluateAdminCoupons } from "@/app/api/admin/bookings/_coupon";

function createCouponUsageCountTxMock({
  resolvedUserId,
}: {
  resolvedUserId: string | null;
}) {
  return {
    coupon: {
      findMany: async () => [
        {
          id: "coupon-1",
          code: "SAVE100",
          discountType: "FLAT",
          discountValue: 100,
          maxDiscount: null,
          isStackable: false,
          stackableCouponIds: [],
          validFrom: new Date("2026-01-01T00:00:00.000Z"),
          validTill: null,
          scope: "BOOKING_TOTAL",
          usageLimit: null,
          perUserUsageLimit: 1,
          minimumAmount: null,
          locationId: null,
          isActive: true,
          isDeleted: false,
          rules: [],
        },
      ],
    },
    user: {
      findUnique: async () => (resolvedUserId ? { id: resolvedUserId } : null),
    },
    couponUsage: {
      groupBy: async ({
        where,
      }: {
        where: { couponId: { in: string[] }; status: string };
      }) => {
        if (where.status === "CONFIRMED") {
          return [{ couponId: "coupon-1", _count: { _all: 1 } }];
        }
        return [];
      },
      findMany: async () => [{ couponId: "coupon-1" }],
    },
  };
}

const sharedInput = {
  couponCode: "SAVE100",
  slot: {
    id: "slot-1",
    date: new Date("2026-03-25T00:00:00.000Z"),
    startTime: "10:00",
    endTime: "11:30",
    durationMin: 90,
  },
  theatreId: "theatre-1",
  locationId: "loc-1",
  userPhone: "9876543210",
  decorationRequired: false,
  items: [],
  bookingSubtotal: 2000,
  slotAmount: 2000,
  nonSlotAmount: 0,
  productsTotal: 0,
  extrasTotal: 0,
  advanceFloor: 750,
};

describe("evaluateAdminCoupons usage limits", () => {
  it("enforces per-customer limit in admin flow using phone-linked user resolution", async () => {
    const tx = createCouponUsageCountTxMock({
      resolvedUserId: "user-1",
    });

    await expect(
      evaluateAdminCoupons(tx as never, {
        ...sharedInput,
        userId: null,
      })
    ).rejects.toMatchObject({
      code: "COUPON_NOT_APPLICABLE",
      message: "You’ve reached the usage limit for this coupon.",
    });
  });

  it("enforces per-customer limit in admin flow even when only confirmed phone-matched bookings exist", async () => {
    const tx = createCouponUsageCountTxMock({
      resolvedUserId: null,
    });

    await expect(
      evaluateAdminCoupons(tx as never, {
        ...sharedInput,
        userId: null,
      })
    ).rejects.toMatchObject({
      code: "COUPON_NOT_APPLICABLE",
      message: "You’ve reached the usage limit for this coupon.",
    });
  });
});
