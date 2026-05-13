ALTER TABLE "Product"
ADD COLUMN "bookingCategorySlug" TEXT,
ADD COLUMN "bookingCategoryLabel" TEXT,
ADD COLUMN "bookingCategoryDescription" TEXT,
ADD COLUMN "bookingCategorySortOrder" INTEGER NOT NULL DEFAULT 0;
