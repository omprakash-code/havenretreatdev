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
  includedQuantity: number;
  extraQuantity: number;
  unitPrice: number;
  totalPrice: number;
  ledNumber?: string;
};

export type PricingSummary = {
  baseAmount: number;
  packageBaseAmount?: number;
  extraDurationHours?: number;
  extraHourlyRate?: number;
  extraHoursAmount?: number;
  extrasAmount: number;
  productsAmount: number;
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
