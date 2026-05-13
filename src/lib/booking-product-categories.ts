import { ProductCategory } from "@prisma/client";

export type BookingProductCategory = {
  slug: string;
  label: string;
  description: string;
  sortOrder: number;
};

const LEGACY_CATEGORY_META: Record<ProductCategory, BookingProductCategory> = {
  CAKE: {
    slug: "cake",
    label: "Cake",
    description: "Choose a cake to make your celebration sweeter.",
    sortOrder: 0,
  },
  DECORATION: {
    slug: "decoration",
    label: "Decoration",
    description: "Pick decoration add-ons to personalize your setup.",
    sortOrder: 1,
  },
  GIFT: {
    slug: "gift",
    label: "Gift",
    description: "Add gifts to complete your surprise experience.",
    sortOrder: 2,
  },
};

export function slugifyBookingCategory(label: string) {
  return label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function buildBookingCategoryDescription(label: string) {
  if (label.trim().toLowerCase() === "add-ons") {
    return "Choose any optional add-ons for your event.";
  }

  return `Choose optional ${label.trim().toLowerCase()} for your event.`;
}

export function getLegacyBookingCategoryMeta(category: ProductCategory) {
  return LEGACY_CATEGORY_META[category];
}

export function resolveBookingCategoryMeta(input: {
  category: ProductCategory;
  bookingCategorySlug?: string | null;
  bookingCategoryLabel?: string | null;
  bookingCategoryDescription?: string | null;
  bookingCategorySortOrder?: number | null;
  sortOrder?: number | null;
}): BookingProductCategory {
  const legacy = getLegacyBookingCategoryMeta(input.category);
  const label = input.bookingCategoryLabel?.trim() || legacy.label;
  const slug =
    input.bookingCategorySlug?.trim() || slugifyBookingCategory(label) || legacy.slug;

  return {
    slug,
    label,
    description:
      input.bookingCategoryDescription?.trim() ||
      buildBookingCategoryDescription(label),
    sortOrder:
      typeof input.bookingCategorySortOrder === "number"
        ? input.bookingCategorySortOrder
        : typeof input.sortOrder === "number"
          ? input.sortOrder
          : legacy.sortOrder,
  };
}
