import { z } from "zod";
import type { AdminProduct } from "@/types/admin/product";

export const PRODUCT_CATEGORIES = ["CAKE", "DECORATION", "GIFT"] as const;

const nonNegativeInteger = (label: string) =>
  z
    .number({ message: `${label} is required` })
    .refine((value) => Number.isFinite(value), `${label} is required`)
    .int(`${label} must be a whole number`)
    .min(0, `${label} cannot be negative`);

const positiveInteger = (label: string) =>
  z
    .number({ message: `${label} is required` })
    .refine((value) => Number.isFinite(value), `${label} is required`)
    .int(`${label} must be a whole number`)
    .min(1, `${label} must be at least 1`);

export const productVariantSchema = z
  .object({
    // Hidden field from form array; allow empty string for new variants
    id: z.string().trim().optional().or(z.literal("")),
    label: z.string().trim().min(1, "Variation is required"),
    regularPrice: positiveInteger("Regular price"),
    salePrice: z
      .number({ message: "Sale price is invalid" })
      .refine((value) => Number.isFinite(value), "Sale price is invalid")
      .int("Sale price must be a whole number")
      .min(0, "Sale price cannot be negative")
      .nullable()
      .optional(),
    stock: nonNegativeInteger("Stock quantity"),
    isDefault: z.boolean(),
    isActive: z.boolean(),
    sortOrder: nonNegativeInteger("Variant sort order"),
  })
  .superRefine((value, ctx) => {
    if (
      value.salePrice !== null &&
      value.salePrice !== undefined &&
      value.salePrice > value.regularPrice
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Sale price cannot be greater than regular price",
        path: ["salePrice"],
      });
    }
  });

export const productFormSchema = z
  .object({
    name: z.string().trim().min(2, "Product name is required"),
    slug: z
      .string()
      .trim()
      .min(2, "Slug is required")
      .regex(
        /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
        "Use lowercase letters, numbers and hyphens only"
      ),
    image: z.string().trim().min(1, "Product image is required"),
    description: z
      .string()
      .trim()
      .max(2000, "Description must be 2000 characters or less")
      .nullable()
      .optional(),
    category: z.enum(PRODUCT_CATEGORIES),
    locationId: z.string().trim().min(1, "Location is required"),
    isActive: z.boolean(),
    sortOrder: nonNegativeInteger("Sort order"),
    variants: z
      .array(productVariantSchema)
      .min(1, "At least one variant is required"),
  })
  .superRefine((value, ctx) => {
    const defaultIndexes = value.variants
      .map((variant, index) => (variant.isDefault ? index : -1))
      .filter((index) => index >= 0);

    if (defaultIndexes.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Select one default variant",
        path: ["variants", 0, "isDefault"],
      });
    }

    if (defaultIndexes.length > 1) {
      defaultIndexes.slice(1).forEach((index) => {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Only one default variant is allowed",
          path: ["variants", index, "isDefault"],
        });
      });
    }

    if (!value.variants.some((variant) => variant.isActive)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "At least one active variant is required",
        path: ["variants", 0, "isActive"],
      });
    }

    const labelIndexes = new Map<string, number>();
    value.variants.forEach((variant, index) => {
      const key = variant.label.trim().toLowerCase();
      if (!key) return;

      const existingIndex = labelIndexes.get(key);
      if (existingIndex !== undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Variant labels must be unique",
          path: ["variants", index, "label"],
        });
      } else {
        labelIndexes.set(key, index);
      }
    });
  });

export type ProductFormValues = z.infer<typeof productFormSchema>;

export function createEmptyVariant(
  overrides: Partial<ProductFormValues["variants"][number]> = {}
): ProductFormValues["variants"][number] {
  return {
    id: overrides.id,
    label: overrides.label ?? "",
    regularPrice: (overrides.regularPrice ?? undefined) as unknown as number,
    salePrice: overrides.salePrice ?? null,
    stock: overrides.stock ?? 0,
    isDefault: overrides.isDefault ?? false,
    isActive: overrides.isActive ?? true,
    sortOrder: (overrides.sortOrder ?? undefined) as unknown as number,
  };
}

export function getDefaultProductFormValues(): ProductFormValues {
  return {
    name: "",
    slug: "",
    image: "",
    description: "",
    category: "CAKE",
    locationId: "__ALL__",
    isActive: true,
    sortOrder: undefined as unknown as number,
    variants: [createEmptyVariant({ isDefault: true, stock: 0 })],
  };
}

export function mapProductToFormValues(product: AdminProduct): ProductFormValues {
  return {
    name: product.name,
    slug: product.slug,
    image: product.image ?? "",
    description: product.description ?? "",
    category: product.category,
    locationId: product.location.id,
    isActive: product.isActive,
    sortOrder: product.sortOrder,
    variants:
      product.variants.length > 0
        ? product.variants.map((variant, index) =>
            createEmptyVariant({
              id: variant.id,
              label: variant.label,
              regularPrice: variant.regularPrice,
              salePrice: variant.salePrice,
              stock: variant.stock,
              isDefault: variant.isDefault,
              isActive: variant.isActive,
              sortOrder: variant.sortOrder ?? index,
            })
          )
        : [createEmptyVariant({ isDefault: true })],
  };
}
