// A variant's effective base unit price: the sale price when one is set,
// otherwise the regular price. "Base" means before any duration overage is
// applied (see product-duration-pricing.ts).
//
// Note: the admin booking form intentionally keeps its own `salePrice ??
// regularPrice` resolution (getVariantPrice in admin/bookings/add/shared.ts),
// which treats a zero sale price as free instead of falling back — unifying
// that would change admin pricing behaviour.
export function resolveVariantBaseUnitPrice(variant: {
  regularPrice: unknown;
  salePrice?: unknown | null;
}) {
  const regularPrice = Number(variant.regularPrice) || 0;
  const salePrice =
    variant.salePrice !== null && variant.salePrice !== undefined
      ? Number(variant.salePrice)
      : null;
  return salePrice !== null && salePrice > 0 ? salePrice : regularPrice;
}
