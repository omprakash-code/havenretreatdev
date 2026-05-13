import { describe, expect, it } from "vitest";

import {
  SLOT_ONLY_DB_SCOPE,
  isSlotOnlyCouponScope,
  toDbCouponScope,
  toUiCouponScope,
} from "@/lib/coupon-scope";

describe("coupon scope mapping", () => {
  it("treats persisted EXTRAS_ONLY as slot-only business scope", () => {
    expect(isSlotOnlyCouponScope(SLOT_ONLY_DB_SCOPE)).toBe(true);
    expect(toUiCouponScope(SLOT_ONLY_DB_SCOPE)).toBe("SLOT_ONLY");
  });

  it("maps slot-only UI input back to the persisted DB scope", () => {
    expect(toDbCouponScope("SLOT_ONLY")).toBe(SLOT_ONLY_DB_SCOPE);
    expect(toDbCouponScope("EXTRAS_ONLY")).toBe(SLOT_ONLY_DB_SCOPE);
  });
});
