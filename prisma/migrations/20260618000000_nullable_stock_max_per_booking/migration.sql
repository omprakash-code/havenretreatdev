-- AlterTable
-- Add-ons become daily-repeat services: stock is now nullable
-- (null = unlimited / untracked, 0 = out of stock, N = tracked inventory)
-- and maxPerBooking caps quantity allowed in a single booking.
-- Additive and non-destructive: existing stock values are preserved.
ALTER TABLE "ProductVariant" ADD COLUMN     "maxPerBooking" INTEGER,
ALTER COLUMN "stock" DROP NOT NULL,
ALTER COLUMN "stock" DROP DEFAULT;
