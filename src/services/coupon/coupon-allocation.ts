import type { CouponItemDiscount } from "./coupon.types";

export type CouponAllocationItem<T> = T & {
  discountAmount: number;
  itemDiscounts?: CouponItemDiscount[];
};

export function allocateCouponsInOrder<
  T extends {
    discountAmount: number;
    itemDiscounts?: CouponItemDiscount[];
  }
>(items: T[], maxDiscountAllowed: number) {
  let remainingOrderDiscount = Math.max(Number(maxDiscountAllowed) || 0, 0);
  const consumedProductItemKeys = new Set<string>();

  const allocatedItems = items.map((item) => {
    if (!item.itemDiscounts || item.itemDiscounts.length === 0) {
      const requested = Math.max(Number(item.discountAmount) || 0, 0);
      const discountAmount = Math.min(requested, remainingOrderDiscount);
      remainingOrderDiscount = Math.max(remainingOrderDiscount - discountAmount, 0);
      return {
        ...item,
        discountAmount,
      };
    }

    const nextItemDiscounts: CouponItemDiscount[] = [];
    let allocatedCouponDiscount = 0;

    for (const line of item.itemDiscounts) {
      if (consumedProductItemKeys.has(line.itemKey)) continue;

      const requestedLineDiscount = Math.max(Number(line.discountAmount) || 0, 0);
      const lineDiscount = Math.min(requestedLineDiscount, remainingOrderDiscount);
      if (lineDiscount <= 0) continue;

      nextItemDiscounts.push({
        ...line,
        discountAmount: lineDiscount,
      });
      allocatedCouponDiscount += lineDiscount;
      remainingOrderDiscount = Math.max(remainingOrderDiscount - lineDiscount, 0);
      consumedProductItemKeys.add(line.itemKey);
    }

    return {
      ...item,
      discountAmount: allocatedCouponDiscount,
      itemDiscounts: nextItemDiscounts,
    };
  });

  return {
    totalDiscount: allocatedItems.reduce(
      (sum, item) => sum + Math.max(Number(item.discountAmount) || 0, 0),
      0
    ),
    items: allocatedItems as CouponAllocationItem<T>[],
  };
}
