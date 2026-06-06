-- CreateEnum
CREATE TYPE "BookingLockStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'RELEASED', 'CONSUMED');

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "bufferMinutes" INTEGER,
ADD COLUMN     "endsAtUtc" TIMESTAMPTZ(3),
ADD COLUMN     "occupiedUntilUtc" TIMESTAMPTZ(3),
ADD COLUMN     "packageSnapshot" JSONB,
ADD COLUMN     "startsAtUtc" TIMESTAMPTZ(3);

-- CreateTable
CREATE TABLE "BookingLock" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "theatreId" TEXT NOT NULL,
    "eventDate" DATE NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "startsAtUtc" TIMESTAMPTZ(3) NOT NULL,
    "endsAtUtc" TIMESTAMPTZ(3) NOT NULL,
    "occupiedUntilUtc" TIMESTAMPTZ(3) NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "status" "BookingLockStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BookingLock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AvailabilityBlock" (
    "id" TEXT NOT NULL,
    "theatreId" TEXT NOT NULL,
    "eventDate" DATE NOT NULL,
    "isFullDay" BOOLEAN NOT NULL DEFAULT false,
    "startTime" TEXT,
    "endTime" TEXT,
    "startsAtUtc" TIMESTAMPTZ(3),
    "endsAtUtc" TIMESTAMPTZ(3),
    "internalNote" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdByAdminId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AvailabilityBlock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookingSettings" (
    "id" TEXT NOT NULL,
    "theatreId" TEXT NOT NULL,
    "businessOpenTime" TEXT NOT NULL DEFAULT '09:00',
    "businessCloseTime" TEXT NOT NULL DEFAULT '23:00',
    "minimumDurationMinutes" INTEGER NOT NULL DEFAULT 240,
    "bufferMinutes" INTEGER NOT NULL DEFAULT 60,
    "lockDurationMinutes" INTEGER NOT NULL DEFAULT 10,
    "maximumGuests" INTEGER NOT NULL DEFAULT 50,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BookingSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BookingLock_bookingId_key" ON "BookingLock"("bookingId");

-- CreateIndex
CREATE INDEX "BookingLock_theatreId_eventDate_idx" ON "BookingLock"("theatreId", "eventDate");

-- CreateIndex
CREATE INDEX "BookingLock_theatreId_startsAtUtc_occupiedUntilUtc_idx" ON "BookingLock"("theatreId", "startsAtUtc", "occupiedUntilUtc");

-- CreateIndex
CREATE INDEX "BookingLock_status_expiresAt_idx" ON "BookingLock"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "AvailabilityBlock_theatreId_eventDate_isActive_idx" ON "AvailabilityBlock"("theatreId", "eventDate", "isActive");

-- CreateIndex
CREATE INDEX "AvailabilityBlock_theatreId_startsAtUtc_endsAtUtc_idx" ON "AvailabilityBlock"("theatreId", "startsAtUtc", "endsAtUtc");

-- CreateIndex
CREATE UNIQUE INDEX "BookingSettings_theatreId_key" ON "BookingSettings"("theatreId");

-- AddForeignKey
ALTER TABLE "BookingLock" ADD CONSTRAINT "BookingLock_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingLock" ADD CONSTRAINT "BookingLock_theatreId_fkey" FOREIGN KEY ("theatreId") REFERENCES "Theatre"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AvailabilityBlock" ADD CONSTRAINT "AvailabilityBlock_theatreId_fkey" FOREIGN KEY ("theatreId") REFERENCES "Theatre"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingSettings" ADD CONSTRAINT "BookingSettings_theatreId_fkey" FOREIGN KEY ("theatreId") REFERENCES "Theatre"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
