ALTER TABLE "Booking"
  ALTER COLUMN "baseAmount" TYPE DECIMAL(12, 2) USING "baseAmount"::numeric,
  ALTER COLUMN "extrasAmount" TYPE DECIMAL(12, 2) USING "extrasAmount"::numeric,
  ALTER COLUMN "productsAmount" TYPE DECIMAL(12, 2) USING "productsAmount"::numeric,
  ALTER COLUMN "additionalChargeAmount" TYPE DECIMAL(12, 2) USING "additionalChargeAmount"::numeric,
  ALTER COLUMN "discountAmount" TYPE DECIMAL(12, 2) USING "discountAmount"::numeric,
  ALTER COLUMN "totalAmount" TYPE DECIMAL(12, 2) USING "totalAmount"::numeric,
  ALTER COLUMN "decorationAmount" TYPE DECIMAL(12, 2) USING "decorationAmount"::numeric,
  ALTER COLUMN "advancePaid" TYPE DECIMAL(12, 2) USING "advancePaid"::numeric,
  ALTER COLUMN "remainingPayable" TYPE DECIMAL(12, 2) USING "remainingPayable"::numeric;

ALTER TABLE "BookingItem"
  ALTER COLUMN "unitPrice" TYPE DECIMAL(12, 2) USING "unitPrice"::numeric,
  ALTER COLUMN "totalPrice" TYPE DECIMAL(12, 2) USING "totalPrice"::numeric;

ALTER TABLE "ProductVariant"
  ALTER COLUMN "regularPrice" TYPE DECIMAL(12, 2) USING "regularPrice"::numeric,
  ALTER COLUMN "salePrice" TYPE DECIMAL(12, 2) USING "salePrice"::numeric;

ALTER TABLE "Payment"
  ALTER COLUMN "amount" TYPE DECIMAL(12, 2) USING "amount"::numeric;

ALTER TABLE "Coupon"
  ALTER COLUMN "discountValue" TYPE DECIMAL(12, 2) USING "discountValue"::numeric,
  ALTER COLUMN "maxDiscount" TYPE DECIMAL(12, 2) USING "maxDiscount"::numeric,
  ALTER COLUMN "minimumAmount" TYPE DECIMAL(12, 2) USING "minimumAmount"::numeric;

ALTER TABLE "CouponUsage"
  ALTER COLUMN "discountAmount" TYPE DECIMAL(12, 2) USING "discountAmount"::numeric;
