import { describe, expect, it } from "vitest";

import {
  getStackableCouponUiState,
  shouldEnableLimitStackableCoupons,
  shouldLoadStackableCouponsOptions,
  shouldLoadTargetProductsOptions,
} from "@/components/admin/coupons/drawer/tabs/basicsTab.helpers";

describe("coupon drawer basics tab helpers", () => {
  it("excludes the current coupon from stackable coupon options", () => {
    const result = getStackableCouponUiState({
      coupons: [
        { id: "coupon_1", code: "SELF", isActive: true },
        { id: "coupon_2", code: "OTHER", isActive: true },
      ],
      currentCouponId: "coupon_1",
      selectedStackableCouponIds: [],
    });

    expect(result.stackableCouponOptions).toEqual([
      { value: "coupon_2", label: "OTHER" },
    ]);
    expect(result.canLimitStackableCoupons).toBe(true);
  });

  it("keeps limit UI available when saved coupon selections exist", () => {
    const result = getStackableCouponUiState({
      coupons: [],
      currentCouponId: "coupon_1",
      selectedStackableCouponIds: ["coupon_2"],
    });

    expect(result.canLimitStackableCoupons).toBe(true);
  });

  it("enables limited stackable UI only when coupon is stackable and has selected coupons", () => {
    expect(
      shouldEnableLimitStackableCoupons({
        isStackable: true,
        stackableCouponIds: ["coupon_2"],
        canLimitStackableCoupons: true,
      })
    ).toBe(true);

    expect(
      shouldEnableLimitStackableCoupons({
        isStackable: true,
        stackableCouponIds: [],
        canLimitStackableCoupons: true,
      })
    ).toBe(false);
  });

  it("loads products only for target product mode when products are missing", () => {
    expect(
      shouldLoadTargetProductsOptions({
        applyDiscountOn: "TARGET_PRODUCT_ID",
        productsCount: 0,
      })
    ).toBe(true);

    expect(
      shouldLoadTargetProductsOptions({
        applyDiscountOn: "TARGET_CATEGORY",
        productsCount: 0,
      })
    ).toBe(false);
  });

  it("loads stackable coupon options only when stackable is enabled and coupons are missing", () => {
    expect(
      shouldLoadStackableCouponsOptions({
        isStackable: true,
        couponsCount: 0,
      })
    ).toBe(true);

    expect(
      shouldLoadStackableCouponsOptions({
        isStackable: false,
        couponsCount: 0,
      })
    ).toBe(false);
  });
});
