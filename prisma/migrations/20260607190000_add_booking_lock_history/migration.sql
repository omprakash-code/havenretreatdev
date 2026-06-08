DROP INDEX "BookingLock_bookingId_key";

ALTER TABLE "BookingLock"
ADD COLUMN "lockOwnerHash" TEXT,
ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;

UPDATE "BookingLock"
SET "lockOwnerHash" = 'legacy:' || "id"
WHERE "lockOwnerHash" IS NULL;

ALTER TABLE "BookingLock"
ALTER COLUMN "lockOwnerHash" SET NOT NULL,
ALTER COLUMN "version" DROP DEFAULT;

CREATE UNIQUE INDEX "BookingLock_bookingId_version_key"
ON "BookingLock"("bookingId", "version");

CREATE INDEX "BookingLock_lockOwnerHash_status_expiresAt_idx"
ON "BookingLock"("lockOwnerHash", "status", "expiresAt");

CREATE UNIQUE INDEX "BookingLock_one_active_per_booking_key"
ON "BookingLock"("bookingId")
WHERE "status" = 'ACTIVE';

CREATE UNIQUE INDEX "BookingLock_one_active_per_owner_key"
ON "BookingLock"("lockOwnerHash")
WHERE "status" = 'ACTIVE';
