// Live variant base unit prices (sale if set, else regular) for booking item
// snapshots, so clients can re-derive duration-adjusted prices from the
// current database price instead of a second hardcoded source of truth.

import { resolveVariantBaseUnitPrice } from "@/lib/variant-price";

type VariantPriceReader = {
  productVariant: {
    findMany: (args: {
      where: { id: { in: string[] } };
      select: { id: true; regularPrice: true; salePrice: true };
    }) => Promise<
      Array<{ id: string; regularPrice: number; salePrice: number | null }>
    >;
  };
};

export async function getVariantBaseUnitPriceMap(
  db: VariantPriceReader,
  variantIds: string[]
) {
  const uniqueIds = [...new Set(variantIds)].filter(Boolean);
  if (uniqueIds.length === 0) return new Map<string, number>();

  const variants = await db.productVariant.findMany({
    where: { id: { in: uniqueIds } },
    select: { id: true, regularPrice: true, salePrice: true },
  });

  return new Map(
    variants.map((variant) => [
      variant.id,
      resolveVariantBaseUnitPrice(variant),
    ])
  );
}
