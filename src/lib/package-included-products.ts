import { nanoid } from "nanoid";
import type { BookingItemSnapshot } from "@/context/BookingContext";

type PackageSource = {
  name?: string | null;
  capacity?: number | null;
};

type ProductSource = {
  id: string;
  slug?: string | null;
  name: string;
  image?: string | null;
  category: string;
  variants: Array<{
    id: string;
    label: string;
    price?: number | null;
    regularPrice: number;
    salePrice?: number | null;
    isDefault?: boolean | null;
  }>;
};

const PACKAGE_PRODUCT_QUANTITIES_BY_CAPACITY: Record<number, Record<string, number>> = {
  20: { tables: 2, chairs: 16 },
  30: { tables: 3, chairs: 24 },
  40: { tables: 4, chairs: 32 },
  50: { tables: 6, chairs: 40 },
};

const PACKAGE_PRODUCT_QUANTITIES_BY_NAME: Array<{
  match: string;
  products: Record<string, number>;
}> = [
  { match: "starter", products: { tables: 2, chairs: 16 } },
  { match: "classic", products: { tables: 3, chairs: 24 } },
  { match: "premium", products: { tables: 4, chairs: 32 } },
  { match: "grand", products: { tables: 6, chairs: 40 } },
];

function normalizeSlug(value: string | null | undefined) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function resolvePackageIncludedProducts(
  source: PackageSource | null | undefined
) {
  const capacity = Number((source as { baseGuests?: number } | null | undefined)?.baseGuests ?? source?.capacity ?? 0);
  if (Number.isFinite(capacity)) {
    const byCapacity =
      PACKAGE_PRODUCT_QUANTITIES_BY_CAPACITY[Math.trunc(capacity)];
    if (byCapacity) return byCapacity;
  }

  const packageName = normalizeSlug(source?.name);
  return (
    PACKAGE_PRODUCT_QUANTITIES_BY_NAME.find((entry) =>
      packageName.includes(entry.match)
    )?.products ?? {}
  );
}

export function getPackageIncludedProductQuantity(
  source: PackageSource | null | undefined,
  product: { slug?: string | null; productSlug?: string | null; name?: string | null }
) {
  const included = resolvePackageIncludedProducts(source);
  const slug = normalizeSlug(product.productSlug ?? product.slug ?? product.name);
  return included[slug] ?? 0;
}

export function getPackageIncludedProductExtraQuantity(
  source: PackageSource | null | undefined,
  product: { slug?: string | null; productSlug?: string | null; name?: string | null },
  quantity: number
) {
  return Math.max(quantity - getPackageIncludedProductQuantity(source, product), 0);
}

export function getPackageIncludedProductTotalPrice({
  source,
  product,
  quantity,
  unitPrice,
}: {
  source: PackageSource | null | undefined;
  product: { slug?: string | null; productSlug?: string | null; name?: string | null };
  quantity: number;
  unitPrice: number;
}) {
  return getPackageIncludedProductExtraQuantity(source, product, quantity) * unitPrice;
}

export function ensurePackageIncludedProducts({
  currentItems,
  products,
  selectedPackage,
}: {
  currentItems: BookingItemSnapshot[];
  products: ProductSource[];
  selectedPackage: PackageSource | null | undefined;
}) {
  const includedProducts = resolvePackageIncludedProducts(selectedPackage);
  if (Object.keys(includedProducts).length === 0) return currentItems;

  let changed = false;
  const nextItems = [...currentItems];

  products.forEach((product) => {
    const slug = normalizeSlug(product.slug ?? product.name);
    const includedQuantity = includedProducts[slug] ?? 0;
    if (includedQuantity <= 0) return;

    const variant =
      product.variants.find((item) => item.isDefault) ?? product.variants[0];
    if (!variant) return;

    const existingIndex = nextItems.findIndex(
      (item) => item.productId === product.id && item.variantId === variant.id
    );
    const unitPrice = Number(
      variant.price ?? variant.salePrice ?? variant.regularPrice ?? 0
    );

    if (existingIndex >= 0) {
      const existing = nextItems[existingIndex];
      if (existing.quantity >= includedQuantity) return;

      changed = true;
      nextItems[existingIndex] = {
        ...existing,
        quantity: includedQuantity,
        totalPrice: getPackageIncludedProductTotalPrice({
          source: selectedPackage,
          product,
          quantity: includedQuantity,
          unitPrice: existing.unitPrice,
        }),
      };
      return;
    }

    changed = true;
    nextItems.push({
      id: nanoid(),
      productId: product.id,
      variantId: variant.id,
      productName: product.name,
      productImage: product.image ?? undefined,
      productSlug: product.slug ?? undefined,
      variantLabel: variant.label,
      category: product.category,
      unitPrice,
      quantity: includedQuantity,
      totalPrice: 0,
    });
  });

  return changed ? nextItems : currentItems;
}
