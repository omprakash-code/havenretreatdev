import { isNumberDecorationProduct } from "@/lib/product-numbering";

export type LocationOption = {
  id: string;
  name: string;
  city?: string;
};

export type TheatreOption = {
  id: string;
  venueId?: string;
  packageId?: string;
  name: string;
  capacity: number;
  baseGuests: number;
  extraPersonPrice: number;
  decorationPrice: number;
  basePrice?: number;
  eventDurationHours?: number;
  hourlyRate?: number;
};

export type OccasionField = {
  key: string;
  label: string;
  isRequired: boolean;
  placeholder?: string;
};

export type OccasionOption = {
  id: string;
  key: string;
  label: string;
  fields: OccasionField[];
};

export type ProductCategory = "CAKE" | "DECORATION" | "GIFT";

export type ProductVariant = {
  id: string;
  label: string;
  regularPrice: number;
  salePrice: number | null;
  stock: number | null;        // null = unlimited / untracked
  maxPerBooking: number | null; // null = no per-booking cap
  isDefault: boolean;
};

export type ProductOption = {
  id: string;
  name: string;
  slug: string;
  image: string;
  category: ProductCategory;
  variants: ProductVariant[];
};

export type ProductLineSelection = {
  quantity: number;
  ledNumber?: string;
};

export type ProductSelectionMap = Record<string, ProductLineSelection>;
export type ActiveVariantMap = Record<string, string>;
export type LedDraftMap = Record<string, string>;

export type SelectedProductSummaryItem = {
  key: string;
  productId: string;
  variantId: string;
  category: ProductCategory;
  productName: string;
  variantLabel: string;
  quantity: number;
  /** Portion of `quantity` covered by the package (never exceeds quantity). */
  includedQuantity: number;
  /** The package's full allowance, independent of what is currently selected. */
  allowanceQuantity?: number;
  extraQuantity: number;
  /** Allowance given up below the package quantity. */
  reducedQuantity?: number;
  /** Package-price credit earned by `reducedQuantity`. */
  adjustmentAmount?: number;
  unitPrice: number;
  totalPrice: number;
  ledNumber?: string;
};

export type PricingSummary = {
  baseAmount: number;
  packageBaseAmount?: number;
  packageListAmount?: number;
  packageAdjustmentAmount?: number;
  extraDurationHours?: number;
  extraHourlyRate?: number;
  extraHoursAmount?: number;
  extrasAmount: number;
  productsAmount: number;
  additionalChargeAmount: number;
  additionalChargeReason?: string | null;
  decorationAmount: number;
  discountAmount: number;
  totalAmount: number;
  advancePaid: number;
  remainingPayable: number;
};

export const PRODUCT_CATEGORIES: ProductCategory[] = ["CAKE", "DECORATION", "GIFT"];

export const inputClass =
  "h-11 w-full rounded-lg border border-slate-300 bg-white px-3.5 text-base text-slate-900 placeholder:text-slate-400 focus:border-black focus:ring-1 focus:ring-black/5 focus:outline-none transition-all sm:h-10 sm:rounded-md sm:px-3 sm:text-sm";

export const selectableInputClass = `${inputClass} cursor-pointer disabled:cursor-not-allowed`;

export const sectionClass = "rounded-xl border border-slate-200 bg-white p-4 sm:p-5";

export function getVariantPrice(variant: ProductVariant) {
  return variant.salePrice ?? variant.regularPrice;
}

export function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function isLedNumberProduct(product: ProductOption) {
  return isNumberDecorationProduct({
    slug: product.slug,
    name: product.name,
  });
}

export function getSelectionKey(productId: string, variantId: string) {
  return `${productId}:${variantId}`;
}

/**
 * Parses the additional-charge input. NaN signals an unusable entry, which
 * validation surfaces rather than letting it silently become 0.
 *
 * The additional charge is ordinary booking data: the edit form prefills it and
 * a typed value REPLACES the stored one. Clearing the field to blank removes the
 * charge, which is why the submit payload always sends an explicit number.
 */
export function parseAdditionalChargeInput(input: string) {
  if (!input.trim()) return 0;
  const parsed = Number(input);
  return Number.isFinite(parsed) ? Math.max(parsed, 0) : Number.NaN;
}

export type EditPrefillItem = {
  productId: string;
  variantId: string;
  quantity: number;
  ledNumber?: string | null;
};

export type EditPrefillAllowance = {
  productId: string;
  variantId: string;
  includedQuantity: number;
};

/**
 * Maps a saved booking's items onto the edit form's selection state.
 *
 * Two rules, in this order:
 *   1. A persisted line ALWAYS wins, verbatim — including a quantity of 0,
 *      which is how a package-included line reduced to nothing is recorded.
 *      Dropping those made the reduction vanish on the next save.
 *   2. Only a package-included line with NO persisted row at all falls back to
 *      the package allowance, because that is exactly what the server writes
 *      for a line the payload does not mention. Without this the form and the
 *      server disagree about what "absent" means.
 *
 * Package defaults never override a stored quantity — a booking adjusted to 2
 * tables loads as 2, never as the package's 4.
 */
export function buildEditProductSelections({
  items,
  allowances = [],
  resolveLedNumber,
}: {
  items: EditPrefillItem[];
  allowances?: EditPrefillAllowance[];
  resolveLedNumber?: (item: EditPrefillItem) => string;
}): {
  selections: ProductSelectionMap;
  activeVariants: ActiveVariantMap;
  ledDrafts: LedDraftMap;
} {
  const selections: ProductSelectionMap = {};
  const activeVariants: ActiveVariantMap = {};
  const ledDrafts: LedDraftMap = {};

  items.forEach((item) => {
    if (!item.productId || !item.variantId) return;
    if (!Number.isFinite(item.quantity) || item.quantity < 0) return;

    const key = getSelectionKey(item.productId, item.variantId);
    const ledNumber = resolveLedNumber?.(item) ?? item.ledNumber ?? "";

    selections[key] = { quantity: Math.trunc(item.quantity), ledNumber };
    activeVariants[item.productId] = item.variantId;
    if (ledNumber) ledDrafts[key] = ledNumber;
  });

  allowances.forEach((allowance) => {
    if (!allowance.productId || !allowance.variantId) return;
    if (allowance.includedQuantity <= 0) return;

    const key = getSelectionKey(allowance.productId, allowance.variantId);
    if (key in selections) return;

    selections[key] = { quantity: allowance.includedQuantity, ledNumber: "" };
    activeVariants[allowance.productId] ??= allowance.variantId;
  });

  return { selections, activeVariants, ledDrafts };
}
