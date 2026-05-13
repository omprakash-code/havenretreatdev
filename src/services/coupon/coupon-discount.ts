// src/services/coupon/coupon-discount.ts

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
    const rawDiscount = Math.max(coupon.discountValue, 0);
    return {
      rawDiscount,
      afterMaxDiscount: rawDiscount,
      finalDiscount: Math.min(rawDiscount, baseAmount),
    };
  }

  const rawDiscount = Math.floor(
    (baseAmount * coupon.discountValue) / 100
  )

  const afterMaxDiscount = coupon.maxDiscount
    ? Math.min(rawDiscount, coupon.maxDiscount)
    : rawDiscount;

  return {
    rawDiscount,
    afterMaxDiscount,
    finalDiscount: Math.min(afterMaxDiscount, baseAmount),
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
