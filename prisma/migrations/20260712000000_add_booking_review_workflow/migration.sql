-- Booking review workflow (additive).
--
-- Adds the approval-workflow statuses and the review decision fields. No enum
-- value is renamed or removed and no existing row is rewritten, so legacy
-- payment-first bookings (AWAITING_PAYMENT / PAYMENT_PROCESSING / CONFIRMED /
-- PAID_EXPIRED) keep working exactly as before.

-- AlterEnum
-- New values are appended. PostgreSQL 12+ allows ALTER TYPE ... ADD VALUE inside a
-- transaction as long as the new value is not used in the same transaction; this
-- migration only declares the values, it does not write them.
ALTER TYPE "BookingStatus" ADD VALUE IF NOT EXISTS 'PENDING_REVIEW';
ALTER TYPE "BookingStatus" ADD VALUE IF NOT EXISTS 'APPROVED';
ALTER TYPE "BookingStatus" ADD VALUE IF NOT EXISTS 'REJECTED';

-- AlterTable
-- rejectionReason is a review decision and stays separate from cancelledReason,
-- which remains the operational cancellation field.
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "reviewSubmittedAt" TIMESTAMP(3);
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "reviewedAt" TIMESTAMP(3);
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "reviewedByAdminId" TEXT;
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "rejectionReason" TEXT;
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "approvalNotes" TEXT;
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "internalNotes" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Booking_bookingStatus_reviewSubmittedAt_idx" ON "Booking"("bookingStatus", "reviewSubmittedAt");
CREATE INDEX IF NOT EXISTS "Booking_reviewedByAdminId_reviewedAt_idx" ON "Booking"("reviewedByAdminId", "reviewedAt");
