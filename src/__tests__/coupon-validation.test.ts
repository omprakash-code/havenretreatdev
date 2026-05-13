import { describe, expect, it } from "vitest";
import {
  CouponValidationError,
  normalizeCouponPayload,
} from "@/services/coupon/coupon-validation";

describe("coupon payload validation", () => {
  it("normalizes valid flat coupon payload", () => {
    const normalized = normalizeCouponPayload({
      code: "  save_100  ",
      discountType: "FLAT",
      discountValue: 100,
      scope: "BOOKING_TOTAL",
      validFrom: "2026-01-01T00:00:00.000Z",
      validTill: "2026-12-31T00:00:00.000Z",
      isStackable: true,
      usageLimit: 100,
      perUserUsageLimit: 2,
      locationId: "loc_1",
      isActive: true,
      rules: [
        {
          type: "THEATRE_ID",
          operator: "IN",
          value: ["theatre_1", "theatre_2"],
        },
      ],
    });

    expect(normalized.code).toBe("SAVE_100");
    expect(normalized.maxDiscount).toBeNull();
    expect(normalized.discountValue).toBe(100);
    expect(normalized.rules).toHaveLength(1);
    expect(normalized.rules[0]).toMatchObject({
      type: "THEATRE_ID",
      operator: "IN",
      value: ["theatre_1", "theatre_2"],
    });
  });

  it("rejects invalid coupon code format", () => {
    expect(() =>
      normalizeCouponPayload({
        code: "x",
        discountType: "FLAT",
        discountValue: 100,
        validFrom: "2026-01-01T00:00:00.000Z",
        validTill: "2026-12-31T00:00:00.000Z",
      })
    ).toThrow(CouponValidationError);
  });

  it("requires discount value when left empty", () => {
    expect(() =>
      normalizeCouponPayload({
        code: "EMPTYDISC",
        discountType: "FLAT",
        discountValue: "",
        validFrom: "2026-01-01T00:00:00.000Z",
        validTill: "2026-12-31T00:00:00.000Z",
      })
    ).toThrow("Discount value is required.");
  });

  it("allows percentage coupons without a max discount cap", () => {
    const normalized = normalizeCouponPayload({
      code: "PCT50",
      discountType: "PERCENTAGE",
      discountValue: 50,
      maxDiscount: null,
      validFrom: "2026-01-01T00:00:00.000Z",
      validTill: "2026-12-31T00:00:00.000Z",
    });

    expect(normalized.maxDiscount).toBeNull();
  });

  it("allows coupons without an expiry date", () => {
    const normalized = normalizeCouponPayload({
      code: "NOEXPIRY",
      discountType: "FLAT",
      discountValue: 150,
      validFrom: "2026-01-01T00:00:00.000Z",
      validTill: null,
    });

    expect(normalized.validTill).toBeNull();
  });

  it("rejects per-user limit higher than global usage limit", () => {
    expect(() =>
      normalizeCouponPayload({
        code: "LIMIT50",
        discountType: "FLAT",
        discountValue: 50,
        validFrom: "2026-01-01T00:00:00.000Z",
        validTill: "2026-12-31T00:00:00.000Z",
        usageLimit: 3,
        perUserUsageLimit: 5,
      })
    ).toThrow("Per-user usage limit cannot exceed global usage limit.");
  });

  it("rejects invalid SLOT_DATE_RANGE value", () => {
    expect(() =>
      normalizeCouponPayload({
        code: "DATEOK",
        discountType: "FLAT",
        discountValue: 100,
        validFrom: "2026-01-01T00:00:00.000Z",
        validTill: "2026-12-31T00:00:00.000Z",
        rules: [
          {
            type: "SLOT_DATE_RANGE",
            operator: "BETWEEN",
            value: { from: "2026-03-10", to: "2026-03-01" },
          },
        ],
      })
    ).toThrow("SLOT_DATE_RANGE from date cannot be after to date.");
  });

  it("normalizes valid SLOT_DURATION_MIN rule values", () => {
    const normalized = normalizeCouponPayload({
      code: "SLOTDUR",
      discountType: "FLAT",
      discountValue: 100,
      validFrom: "2026-01-01T00:00:00.000Z",
      validTill: "2026-12-31T00:00:00.000Z",
      rules: [
        {
          type: "SLOT_DURATION_MIN",
          operator: "IN",
          value: ["90", "180"],
        },
      ],
    });

    expect(normalized.rules).toMatchObject([
      {
        type: "SLOT_DURATION_MIN",
        operator: "IN",
        value: ["90", "180"],
      },
    ]);
  });

  it("rejects invalid category value", () => {
    expect(() =>
      normalizeCouponPayload({
        code: "CATX",
        discountType: "FLAT",
        discountValue: 100,
        validFrom: "2026-01-01T00:00:00.000Z",
        validTill: "2026-12-31T00:00:00.000Z",
        rules: [
          {
            type: "CATEGORY",
            operator: "IN",
            value: ["FOOD"],
          },
        ],
      })
    ).toThrow("CATEGORY rule values must be CAKE/DECORATION/GIFT.");
  });

  it("maps SLOT_ONLY scope input to persisted EXTRAS_ONLY scope", () => {
    const normalized = normalizeCouponPayload({
      code: "SLOT300",
      discountType: "FLAT",
      discountValue: 300,
      scope: "SLOT_ONLY",
      validFrom: "2026-03-01T00:00:00.000Z",
      validTill: "2026-03-31T00:00:00.000Z",
    });

    expect(normalized.scope).toBe("EXTRAS_ONLY");
  });

  it("normalizes minimumAmount when provided", () => {
    const normalized = normalizeCouponPayload({
      code: "MIN2500",
      discountType: "FLAT",
      discountValue: 300,
      scope: "BOOKING_TOTAL",
      minimumAmount: 2500,
      validFrom: "2026-03-01T00:00:00.000Z",
      validTill: "2026-03-31T00:00:00.000Z",
    });

    expect(normalized.minimumAmount).toBe(2500);
  });

  it("normalizes selected stackable coupon ids", () => {
    const normalized = normalizeCouponPayload({
      code: "STACKPAIR",
      discountType: "FLAT",
      discountValue: 300,
      scope: "BOOKING_TOTAL",
      validFrom: "2026-03-01T00:00:00.000Z",
      validTill: "2026-03-31T00:00:00.000Z",
      isStackable: true,
      stackableCouponIds: [" coupon_a ", "coupon_b", "coupon_a"],
    });

    expect(normalized.isStackable).toBe(true);
    expect(normalized.stackableCouponIds).toEqual(["coupon_a", "coupon_b"]);
  });

  it("drops selected stackable coupon ids when combinations are disabled", () => {
    const normalized = normalizeCouponPayload({
      code: "STACKOFF",
      discountType: "FLAT",
      discountValue: 300,
      scope: "BOOKING_TOTAL",
      validFrom: "2026-03-01T00:00:00.000Z",
      validTill: "2026-03-31T00:00:00.000Z",
      isStackable: false,
      stackableCouponIds: ["coupon_a"],
    });

    expect(normalized.isStackable).toBe(false);
    expect(normalized.stackableCouponIds).toEqual([]);
  });

  it("rejects negative minimumAmount", () => {
    expect(() =>
      normalizeCouponPayload({
        code: "MINNEG",
        discountType: "FLAT",
        discountValue: 300,
        scope: "BOOKING_TOTAL",
        minimumAmount: -50,
        validFrom: "2026-03-01T00:00:00.000Z",
        validTill: "2026-03-31T00:00:00.000Z",
      })
    ).toThrow("Minimum amount must be a positive integer.");
  });

  it("normalizes decoration-required and target-category rules", () => {
    const normalized = normalizeCouponPayload({
      code: "DECOR25",
      discountType: "PERCENTAGE",
      discountValue: 25,
      maxDiscount: 500,
      scope: "PRODUCTS_ONLY",
      validFrom: "2026-03-01T00:00:00.000Z",
      validTill: "2026-03-31T00:00:00.000Z",
      rules: [
        {
          type: "DECORATION_REQUIRED",
          operator: "EQUALS",
          value: "yes",
        },
        {
          type: "TARGET_CATEGORY",
          operator: "IN",
          value: ["DECORATION"],
        },
      ],
    });

    expect(normalized.rules).toMatchObject([
      {
        type: "DECORATION_REQUIRED",
        operator: "EQUALS",
        value: true,
      },
      {
        type: "TARGET_CATEGORY",
        operator: "IN",
        value: ["DECORATION"],
      },
    ]);
  });

  it("rejects target rules outside Products Only scope", () => {
    expect(() =>
      normalizeCouponPayload({
        code: "BADTARGET",
        discountType: "FLAT",
        discountValue: 200,
        scope: "BOOKING_TOTAL",
        validFrom: "2026-03-01T00:00:00.000Z",
        validTill: "2026-03-31T00:00:00.000Z",
        rules: [
          {
            type: "TARGET_PRODUCT_ID",
            operator: "IN",
            value: ["prod_1"],
          },
        ],
      })
    ).toThrow(
      "Target product/category rules can be used only with Products Only scope."
    );
  });

  it("rejects empty target category selection", () => {
    expect(() =>
      normalizeCouponPayload({
        code: "EMPTYCAT",
        discountType: "PERCENTAGE",
        discountValue: 25,
        maxDiscount: 500,
        scope: "PRODUCTS_ONLY",
        validFrom: "2026-03-01T00:00:00.000Z",
        validTill: "2026-03-31T00:00:00.000Z",
        rules: [
          {
            type: "TARGET_CATEGORY",
            operator: "IN",
            value: [],
          },
        ],
      })
    ).toThrow("TARGET_CATEGORY requires at least one value.");
  });

  it("rejects empty target product selection", () => {
    expect(() =>
      normalizeCouponPayload({
        code: "EMPTYPROD",
        discountType: "FLAT",
        discountValue: 250,
        scope: "PRODUCTS_ONLY",
        validFrom: "2026-03-01T00:00:00.000Z",
        validTill: "2026-03-31T00:00:00.000Z",
        rules: [
          {
            type: "TARGET_PRODUCT_ID",
            operator: "IN",
            value: [],
          },
        ],
      })
    ).toThrow("TARGET_PRODUCT_ID requires at least one value.");
  });
});
