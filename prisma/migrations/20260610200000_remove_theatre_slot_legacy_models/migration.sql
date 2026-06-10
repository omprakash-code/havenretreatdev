-- Drop legacy theatre/slot system
-- Booking.theatreId and Booking.slotId columns are kept as plain nullable strings
-- for historical booking records; the FK constraints and referenced tables are removed.

-- Remove FK constraints from Booking
ALTER TABLE "Booking" DROP CONSTRAINT IF EXISTS "Booking_theatreId_fkey";
ALTER TABLE "Booking" DROP CONSTRAINT IF EXISTS "Booking_slotId_fkey";

-- Remove FK constraints from BookingLock (references both Theatre and Booking)
ALTER TABLE "BookingLock" DROP CONSTRAINT IF EXISTS "BookingLock_theatreId_fkey";
ALTER TABLE "BookingLock" DROP CONSTRAINT IF EXISTS "BookingLock_bookingId_fkey";

-- Remove FK constraints from AvailabilityBlock
ALTER TABLE "AvailabilityBlock" DROP CONSTRAINT IF EXISTS "AvailabilityBlock_theatreId_fkey";

-- Remove FK constraints from BookingSettings
ALTER TABLE "BookingSettings" DROP CONSTRAINT IF EXISTS "BookingSettings_theatreId_fkey";

-- Remove FK constraints from Slot
ALTER TABLE "Slot" DROP CONSTRAINT IF EXISTS "Slot_theatreId_fkey";
ALTER TABLE "Slot" DROP CONSTRAINT IF EXISTS "Slot_slotTemplateId_fkey";

-- Remove FK constraints from SlotTemplate
ALTER TABLE "SlotTemplate" DROP CONSTRAINT IF EXISTS "SlotTemplate_theatreId_fkey";

-- Drop legacy tables
DROP TABLE IF EXISTS "BookingLock";
DROP TABLE IF EXISTS "AvailabilityBlock";
DROP TABLE IF EXISTS "BookingSettings";
DROP TABLE IF EXISTS "Slot";
DROP TABLE IF EXISTS "SlotTemplate";
DROP TABLE IF EXISTS "Theatre";

-- Remove dropped indexes from Booking
DROP INDEX IF EXISTS "Booking_slotId_idx";
DROP INDEX IF EXISTS "Booking_theatreId_idx";

-- Remove THEATRE_ID from CouponRuleType enum
-- Delete any coupon rules that use THEATRE_ID first
DELETE FROM "CouponRule" WHERE "type" = 'THEATRE_ID';
ALTER TYPE "CouponRuleType" RENAME TO "CouponRuleType_old";
CREATE TYPE "CouponRuleType" AS ENUM ('SLOT_DATE_RANGE', 'SLOT_TIME_RANGE', 'SLOT_DURATION_MIN', 'SLOT_ID', 'CATEGORY', 'PRODUCT_ID', 'USER_ID', 'TARGET_CATEGORY', 'TARGET_PRODUCT_ID', 'DECORATION_REQUIRED');
ALTER TABLE "CouponRule" ALTER COLUMN "type" TYPE "CouponRuleType" USING "type"::text::"CouponRuleType";
DROP TYPE "CouponRuleType_old";

-- Drop SlotStatus enum (no longer referenced)
DROP TYPE IF EXISTS "SlotStatus";

-- Drop BookingLockStatus enum (no longer referenced)
DROP TYPE IF EXISTS "BookingLockStatus";
