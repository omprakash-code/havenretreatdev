ALTER TABLE "SignedAgreement"
ADD COLUMN "acknowledgedClauses" JSONB;

UPDATE "Product"
SET "image" = '/media/booking/products/add-ons/hot-tub.jpeg'
WHERE "slug" = 'hot-tub'
  AND "image" = '/media/booking/products/add-ons/hot-tub.avif';

UPDATE "Product"
SET "image" = '/media/booking/products/add-ons/balloon-décor-package.avif'
WHERE "slug" = 'balloon-decor-package';
