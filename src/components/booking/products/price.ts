import type { Variant } from "./types";

type PriceMeta = {
  displayPrice: number;
  regularPrice: number;
  salePrice: number | null;
  hasDiscount: boolean;
  savingsPercent: number;
};

export function getVariantPriceMeta(variant: Variant): PriceMeta {
  const regularPrice = Number(variant.regularPrice) || 0;
  const salePrice =
    variant.salePrice !== null &&
    variant.salePrice !== undefined &&
    Number(variant.salePrice) > 0
      ? Number(variant.salePrice)
      : null;

  const hasDiscount =
    salePrice !== null &&
    regularPrice > 0 &&
    salePrice < regularPrice;

  const displayPrice = hasDiscount ? salePrice : regularPrice;
  const savingsPercent = hasDiscount
    ? Math.round(((regularPrice - salePrice) / regularPrice) * 100)
    : 0;

  return {
    displayPrice,
    regularPrice,
    salePrice,
    hasDiscount,
    savingsPercent,
  };
}
