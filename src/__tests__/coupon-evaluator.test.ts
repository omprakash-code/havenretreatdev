import { afterEach, describe, expect, it, vi } from "vitest";
import { evaluateCoupon } from "@/services/coupon/coupon-evaluator";
import {
  CouponEntity,
  CouponEvaluationContext,
  CouponRejectionReason,
  CouponRuleEntity,
} from "@/services/coupon/coupon.types";

function buildCoupon(
  patch: Partial<CouponEntity & { rules: CouponRuleEntity[] }> = {}
): CouponEntity & { rules: CouponRuleEntity[] } {
  return {
    id: "coupon_1",
    code: "HOLI300",
    discountType: "FLAT",
    discountValue: 300,
    maxDiscount: null,
    isStackable: true,
    stackableCouponIds: [],
    validFrom: new Date("2026-02-01T00:00:00.000Z"),
    validTill: new Date("2026-03-05T23:59:59.000Z"),
    scope: "BOOKING_TOTAL",
    usageLimit: null,
    perUserUsageLimit: null,
    locationId: null,
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
      id: "slot_1",
      date: new Date("2026-03-04T00:00:00.000Z"),
      startTime: "13:30",
      endTime: "16:30",
      durationMin: 180,
    },
    theatreId: "theatre_1",
    locationId: "location_1",
    user: {
      id: "user_1",
    },
    items: [],
    amounts: {
      bookingSubtotal: 1200,
      bookingTotal: 1200,
      slotAmount: 1200,
      slotTotal: 1200,
      nonSlotAmount: 0,
      productsTotal: 0,
      extrasTotal: 0,
    },
    ...patch,
  };
}

describe("coupon evaluator validity checks", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("rejects when slot timing is outside coupon validity even if now is inside window", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-20T10:00:00.000Z"));

    const coupon = buildCoupon({
      validFrom: new Date("2026-02-01T00:00:00.000Z"),
      validTill: new Date("2026-03-03T23:59:59.000Z"),
    });
    const context = buildContext({
      slot: {
        id: "slot_outside",
        date: new Date("2026-03-04T00:00:00.000Z"),
        startTime: "13:30",
        endTime: "16:30",
        durationMin: 180,
      },
    });

    const result = evaluateCoupon(coupon, context, {
      totalUsed: 0,
      usedByUser: 0,
    });

    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.reason).toBe(CouponRejectionReason.OUTSIDE_VALIDITY);
  });

  it("passes when now and slot timing both fall within validity window", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-20T10:00:00.000Z"));

    const coupon = buildCoupon({
      validFrom: new Date("2026-02-01T00:00:00.000Z"),
      validTill: new Date("2026-03-10T23:59:59.000Z"),
    });
    const context = buildContext({
      slot: {
        id: "slot_inside",
        date: new Date("2026-03-04T00:00:00.000Z"),
        startTime: "13:30",
        endTime: "16:30",
        durationMin: 180,
      },
    });

    const result = evaluateCoupon(coupon, context, {
      totalUsed: 0,
      usedByUser: 0,
    });

    expect(result.valid).toBe(true);
    if (!result.valid) return;
    expect(result.discountAmount).toBe(300);
  });

  it("treats a coupon without end date as open-ended after validFrom", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-20T10:00:00.000Z"));

    const coupon = buildCoupon({
      validFrom: new Date("2026-02-01T00:00:00.000Z"),
      validTill: null,
    });
    const context = buildContext({
      slot: {
        id: "slot_open_ended",
        date: new Date("2026-05-04T00:00:00.000Z"),
        startTime: "13:30",
        endTime: "16:30",
        durationMin: 180,
      },
    });

    const result = evaluateCoupon(coupon, context, {
      totalUsed: 0,
      usedByUser: 0,
    });

    expect(result.valid).toBe(true);
    if (!result.valid) return;
    expect(result.discountAmount).toBe(300);
  });

  it("rejects when minimum booking total is not met", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-20T10:00:00.000Z"));

    const coupon = buildCoupon({
      scope: "BOOKING_TOTAL",
      minimumAmount: 2000,
    });
    const context = buildContext({
      amounts: {
        bookingSubtotal: 1500,
        bookingTotal: 1500,
        slotAmount: 1200,
        slotTotal: 1200,
        nonSlotAmount: 300,
        productsTotal: 300,
        extrasTotal: 0,
      },
    });

    const result = evaluateCoupon(coupon, context, {
      totalUsed: 0,
      usedByUser: 0,
    });

    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.reason).toBe(CouponRejectionReason.MINIMUM_AMOUNT_NOT_MET);
  });

  it("rejects when minimum product total is not met", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-20T10:00:00.000Z"));

    const coupon = buildCoupon({
      scope: "PRODUCTS_ONLY",
      minimumAmount: 1500,
    });
    const context = buildContext({
      amounts: {
        bookingSubtotal: 2100,
        bookingTotal: 2100,
        slotAmount: 1200,
        slotTotal: 1200,
        nonSlotAmount: 900,
        productsTotal: 900,
        extrasTotal: 0,
      },
    });

    const result = evaluateCoupon(coupon, context, {
      totalUsed: 0,
      usedByUser: 0,
    });

    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.reason).toBe(CouponRejectionReason.MINIMUM_AMOUNT_NOT_MET);
  });

  it("uses slotAmount + productsTotal as BOOKING_TOTAL base", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-20T10:00:00.000Z"));

    const coupon = buildCoupon({
      discountType: "PERCENTAGE",
      discountValue: 50,
      maxDiscount: null,
      scope: "BOOKING_TOTAL",
    });
    const context = buildContext({
      amounts: {
        bookingSubtotal: 2149,
        bookingTotal: 1399,
        slotAmount: 2149,
        slotTotal: 2149,
        nonSlotAmount: 0,
        productsTotal: 0,
        extrasTotal: 0,
      },
    });

    const result = evaluateCoupon(coupon, context, {
      totalUsed: 0,
      usedByUser: 0,
    });

    expect(result.valid).toBe(true);
    if (!result.valid) return;
    expect(result.discountAmount).toBe(1074);
  });

  it("does not treat decoration/extras as PRODUCTS_ONLY base", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-20T10:00:00.000Z"));

    const coupon = buildCoupon({
      discountType: "PERCENTAGE",
      discountValue: 50,
      maxDiscount: null,
      scope: "PRODUCTS_ONLY",
    });
    const context = buildContext({
      amounts: {
        bookingSubtotal: 2349,
        bookingTotal: 2349,
        slotAmount: 1599,
        slotTotal: 1599,
        nonSlotAmount: 750, // decoration/extra only, no products
        productsTotal: 0,
        extrasTotal: 0,
      },
    });

    const result = evaluateCoupon(coupon, context, {
      totalUsed: 0,
      usedByUser: 0,
    });

    expect(result.valid).toBe(true);
    if (!result.valid) return;
    expect(result.discountAmount).toBe(0);
  });

  it("applies targeted product-category discount only to matched items", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-20T10:00:00.000Z"));

    const coupon = buildCoupon({
      discountType: "PERCENTAGE",
      discountValue: 25,
      maxDiscount: 1000,
      scope: "PRODUCTS_ONLY",
      rules: [
        {
          id: "rule_target_decoration",
          couponId: "coupon_1",
          type: "TARGET_CATEGORY",
          operator: "IN",
          value: ["DECORATION"],
        },
      ],
    });
    const context = buildContext({
      items: [
        {
          itemKey: "item_decor",
          productId: "decor_1",
          category: "DECORATION",
          totalPrice: 1000,
        },
        {
          itemKey: "item_cake",
          productId: "cake_1",
          category: "CAKE",
          totalPrice: 800,
        },
      ],
      amounts: {
        bookingSubtotal: 3000,
        bookingTotal: 3000,
        slotAmount: 1200,
        slotTotal: 1200,
        nonSlotAmount: 1800,
        productsTotal: 1800,
        extrasTotal: 0,
      },
    });

    const result = evaluateCoupon(coupon, context, {
      totalUsed: 0,
      usedByUser: 0,
    });

    expect(result.valid).toBe(true);
    if (!result.valid) return;
    expect(result.discountAmount).toBe(250);
    expect(result.itemDiscounts).toEqual([
      {
        itemKey: "item_decor",
        productId: "decor_1",
        category: "DECORATION",
        discountAmount: 250,
      },
    ]);
  });

  it("supports booking-total coupon only when cart includes both cake and decoration categories", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-20T10:00:00.000Z"));

    const coupon = buildCoupon({
      discountType: "PERCENTAGE",
      discountValue: 25,
      maxDiscount: 1000,
      scope: "BOOKING_TOTAL",
      rules: [
        {
          id: "rule_cake_required",
          couponId: "coupon_1",
          type: "CATEGORY",
          operator: "IN",
          value: ["CAKE"],
        },
        {
          id: "rule_decor_required",
          couponId: "coupon_1",
          type: "CATEGORY",
          operator: "IN",
          value: ["DECORATION"],
        },
      ],
    });

    const contextWithBoth = buildContext({
      items: [
        {
          itemKey: "item_decor",
          productId: "decor_1",
          category: "DECORATION",
          totalPrice: 1000,
        },
        {
          itemKey: "item_cake",
          productId: "cake_1",
          category: "CAKE",
          totalPrice: 800,
        },
      ],
      amounts: {
        bookingSubtotal: 3000,
        bookingTotal: 3000,
        slotAmount: 1200,
        slotTotal: 1200,
        nonSlotAmount: 1800,
        productsTotal: 1800,
        extrasTotal: 0,
      },
    });

    const validResult = evaluateCoupon(coupon, contextWithBoth, {
      totalUsed: 0,
      usedByUser: 0,
    });

    expect(validResult.valid).toBe(true);
    if (!validResult.valid) return;
    expect(validResult.discountAmount).toBe(750);

    const contextWithoutDecoration = buildContext({
      items: [
        {
          itemKey: "item_cake",
          productId: "cake_1",
          category: "CAKE",
          totalPrice: 800,
        },
      ],
      amounts: {
        bookingSubtotal: 2000,
        bookingTotal: 2000,
        slotAmount: 1200,
        slotTotal: 1200,
        nonSlotAmount: 800,
        productsTotal: 800,
        extrasTotal: 0,
      },
    });

    const invalidResult = evaluateCoupon(coupon, contextWithoutDecoration, {
      totalUsed: 0,
      usedByUser: 0,
    });

    expect(invalidResult.valid).toBe(false);
    if (invalidResult.valid) return;
    expect(invalidResult.reason).toBe(CouponRejectionReason.RULE_NOT_SATISFIED);
  });

  it("rejects coupon when decoration selection restriction does not match booking", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-20T10:00:00.000Z"));

    const coupon = buildCoupon({
      discountType: "FLAT",
      discountValue: 400,
      scope: "BOOKING_TOTAL",
      rules: [
        {
          id: "rule_decor_yes_required",
          couponId: "coupon_1",
          type: "DECORATION_REQUIRED",
          operator: "EQUALS",
          value: true,
        },
      ],
    });

    const invalidResult = evaluateCoupon(
      coupon,
      buildContext({
        booking: {
          decorationRequired: false,
        },
      }),
      {
        totalUsed: 0,
        usedByUser: 0,
      }
    );

    expect(invalidResult.valid).toBe(false);
    if (invalidResult.valid) return;
    expect(invalidResult.reason).toBe(CouponRejectionReason.RULE_NOT_SATISFIED);
    expect(invalidResult.failedRule?.type).toBe("DECORATION_REQUIRED");

    const validResult = evaluateCoupon(
      coupon,
      buildContext({
        booking: {
          decorationRequired: true,
        },
      }),
      {
        totalUsed: 0,
        usedByUser: 0,
      }
    );

    expect(validResult.valid).toBe(true);
    if (!validResult.valid) return;
    expect(validResult.discountAmount).toBe(400);
  });
});
