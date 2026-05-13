import { describe, expect, it } from "vitest";
import { buildRuleNotSatisfiedMessage } from "@/services/coupon/coupon-messages";
import type { CouponEntity, CouponRuleEntity } from "@/services/coupon/coupon.types";

function buildCoupon(
  patch: Partial<CouponEntity & { rules: CouponRuleEntity[] }> = {}
): CouponEntity & { rules: CouponRuleEntity[] } {
  return {
    id: "coupon_1",
    code: "WELCOME400",
    discountType: "FLAT",
    discountValue: 400,
    maxDiscount: null,
    isStackable: false,
    stackableCouponIds: [],
    validFrom: new Date("2026-03-01T00:00:00.000Z"),
    validTill: new Date("2026-03-31T23:59:59.000Z"),
    scope: "BOOKING_TOTAL",
    usageLimit: null,
    perUserUsageLimit: null,
    minimumAmount: null,
    locationId: null,
    isActive: true,
    isDeleted: false,
    rules: [],
    ...patch,
  };
}

describe("coupon rule rejection messages", () => {
  it("explains decoration-required coupons", () => {
    const message = buildRuleNotSatisfiedMessage(
      buildCoupon({
        rules: [
          {
            id: "rule_1",
            couponId: "coupon_1",
            type: "DECORATION_REQUIRED",
            operator: "EQUALS",
            value: true,
          },
        ],
      })
    );

    expect(message).toBe(
      "This coupon is available only when decoration is selected for the booking."
    );
  });

  it("explains required cart categories", () => {
    const message = buildRuleNotSatisfiedMessage(
      buildCoupon({
        rules: [
          {
            id: "rule_2",
            couponId: "coupon_1",
            type: "CATEGORY",
            operator: "IN",
            value: ["CAKE", "DECORATION"],
          },
        ],
      })
    );

    expect(message).toBe(
      "This coupon is available only when your cart includes cake and decoration."
    );
  });

  it("uses the actual failed rule instead of a different coupon rule", () => {
    const coupon = buildCoupon({
      rules: [
        {
          id: "rule_1",
          couponId: "coupon_1",
          type: "DECORATION_REQUIRED",
          operator: "EQUALS",
          value: true,
        },
        {
          id: "rule_2",
          couponId: "coupon_1",
          type: "SLOT_DATE_RANGE",
          operator: "BETWEEN",
          value: {
            from: "2026-03-20",
            to: "2026-03-22",
          },
        },
      ],
    });

    const message = buildRuleNotSatisfiedMessage(coupon, {
      failedRule: coupon.rules[1],
    });

    expect(message).toBe("This coupon is not valid for the selected date.");
  });

  it("falls back to the generic booking-details message", () => {
    const message = buildRuleNotSatisfiedMessage(buildCoupon());
    expect(message).toBe("This coupon is not valid for the selected booking details.");
  });
});
