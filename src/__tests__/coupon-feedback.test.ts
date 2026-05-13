import { describe, expect, it } from "vitest";
import { isCouponConditionMessage } from "@/lib/coupon-feedback";

describe("coupon feedback tone detection", () => {
  it("treats informational severity as help", () => {
    expect(
      isCouponConditionMessage({
        severity: "info",
        message:
          "This coupon is available only when decoration is selected for the booking.",
      })
    ).toBe(true);
  });

  it("detects newer guidance-style coupon messages", () => {
    expect(
      isCouponConditionMessage({
        message:
          "This coupon is available only when decoration is selected for the booking.",
      })
    ).toBe(true);

    expect(
      isCouponConditionMessage({
        message:
          "This coupon is available only when your cart includes cake and decoration.",
      })
    ).toBe(true);
  });

  it("treats admin-prefixed coupon guidance messages as informational", () => {
    expect(
      isCouponConditionMessage({
        message:
          "DS400: This coupon is available only when decoration is selected for the booking.",
      })
    ).toBe(true);

    expect(
      isCouponConditionMessage({
        message: "DS400: This coupon is not valid for the selected date.",
      })
    ).toBe(true);
  });
});
