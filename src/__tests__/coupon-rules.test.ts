import { describe, expect, it } from "vitest";
import { evaluateRule } from "@/services/coupon/coupon-rules";
import type { CouponEvaluationContext, CouponRuleEntity } from "@/services/coupon/coupon.types";

function buildContext(
  patch: Partial<CouponEvaluationContext> = {}
): CouponEvaluationContext {
  return {
    slot: {
      id: "slot_1",
      date: new Date("2026-02-26T00:00:00.000Z"),
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
      bookingSubtotal: 1000,
      bookingTotal: 1000,
      slotAmount: 1000,
      slotTotal: 1000,
      nonSlotAmount: 0,
      productsTotal: 0,
      extrasTotal: 0,
    },
    ...patch,
  };
}

describe("coupon rule evaluator", () => {
  it("supports same-day SLOT_DATE_RANGE boundaries", () => {
    const rule = {
      id: "rule_date_same_day",
      couponId: "coupon_1",
      type: "SLOT_DATE_RANGE",
      operator: "BETWEEN",
      value: { from: "2026-03-04", to: "2026-03-04" },
    } satisfies CouponRuleEntity;
    const context = buildContext({
      slot: {
        id: "slot_same_day",
        date: new Date("2026-03-04T09:00:00.000Z"),
        startTime: "13:30",
        endTime: "16:30",
        durationMin: 180,
      },
    });

    expect(evaluateRule(rule, context)).toBe(true);
  });

  it("requires SLOT_TIME_RANGE to fully contain slot timing", () => {
    const rule = {
      id: "rule_1",
      couponId: "coupon_1",
      type: "SLOT_TIME_RANGE",
      operator: "BETWEEN",
      value: { start: "09:00", end: "16:00" },
    } satisfies CouponRuleEntity;
    const context = buildContext({
      slot: {
        id: "slot_2",
        date: new Date("2026-02-26T00:00:00.000Z"),
        startTime: "13:30",
        endTime: "16:30",
        durationMin: 180,
      },
    });

    expect(evaluateRule(rule, context)).toBe(false);
  });

  it("passes SLOT_TIME_RANGE when slot fully fits inside range", () => {
    const rule = {
      id: "rule_2",
      couponId: "coupon_1",
      type: "SLOT_TIME_RANGE",
      operator: "BETWEEN",
      value: { start: "09:00", end: "16:00" },
    } satisfies CouponRuleEntity;
    const context = buildContext({
      slot: {
        id: "slot_3",
        date: new Date("2026-02-26T00:00:00.000Z"),
        startTime: "13:30",
        endTime: "15:30",
        durationMin: 120,
      },
    });

    expect(evaluateRule(rule, context)).toBe(true);
  });

  it("treats CATEGORY NOT_IN as valid when no products are selected", () => {
    const rule = {
      id: "rule_3",
      couponId: "coupon_1",
      type: "CATEGORY",
      operator: "NOT_IN",
      value: ["CAKE"],
    } satisfies CouponRuleEntity;
    const context = buildContext({ items: [] });

    expect(evaluateRule(rule, context)).toBe(true);
  });

  it("fails CATEGORY NOT_IN when excluded category exists", () => {
    const rule = {
      id: "rule_4",
      couponId: "coupon_1",
      type: "CATEGORY",
      operator: "NOT_IN",
      value: ["CAKE"],
    } satisfies CouponRuleEntity;
    const context = buildContext({
      items: [
        {
          productId: "p_cake",
          category: "CAKE",
          totalPrice: 399,
        },
      ],
    });

    expect(evaluateRule(rule, context)).toBe(false);
  });

  it("supports DECORATION_REQUIRED booking flag rules", () => {
    const rule = {
      id: "rule_5",
      couponId: "coupon_1",
      type: "DECORATION_REQUIRED",
      operator: "EQUALS",
      value: true,
    } satisfies CouponRuleEntity;
    const context = buildContext({
      booking: {
        decorationRequired: true,
      },
    });

    expect(evaluateRule(rule, context)).toBe(true);
  });

  it("supports SLOT_DURATION_MIN rules from slot duration", () => {
    const rule = {
      id: "rule_6",
      couponId: "coupon_1",
      type: "SLOT_DURATION_MIN",
      operator: "IN",
      value: ["90", "180"],
    } satisfies CouponRuleEntity;
    const context = buildContext({
      slot: {
        id: "slot_4",
        date: new Date("2026-02-26T00:00:00.000Z"),
        startTime: "10:00",
        endTime: "13:00",
        durationMin: 180,
      },
    });

    expect(evaluateRule(rule, context)).toBe(true);
  });
});
