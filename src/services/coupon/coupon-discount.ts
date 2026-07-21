// src/services/coupon/coupon-discount.ts
import {
  centsToMoney,
  percentOfMoney,
  toCents,
  toNonNegativeMoney,
} from "@/lib/money";

export type CouponDiscountBreakdown = {
  rawDiscount: number;
  afterMaxDiscount: number;
  finalDiscount: number;
};

export function calculateDiscountBreakdown(
  coupon: {
    discountType: 'FLAT' | 'PERCENTAGE'
    discountValue: number
    maxDiscount?: number | null
  },
  baseAmount: number
): CouponDiscountBreakdown {
  if (baseAmount <= 0) {
    return {
      rawDiscount: 0,
      afterMaxDiscount: 0,
      finalDiscount: 0,
    };
  }

  if (coupon.discountType === 'FLAT') {
    const rawDiscount = toNonNegativeMoney(coupon.discountValue);
    const base = toNonNegativeMoney(baseAmount);
    return {
      rawDiscount,
      afterMaxDiscount: rawDiscount,
      finalDiscount: centsToMoney(Math.min(toCents(rawDiscount), toCents(base))),
    };
  }

  const rawDiscount = percentOfMoney(baseAmount, coupon.discountValue);

  const afterMaxDiscount = coupon.maxDiscount
    ? centsToMoney(
        Math.min(toCents(rawDiscount), toCents(toNonNegativeMoney(coupon.maxDiscount)))
      )
    : rawDiscount;

  return {
    rawDiscount,
    afterMaxDiscount,
    finalDiscount: centsToMoney(
      Math.min(toCents(afterMaxDiscount), toCents(baseAmount))
    ),
  };
}

export function calculateDiscount(
  coupon: {
    discountType: 'FLAT' | 'PERCENTAGE'
    discountValue: number
    maxDiscount?: number | null
  },
  baseAmount: number
): number {
  return calculateDiscountBreakdown(coupon, baseAmount).finalDiscount;
}
