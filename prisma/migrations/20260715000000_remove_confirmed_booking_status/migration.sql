-- CONFIRMED is removed from the booking lifecycle: approval (BookingStatus)
-- and payment progress (PaymentStatus) are independent axes, and CONFIRMED
-- only ever meant "approved" with payment implied. COMPLETED is added for
-- bookings whose event has finished.

-- Step 1: move every legacy CONFIRMED booking onto APPROVED. They already
-- display as "Approved" everywhere; payment state stays on paymentStatus.
UPDATE "Booking"
SET "bookingStatus" = 'APPROVED'
WHERE "bookingStatus" = 'CONFIRMED';

-- Step 2: rebuild the enum without CONFIRMED and with COMPLETED. Postgres
-- cannot drop a value from an existing enum type, so swap the type out.
BEGIN;
CREATE TYPE "BookingStatus_new" AS ENUM (
  'INCOMPLETE',
  'AWAITING_PAYMENT',
  'PAYMENT_PROCESSING',
  'CANCELLED',
  'ABANDONED',
  'PAID_EXPIRED',
  'PENDING_REVIEW',
  'APPROVED',
  'REJECTED',
  'COMPLETED'
);
ALTER TABLE "Booking"
  ALTER COLUMN "bookingStatus" TYPE "BookingStatus_new"
  USING ("bookingStatus"::text::"BookingStatus_new");
ALTER TYPE "BookingStatus" RENAME TO "BookingStatus_old";
ALTER TYPE "BookingStatus_new" RENAME TO "BookingStatus";
DROP TYPE "BookingStatus_old";
COMMIT;
