export type CappedDiscountItem<T> = T & {
  discountAmount: number;
};

export function applyDiscountCapInOrder<T extends { discountAmount: number }>(
  items: T[],
  maxDiscountAllowed: number
): {
  totalDiscount: number;
  items: CappedDiscountItem<T>[];
} {
  let remaining = Math.max(Number(maxDiscountAllowed) || 0, 0);

  const cappedItems = items.map((item) => {
    const requested = Math.max(Number(item.discountAmount) || 0, 0);
    const discountAmount = Math.min(requested, remaining);
    remaining = Math.max(remaining - discountAmount, 0);

    return {
      ...item,
      discountAmount,
    };
  });

  return {
    totalDiscount: cappedItems.reduce(
      (sum, item) => sum + item.discountAmount,
      0
    ),
    items: cappedItems,
  };
}
