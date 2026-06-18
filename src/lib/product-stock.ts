/**
 * Shared add-on stock / per-booking limit logic.
 *
 * Stock semantics (ProductVariant.stock):
 *   - null      -> unlimited / untracked (daily-repeat event services)
 *   - 0         -> out of stock (explicitly unavailable)
 *   - positive  -> tracked inventory, N units remaining
 *
 * Per-booking cap (ProductVariant.maxPerBooking):
 *   - null / <= 0 -> no per-booking cap
 *   - positive    -> the most units a single booking may include
 */

export type VariantStockInput = {
  stock?: number | null;
  maxPerBooking?: number | null;
};

/** True when the variant is not inventory-tracked (sells unlimited times). */
export function isVariantUnlimited(stock?: number | null): boolean {
  return stock === null || stock === undefined;
}

/** True when the variant is inventory-tracked and currently depleted. */
export function isVariantOutOfStock(stock?: number | null): boolean {
  return !isVariantUnlimited(stock) && Number(stock) <= 0;
}

/**
 * Maximum quantity a single booking may add for this variant.
 * Returns 0 when out of stock, or Number.POSITIVE_INFINITY when truly uncapped
 * (unlimited stock AND no per-booking cap).
 */
export function getVariantMaxAllowed(variant: VariantStockInput): number {
  if (isVariantOutOfStock(variant.stock)) return 0;

  const perBookingCap =
    typeof variant.maxPerBooking === "number" && variant.maxPerBooking > 0
      ? variant.maxPerBooking
      : Number.POSITIVE_INFINITY;

  const stockCap = isVariantUnlimited(variant.stock)
    ? Number.POSITIVE_INFINITY
    : Number(variant.stock);

  return Math.min(perBookingCap, stockCap);
}
