import { describe, expect, it } from "vitest";

import { buildCouponDebugSnapshot } from "@/services/coupon/coupon-debug";
import {
  CouponRejectionReason,
  type CouponEntity,
  type CouponEvaluationContext,
  type CouponEvaluationResult,
  type CouponRuleEntity,
} from "@/services/coupon/coupon.types";

function buildCoupon(
  patch: Partial<CouponEntity & { rules: CouponRuleEntity[] }> = {}
): CouponEntity & { rules: CouponRuleEntity[] } {
  return {
    id: "coupon_1",
    code: "SAVE300",
    discountType: "FLAT",
    discountValue: 300,
    maxDiscount: null,
    isStackable: true,
    stackableCouponIds: [],
    validFrom: new Date("2026-01-01T00:00:00.000Z"),
    validTill: new Date("2026-12-31T23:59:59.000Z"),
    scope: "PRODUCTS_ONLY",
    usageLimit: 20,
    perUserUsageLimit: 2,
    minimumAmount: 500,
    locationId: "location-1",
    isActive: true,
    isDeleted: false,
    rules: [],
    ...patch,
  };
}

function buildContext(
  patch: Partial<CouponEvaluationContext> = {}
): CouponEvaluationContext {
  return {
    slot: {
      id: "slot-1",
      date: new Date("2026-04-01T00:00:00.000Z"),
      startTime: "10:00",
      endTime: "11:00",
      durationMin: 60,
    },
    theatreId: "theatre-1",
    locationId: "location-1",
    user: {
      id: "user-1",
      phone: "9876543210",
    },
    booking: {
      decorationRequired: false,
    },
    items: [
      {
        itemKey: "item-1",
        productId: "product-1",
        category: "CAKE",
        totalPrice: 900,
      },
      {
        itemKey: "item-2",
        productId: "product-2",
        category: "GIFT",
        totalPrice: 400,
      },
    ],
    amounts: {
      bookingSubtotal: 2400,
      bookingTotal: 2400,
      slotAmount: 1100,
      slotTotal: 1100,
      nonSlotAmount: 1300,
      productsTotal: 1300,
      extrasTotal: 0,
    },
    ...patch,
  };
}

describe("buildCouponDebugSnapshot", () => {
  it("captures matched item and usage diagnostics for valid coupons", () => {
    const coupon = buildCoupon();
    const context = buildContext();
    const result: CouponEvaluationResult = {
      valid: true,
      couponId: coupon.id,
      couponCode: coupon.code,
      discountAmount: 300,
      scope: coupon.scope,
      isStackable: true,
      itemDiscounts: [
        {
          itemKey: "item-1",
          productId: "product-1",
          category: "CAKE",
          discountAmount: 300,
        },
      ],
    };

    const debug = buildCouponDebugSnapshot({
      coupon,
      context,
      result,
      usage: {
        totalUsed: 4,
        usedByUser: 1,
      },
      outcome: "APPLIED",
      finalDiscountAmount: 250,
    });

    expect(debug).toMatchObject({
      couponId: "coupon_1",
      code: "SAVE300",
      scope: "PRODUCTS_ONLY",
      outcome: "APPLIED",
      scopeBaseAmount: 1300,
      bookingSubtotal: 2400,
      requestedDiscountAmount: 300,
      finalDiscountAmount: 250,
      itemDiscountCount: 1,
      matchedItemKeys: ["item-1"],
      matchedProductIds: ["product-1"],
      usage: {
        totalConfirmed: 4,
        confirmedByUser: 1,
        usageLimit: 20,
        perUserUsageLimit: 2,
      },
      minimumAmount: 500,
    });
  });

  it("captures rejection details for invalid coupons", () => {
    const coupon = buildCoupon({
      scope: "BOOKING_TOTAL",
    });
    const context = buildContext();
    const result: CouponEvaluationResult = {
      valid: false,
      reason: CouponRejectionReason.MINIMUM_AMOUNT_NOT_MET,
    };

    const debug = buildCouponDebugSnapshot({
      coupon,
      context,
      result,
      usage: {
        totalUsed: 0,
        usedByUser: 0,
      },
      outcome: "REJECTED",
      message: "Need a higher booking total.",
    });

    expect(debug).toMatchObject({
      couponId: "coupon_1",
      outcome: "REJECTED",
      rejectionReason: "MINIMUM_AMOUNT_NOT_MET",
      message: "Need a higher booking total.",
      requestedDiscountAmount: 0,
      finalDiscountAmount: 0,
      itemDiscountCount: 0,
      matchedItemKeys: [],
      matchedProductIds: [],
    });
  });
});
