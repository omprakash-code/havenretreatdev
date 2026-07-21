import { describe, expect, it } from "vitest";

import { calculateDiscountBreakdown } from "@/services/coupon/coupon-discount";

describe("coupon discount decimal money", () => {
  it("preserves cents for flat coupons", () => {
    const discount = calculateDiscountBreakdown(
      {
        discountType: "FLAT",
        discountValue: 19.95,
        maxDiscount: null,
      },
      250.5
    );

    expect(discount.rawDiscount).toBe(19.95);
    expect(discount.afterMaxDiscount).toBe(19.95);
    expect(discount.finalDiscount).toBe(19.95);
  });

  it("floors percentage coupons to the nearest cent", () => {
    const discount = calculateDiscountBreakdown(
      {
        discountType: "PERCENTAGE",
        discountValue: 12.5,
        maxDiscount: 99.99,
      },
      250.5
    );

    expect(discount.rawDiscount).toBe(31.31);
    expect(discount.afterMaxDiscount).toBe(31.31);
    expect(discount.finalDiscount).toBe(31.31);
  });
});
