import { describe, expect, it } from "vitest";

import {
  areCouponsCompatible,
  buildCouponCombinationConflictMessage,
  findCouponCombinationConflict,
  findCouponCombinationPairConflict,
} from "@/services/coupon/coupon-combination";

function buildCoupon(
  patch: Partial<{
    id: string;
    code: string;
    isStackable: boolean;
    stackableCouponIds: string[];
  }> = {}
) {
  return {
    id: "coupon-a",
    code: "COUPONA",
    isStackable: true,
    stackableCouponIds: [],
    ...patch,
  };
}

describe("coupon combination rules", () => {
  it("allows two stackable coupons when neither has a restriction list", () => {
    expect(
      areCouponsCompatible(
        buildCoupon({ id: "coupon-a", code: "A" }),
        buildCoupon({ id: "coupon-b", code: "B" })
      )
    ).toBe(true);
  });

  it("blocks combinations when a coupon is not stackable", () => {
    const conflict = findCouponCombinationConflict(
      buildCoupon({ id: "coupon-a", code: "A", isStackable: false }),
      [buildCoupon({ id: "coupon-b", code: "B" })]
    );

    expect(conflict?.code).toBe("B");
    expect(
      buildCouponCombinationConflictMessage(
        buildCoupon({ id: "coupon-a", code: "A", isStackable: false }),
        conflict
      )
    ).toBe("This coupon cannot be used together with other coupons.");
  });

  it("mentions only the other coupon code when a restricted stackable pair conflicts", () => {
    expect(
      buildCouponCombinationConflictMessage(
        buildCoupon({
          id: "coupon-a",
          code: "A",
          stackableCouponIds: ["coupon-c"],
        }),
        buildCoupon({
          id: "coupon-b",
          code: "B",
        })
      )
    ).toBe("This coupon cannot be used together with B.");
  });

  it("requires explicit allow-list compatibility when selected coupons are configured", () => {
    expect(
      areCouponsCompatible(
        buildCoupon({
          id: "coupon-a",
          code: "A",
          stackableCouponIds: ["coupon-b"],
        }),
        buildCoupon({
          id: "coupon-b",
          code: "B",
          stackableCouponIds: ["coupon-a"],
        })
      )
    ).toBe(true);

    expect(
      areCouponsCompatible(
        buildCoupon({
          id: "coupon-a",
          code: "A",
          stackableCouponIds: ["coupon-c"],
        }),
        buildCoupon({
          id: "coupon-b",
          code: "B",
        })
      )
    ).toBe(false);
  });

  it("finds the first conflicting pair in a multi-coupon selection", () => {
    const conflict = findCouponCombinationPairConflict([
      buildCoupon({ id: "coupon-a", code: "A" }),
      buildCoupon({
        id: "coupon-b",
        code: "B",
        stackableCouponIds: ["coupon-c"],
      }),
      buildCoupon({ id: "coupon-c", code: "C" }),
    ]);

    expect(conflict).toMatchObject({
      coupon: { code: "A" },
      otherCoupon: { code: "B" },
    });
  });
});
