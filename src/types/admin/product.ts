import { ProductCategory } from "@prisma/client";

/* -----------------------------
   Admin Product Variant
------------------------------ */
export type AdminProductVariant = {
  id: string;
  label: string;
  regularPrice: number;
  salePrice: number | null;
  stock: number;
  isDefault: boolean;
  isActive: boolean;
  sortOrder: number;
};

export type ProductDrawerMode = "create" | "view" | "edit";

export type ProductLocationOption = {
  id: string;
  name: string;
};

/* -----------------------------
   Admin Product
------------------------------ */
export type AdminProduct = {
  srNo?: number;
  id: string;
  name: string;
  slug: string;
  image: string;
  description?: string | null;
  category: ProductCategory;
  isActive: boolean;
  sortOrder: number;

  createdAt: string;
  updatedAt: string;

  location: {
    id: string;
    name: string;
  };

  variants: AdminProductVariant[];
};

/* -----------------------------
   Filters
------------------------------ */
export type ProductFilterParams = {
  locationId?: string;
  category?: ProductCategory;
  isActive?: boolean;
  search?: string;
};
