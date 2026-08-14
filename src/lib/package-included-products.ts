import { nanoid } from "nanoid";
import type { BookingItemSnapshot } from "@/context/BookingContext";
import { centsToMoney, toCents, toMoney, toNonNegativeMoney } from "@/lib/money";

export type PackageIncludedProductSource = {
  name?: string | null;
  capacity?: number | null;
  baseGuests?: number | null;
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

// Included quantities must stay in sync with each package's "Tables & Chairs"
// price-breakdown line, because that line is exactly what a reduction credits
// back. At $15/table and $3/chair the two reconcile:
//   Starter  2×15 + 16×3 = $78     Classic 3×15 + 24×3 = $117
//   Premium  4×15 + 32×3 = $156    Grand   5×15 + 40×3 = $195
// Grand previously granted 6 tables while the package only charged for 5, so a
// reduction would have credited a table the customer never paid for.
const PACKAGE_PRODUCT_QUANTITIES_BY_CAPACITY: Record<number, Record<string, number>> = {
  20: { tables: 2, chairs: 16 },
  30: { tables: 3, chairs: 24 },
  40: { tables: 4, chairs: 32 },
  50: { tables: 5, chairs: 40 },
};

const PACKAGE_PRODUCT_QUANTITIES_BY_NAME: Array<{
  match: string;
  products: Record<string, number>;
}> = [
  { match: "starter", products: { tables: 2, chairs: 16 } },
  { match: "classic", products: { tables: 3, chairs: 24 } },
  { match: "premium", products: { tables: 4, chairs: 32 } },
  { match: "grand", products: { tables: 5, chairs: 40 } },
];

function normalizeSlug(value: string | null | undefined) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function resolvePackageIncludedProducts(
  source: PackageIncludedProductSource | null | undefined
) {
  const capacity = Number(source?.baseGuests ?? source?.capacity ?? 0);
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
  source: PackageIncludedProductSource | null | undefined,
  product: { slug?: string | null; productSlug?: string | null; name?: string | null }
) {
  const included = resolvePackageIncludedProducts(source);
  const slug = normalizeSlug(product.productSlug ?? product.slug ?? product.name);
  return included[slug] ?? 0;
}

/* ===========================================================================
   Package included allowances + package price adjustment
   ---------------------------------------------------------------------------
   Included tables/chairs are not truly complimentary: they are pre-paid inside
   the package price at the same unit rate charged for extras (each package's
   "Tables & Chairs" price-breakdown line). Reducing below the included quantity
   therefore credits the package price back at that rate.

   The allowance is SNAPSHOTTED on the booking at creation time so that later
   product price changes never move an existing booking's total, and so that
   edits can never silently reset a reduction by re-deriving from live config.

   Every caller — customer flow, admin create, admin edit, UI preview — prices a
   line through priceIncludedProductLine(), and resolves a saved booking's
   allowance through resolveBookingPackageAllowances(), so there is exactly one
   implementation of each.
=========================================================================== */

export type PackageIncludedAllowance = {
  productSlug: string;
  productId: string;
  variantId: string;
  includedQuantity: number;
  // The rate the package priced this item at. Snapshotted; never re-read from
  // the live variant for an existing booking.
  includedUnitPrice: number;
};

type AllowanceProductSource = {
  id: string;
  slug?: string | null;
  name: string;
  variants: Array<{
    id: string;
    regularPrice: unknown;
    salePrice?: unknown | null;
    isDefault?: boolean | null;
  }>;
};

// Effective base unit price for an allowance snapshot. Mirrors
// resolveVariantBaseUnitPrice but accepts Prisma Decimal values too.
function resolveAllowanceUnitPrice(variant: {
  regularPrice: unknown;
  salePrice?: unknown | null;
}) {
  const regularPrice = toMoney(variant.regularPrice);
  const salePrice =
    variant.salePrice !== null && variant.salePrice !== undefined
      ? toMoney(variant.salePrice)
      : null;
  return salePrice !== null && salePrice > 0 ? salePrice : regularPrice;
}

/**
 * Builds the allowance snapshot for a newly created booking from live product
 * data. Only the default variant of each included product carries an allowance,
 * matching how the package price was constructed.
 */
export function buildPackageIncludedAllowances({
  source,
  products,
}: {
  source: PackageIncludedProductSource | null | undefined;
  products: AllowanceProductSource[];
}): PackageIncludedAllowance[] {
  const included = resolvePackageIncludedProducts(source);
  if (Object.keys(included).length === 0) return [];

  const allowances: PackageIncludedAllowance[] = [];

  products.forEach((product) => {
    const slug = normalizeSlug(product.slug ?? product.name);
    const includedQuantity = included[slug] ?? 0;
    if (includedQuantity <= 0) return;

    const variant =
      product.variants.find((item) => item.isDefault) ?? product.variants[0];
    if (!variant) return;

    allowances.push({
      productSlug: slug,
      productId: product.id,
      variantId: variant.id,
      includedQuantity,
      includedUnitPrice: resolveAllowanceUnitPrice(variant),
    });
  });

  return allowances;
}

/**
 * Whether a quantity stepper's decrease control should be usable.
 *
 * The floor is 0 for EVERY product, including package-included ones: taking
 * fewer tables/chairs than the package covers is allowed and simply reduces the
 * package price. This lives here because both the customer and the admin card
 * previously each carried their own `quantity <= includedQuantity` copy of the
 * rule, and both had to be found and changed to make reductions possible.
 */
export function canDecreaseProductQuantity(quantity: number) {
  return Math.trunc(Number(quantity) || 0) > 0;
}

export type IncludedProductLinePricing = {
  includedQuantity: number;
  includedUnitPrice: number;
  extraQuantity: number;
  /** Charged for quantities ABOVE the included allowance, at the live rate. */
  totalPrice: number;
  /** Credited back off the package price for quantities BELOW the allowance. */
  adjustmentAmount: number;
};

/**
 * The single pricing rule for one included-product line.
 *
 * quantity >= included -> extras charged at the live `unitPrice`, no credit.
 * quantity <  included -> no charge, credit the shortfall at the SNAPSHOTTED
 *                         `includedUnitPrice`.
 */
export function priceIncludedProductLine({
  includedQuantity,
  includedUnitPrice,
  quantity,
  unitPrice,
}: {
  includedQuantity: number;
  includedUnitPrice: number;
  quantity: number;
  unitPrice: number;
}): IncludedProductLinePricing {
  const included = Math.max(0, Math.trunc(includedQuantity || 0));
  const selected = Math.max(0, Math.trunc(quantity || 0));
  const snapshotRate = toNonNegativeMoney(includedUnitPrice);
  const liveRate = toNonNegativeMoney(unitPrice);

  const extraQuantity = Math.max(selected - included, 0);
  const shortfall = Math.max(included - selected, 0);

  return {
    includedQuantity: included,
    includedUnitPrice: snapshotRate,
    extraQuantity,
    totalPrice: centsToMoney(toCents(liveRate) * extraQuantity),
    adjustmentAmount: centsToMoney(toCents(snapshotRate) * shortfall),
  };
}

/**
 * Total package price reduction for a booking: the sum of every allowance's
 * unfilled quantity valued at its snapshotted rate. Allowances with no matching
 * selection count as fully reduced (the line was removed entirely).
 */
export function calculatePackageAdjustmentAmount({
  allowances,
  quantityByVariantId,
}: {
  allowances: PackageIncludedAllowance[] | null | undefined;
  quantityByVariantId: Map<string, number> | Record<string, number>;
}): number {
  if (!allowances?.length) return 0;

  const lookup =
    quantityByVariantId instanceof Map
      ? quantityByVariantId
      : new Map(Object.entries(quantityByVariantId));

  return allowances.reduce((total, allowance) => {
    const { adjustmentAmount } = priceIncludedProductLine({
      includedQuantity: allowance.includedQuantity,
      includedUnitPrice: allowance.includedUnitPrice,
      quantity: lookup.get(allowance.variantId) ?? 0,
      unitPrice: allowance.includedUnitPrice,
    });
    return centsToMoney(toCents(total) + toCents(adjustmentAmount));
  }, 0);
}

/**
 * Rehydrates an allowance snapshot persisted on a booking. Returns [] for
 * legacy bookings that predate the feature, which keeps their pricing frozen at
 * "no adjustment" instead of re-deriving one from current config.
 */
export function parsePackageIncludedAllowances(
  value: unknown
): PackageIncludedAllowance[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const record = entry as Record<string, unknown>;
    const variantId = typeof record.variantId === "string" ? record.variantId : "";
    const productId = typeof record.productId === "string" ? record.productId : "";
    if (!variantId || !productId) return [];

    const includedQuantity = Math.max(
      0,
      Math.trunc(Number(record.includedQuantity) || 0)
    );
    if (includedQuantity <= 0) return [];

    return [
      {
        productSlug:
          typeof record.productSlug === "string" ? record.productSlug : "",
        productId,
        variantId,
        includedQuantity,
        includedUnitPrice: toNonNegativeMoney(record.includedUnitPrice),
      },
    ];
  });
}

/**
 * THE allowance for a saved booking. Read and write paths must both go through
 * this, or the edit form and the server will disagree about which lines the
 * package covers — and a line the form shows as included would be charged for.
 *
 * Order of authority:
 *   1. The booking's own frozen snapshot, used verbatim. Never re-derived.
 *   2. Otherwise (a booking predating the snapshot) rebuild from package config
 *      against the live catalogue, then pin each rate to the price the booking
 *      already stored for that line. A line with no stored row has no frozen
 *      price to keep, so it takes today's — the reduction that follows is what
 *      freezes it into a snapshot.
 */
export function resolveBookingPackageAllowances({
  snapshot,
  source,
  items,
  products,
}: {
  snapshot: unknown;
  source: PackageIncludedProductSource | null | undefined;
  items: Array<{
    productId: string;
    variantId: string;
    productSlug?: string | null;
    productName?: string | null;
    unitPrice: unknown;
    includedUnitPrice?: unknown;
  }>;
  products: AllowanceProductSource[];
}): PackageIncludedAllowance[] {
  const persisted = parsePackageIncludedAllowances(snapshot);
  if (persisted.length > 0) return persisted;

  // Rates the booking already committed to, keyed by variant.
  const storedRateByVariantId = new Map<string, number>();
  items.forEach((item) => {
    const frozen = toNonNegativeMoney(item.includedUnitPrice);
    const rate = frozen > 0 ? frozen : toNonNegativeMoney(item.unitPrice);
    if (rate > 0) storedRateByVariantId.set(item.variantId, rate);
  });

  const fromCatalogue = buildPackageIncludedAllowances({ source, products });
  if (fromCatalogue.length > 0) {
    return fromCatalogue.map((allowance) => ({
      ...allowance,
      includedUnitPrice:
        storedRateByVariantId.get(allowance.variantId) ??
        allowance.includedUnitPrice,
    }));
  }

  // No catalogue to hand (e.g. products could not be loaded): fall back to
  // whatever the booking's own rows can tell us.
  return rebuildLegacyPackageIncludedAllowances({ source, items });
}

/**
 * Legacy fallback: rebuilds an allowance snapshot for a booking created before
 * allowances were persisted, using the package config plus the unit price each
 * item was already stored at. Those bookings were created with quantity forced
 * to >= included, so this always yields a zero adjustment and leaves their
 * totals untouched.
 */
export function rebuildLegacyPackageIncludedAllowances({
  source,
  items,
}: {
  source: PackageIncludedProductSource | null | undefined;
  items: Array<{
    productId: string;
    variantId: string;
    productSlug?: string | null;
    productName?: string | null;
    unitPrice: unknown;
  }>;
}): PackageIncludedAllowance[] {
  const included = resolvePackageIncludedProducts(source);
  if (Object.keys(included).length === 0) return [];

  return items.flatMap((item) => {
    const slug = normalizeSlug(item.productSlug ?? item.productName);
    const includedQuantity = included[slug] ?? 0;
    if (includedQuantity <= 0) return [];

    return [
      {
        productSlug: slug,
        productId: item.productId,
        variantId: item.variantId,
        includedQuantity,
        includedUnitPrice: toNonNegativeMoney(item.unitPrice),
      },
    ];
  });
}

export function ensurePackageIncludedProducts({
  currentItems,
  products,
  selectedPackage,
}: {
  currentItems: BookingItemSnapshot[];
  products: ProductSource[];
  selectedPackage: PackageIncludedProductSource | null | undefined;
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

    // An existing row is the customer's own choice — including a deliberate
    // reduction below the included quantity, and including a row left at 0
    // after being reduced to nothing. Re-raising it here is what used to make
    // reductions impossible; seeding only ever applies to a brand-new row.
    if (existingIndex >= 0) return;

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
      includedQuantity,
      includedUnitPrice: unitPrice,
    });
  });

  return changed ? nextItems : currentItems;
}

type ProductSelection = {
  quantity: number;
  ledNumber?: string;
};

export function reconcilePackageIncludedProductSelections({
  currentSelections,
  products,
  previousPackage,
  selectedPackage,
}: {
  currentSelections: Record<string, ProductSelection>;
  products: ProductSource[];
  previousPackage: PackageIncludedProductSource | null | undefined;
  selectedPackage: PackageIncludedProductSource | null | undefined;
}) {
  const nextSelections = { ...currentSelections };
  let changed = false;

  products.forEach((product) => {
    const variant =
      product.variants.find((item) => item.isDefault) ?? product.variants[0];
    if (!variant) return;

    const key = `${product.id}:${variant.id}`;
    const current = nextSelections[key];
    const previousIncludedQuantity = getPackageIncludedProductQuantity(
      previousPackage,
      product
    );
    const nextIncludedQuantity = getPackageIncludedProductQuantity(
      selectedPackage,
      product
    );

    if (!current && nextIncludedQuantity <= 0) return;

    // Carry the customer's delta from the previous package's allowance across
    // the switch. A positive delta is a manual add-on; a negative delta is a
    // deliberate reduction, and must survive the package change just as an
    // addition does.
    const delta = current
      ? current.quantity - previousIncludedQuantity
      : 0;
    const nextQuantity = Math.max(nextIncludedQuantity + delta, 0);

    // A zero-quantity row is retained whenever the new package grants an
    // allowance, because it is the only record that the customer reduced the
    // line to nothing. Dropping it would let seeding re-add the full quantity.
    if (nextQuantity <= 0 && nextIncludedQuantity <= 0) {
      if (current) {
        delete nextSelections[key];
        changed = true;
      }
      return;
    }

    if (!current || current.quantity !== nextQuantity) {
      nextSelections[key] = {
        ...current,
        quantity: nextQuantity,
      };
      changed = true;
    }
  });

  return changed ? nextSelections : currentSelections;
}
