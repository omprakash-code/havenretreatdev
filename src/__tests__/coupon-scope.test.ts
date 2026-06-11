import { describe, expect, it } from "vitest";

import {
  PACKAGE_ONLY_DB_SCOPE,
  isSlotOnlyCouponScope,
  toDbCouponScope,
  toUiCouponScope,
} from "@/lib/coupon-scope";

describe("coupon scope mapping", () => {
  it("treats persisted EXTRAS_ONLY as slot-only business scope", () => {
    expect(isSlotOnlyCouponScope(PACKAGE_ONLY_DB_SCOPE)).toBe(true);
    expect(toUiCouponScope(PACKAGE_ONLY_DB_SCOPE)).toBe("PACKAGE_ONLY");
  });

  it("maps slot-only UI input back to the persisted DB scope", () => {
    expect(toDbCouponScope("PACKAGE_ONLY")).toBe(PACKAGE_ONLY_DB_SCOPE);
    expect(toDbCouponScope("EXTRAS_ONLY")).toBe(PACKAGE_ONLY_DB_SCOPE);
  });
});
