import { calculateDiscountBreakdown } from "./coupon-discount";
import { resolveScopeBaseAmount } from "./coupon-amounts";
import {
  centsToMoney,
  percentOfMoney,
  toCents,
  toNonNegativeMoney,
} from "@/lib/money";
import type {
  CouponEntity,
  CouponEvaluationContext,
  CouponItemDiscount,
  CouponRuleEntity,
} from "./coupon.types";

type CouponWithRules = CouponEntity & { rules: CouponRuleEntity[] };
type CouponContextItem = CouponEvaluationContext["items"][number];

function toStringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((entry) => String(entry ?? "").trim())
      .filter((entry) => entry.length > 0);
  }

  const one = String(value ?? "").trim();
  return one ? [one] : [];
}

export function isTargetRule(
  rule: CouponRuleEntity
): rule is CouponRuleEntity & {
  type: "TARGET_CATEGORY" | "TARGET_PRODUCT_ID";
} {
  return rule.type === "TARGET_CATEGORY" || rule.type === "TARGET_PRODUCT_ID";
}

export function isEligibilityRule(rule: CouponRuleEntity) {
  return !isTargetRule(rule);
}

export function getTargetRules(coupon: CouponWithRules) {
  return coupon.rules.filter(isTargetRule);
}

export function hasTargetRules(coupon: CouponWithRules) {
  return getTargetRules(coupon).length > 0;
}

export function getTargetedItems(
  coupon: CouponWithRules,
  ctx: CouponEvaluationContext
): CouponContextItem[] {
  if (coupon.scope !== "PRODUCTS_ONLY") return [];

  const rules = getTargetRules(coupon);
  if (rules.length === 0) {
    return ctx.items.filter((item) => item.totalPrice > 0);
  }

  return ctx.items.filter((item) => {
    if (item.totalPrice <= 0) return false;

    return rules.some((rule) => {
      const values = toStringList(rule.value);
      if (values.length === 0) return false;

      if (rule.type === "TARGET_CATEGORY") {
        return values.includes(item.category);
      }

      return values.includes(item.productId);
    });
  });
}

export function resolveCouponBaseAmount(
  coupon: CouponWithRules,
  ctx: CouponEvaluationContext
) {
  if (coupon.scope !== "PRODUCTS_ONLY") {
    return resolveScopeBaseAmount(coupon.scope, ctx.amounts);
  }

  return getTargetedItems(coupon, ctx).reduce(
    (sum, item) => sum + Math.max(Number(item.totalPrice ?? 0), 0),
    0
  );
}

export function buildCouponItemDiscounts(
  coupon: CouponWithRules,
  ctx: CouponEvaluationContext
): CouponItemDiscount[] {
  if (coupon.scope !== "PRODUCTS_ONLY") return [];

  const targetedItems = getTargetedItems(coupon, ctx);
  if (targetedItems.length === 0) return [];

  if (coupon.discountType === "PERCENTAGE") {
    const requested = targetedItems.map((item, index) => ({
      itemKey: item.itemKey?.trim() || `${item.productId}:${index}`,
      productId: item.productId,
      category: item.category,
      discountAmount: centsToMoney(
        Math.min(
          toCents(percentOfMoney(item.totalPrice, coupon.discountValue)),
          toCents(toNonNegativeMoney(item.totalPrice))
        )
      ),
    }));

    let remainingCap =
      calculateDiscountBreakdown(
        {
          discountType: coupon.discountType,
          discountValue: coupon.discountValue,
          maxDiscount: coupon.maxDiscount,
        },
        targetedItems.reduce(
          (sum, item) =>
            centsToMoney(toCents(sum) + toCents(toNonNegativeMoney(item.totalPrice))),
          0
        )
      ).afterMaxDiscount;

    return requested
      .map((item) => {
        const discountAmount = Math.min(
          Math.max(item.discountAmount, 0),
          Math.max(remainingCap, 0)
        );
        remainingCap = centsToMoney(
          Math.max(toCents(remainingCap) - toCents(discountAmount), 0)
        );
        return {
          ...item,
          discountAmount,
        };
      })
      .filter((item) => item.discountAmount > 0);
  }

  let remainingFlat = toNonNegativeMoney(coupon.discountValue);
  return targetedItems
    .map((item, index) => {
      const discountAmount = centsToMoney(
        Math.min(
          toCents(toNonNegativeMoney(item.totalPrice)),
          toCents(toNonNegativeMoney(remainingFlat))
        )
      );
      remainingFlat = centsToMoney(
        Math.max(toCents(remainingFlat) - toCents(discountAmount), 0)
      );
      return {
        itemKey: item.itemKey?.trim() || `${item.productId}:${index}`,
        productId: item.productId,
        category: item.category,
        discountAmount,
      };
    })
    .filter((item) => item.discountAmount > 0);
}
