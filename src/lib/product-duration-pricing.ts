// Duration-based pricing for add-on products whose price scales with the
// booked time range (e.g. Bartender: the variant price covers the first
// 4 hours, then $40/hr beyond that, prorated in half-hour steps).
//
// The product variant in the database stays the single source of truth for
// the base price; this config only describes how the overage scales. An admin
// price change (e.g. $200 -> $220) flows through automatically because every
// caller passes the live variant price as baseUnitPrice.
// TODO(Haven Phase 2): fold into ProductVariant columns alongside the
// Product -> EventAddon flattening.

export type ProductDurationPricing = {
  includedHours: number;
  extraHourlyRate: number;
};

type ProductRef = {
  slug?: string | null;
  productSlug?: string | null;
  name?: string | null;
};

const DURATION_PRICED_PRODUCTS: Record<string, ProductDurationPricing> = {
  bartender: { includedHours: 4, extraHourlyRate: 40 },
};

function normalizeSlug(value: string | null | undefined) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function getProductDurationPricing(product: ProductRef) {
  const slug = normalizeSlug(product.productSlug ?? product.slug ?? product.name);
  return DURATION_PRICED_PRODUCTS[slug] ?? null;
}

// Amount charged on top of the base price for the booked duration.
// Unknown duration means no overage: only the base price is charged.
function getDurationOverageAmount(product: ProductRef, durationHours: number | null | undefined) {
  const config = getProductDurationPricing(product);
  if (!config) return 0;

  const bookedHours =
    typeof durationHours === "number" &&
    Number.isFinite(durationHours) &&
    durationHours > 0
      ? durationHours
      : config.includedHours;
  return Math.round(
    Math.max(bookedHours - config.includedHours, 0) * config.extraHourlyRate
  );
}

// Returns the unit price for the booked duration. baseUnitPrice is the live
// variant price (sale or regular); products without a duration-pricing config
// keep it unchanged.
export function getDurationAdjustedUnitPrice({
  product,
  baseUnitPrice,
  durationHours,
}: {
  product: ProductRef;
  baseUnitPrice: number;
  durationHours: number | null | undefined;
}) {
  return baseUnitPrice + getDurationOverageAmount(product, durationHours);
}

// Moves an already duration-adjusted snapshot price from one booked duration
// to another. For fallback paths where the variant row (and with it the live
// base price) is no longer available — only the snapshot unit price is.
export function rebaseDurationAdjustedUnitPrice({
  product,
  unitPrice,
  fromDurationHours,
  toDurationHours,
}: {
  product: ProductRef;
  unitPrice: number;
  fromDurationHours: number | null | undefined;
  toDurationHours: number | null | undefined;
}) {
  if (!getProductDurationPricing(product)) return unitPrice;
  return Math.max(
    unitPrice -
      getDurationOverageAmount(product, fromDurationHours) +
      getDurationOverageAmount(product, toDurationHours),
    0
  );
}

export function getDurationPricingLabel(product: ProductRef) {
  const config = getProductDurationPricing(product);
  if (!config) return null;
  return `Includes up to ${config.includedHours} hours • $${config.extraHourlyRate}/hr after`;
}

// Recomputes unitPrice/totalPrice for duration-priced items after the booked
// duration changes. Items must carry baseUnitPrice (the duration-independent
// variant price); items without it are left for the next server commit to
// correct. Returns the same array reference when nothing changed.
export function repriceDurationPricedItems<
  T extends {
    productSlug?: string | null;
    productName: string;
    unitPrice: number;
    baseUnitPrice?: number;
    quantity: number;
    totalPrice: number;
  },
>(items: T[], durationHours: number | null | undefined): T[] {
  let changed = false;

  const next = items.map((item) => {
    const product = { slug: item.productSlug, name: item.productName };
    if (!getProductDurationPricing(product)) return item;
    if (typeof item.baseUnitPrice !== "number") return item;

    const unitPrice = getDurationAdjustedUnitPrice({
      product,
      baseUnitPrice: item.baseUnitPrice,
      durationHours,
    });
    const totalPrice = unitPrice * item.quantity;
    if (unitPrice === item.unitPrice && totalPrice === item.totalPrice) {
      return item;
    }

    changed = true;
    return { ...item, unitPrice, totalPrice };
  });

  return changed ? next : items;
}
