ALTER TABLE "Booking"
ADD COLUMN "additionalChargeAmount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "additionalChargeReason" TEXT;
