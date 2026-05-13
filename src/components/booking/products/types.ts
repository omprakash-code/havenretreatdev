// Product categories MUST match Prisma enum
export type ProductCategory = "CAKE" | "DECORATION" | "GIFT";

/* -----------------------------
   Product Variant
   (PRICE LIVES HERE — NOT PRODUCT)
------------------------------ */
export type Variant = {
  id: string;            // ProductVariant.id
  label: string;         // "500g", "1 Kg", "Premium"
  price: number;
  regularPrice: number;
  salePrice: number | null;
  stock: number;
  isDefault?: boolean;
};

/* -----------------------------
   Product
------------------------------ */
export type Product = {
  id: string;
  slug?: string;
  name: string;
  description?: string;
  category: ProductCategory;
  image: string;

  // ALWAYS array (even if only one variant)
  variants: Variant[];
};

/* -----------------------------
   Booking Item (DB → UI)
   SNAPSHOT — NEVER recalculated
------------------------------ */
export type ProductSelection = {
  id: string;              // bookingItem.id
  productId: string;
  productImage?: string;
  productSlug?: string;
  name: string;

  variantId: string;
  variant: {
    label: string;
    price: number;
  };

  category: ProductCategory;

  quantity: number;
  totalPrice: number;
  ledNumber?: string;
};

export type SummaryItem = {
  id: string;
  productName: string;  
  variantLabel: string;
  unitPrice: number;
  quantity: number;
  totalPrice: number;
};
