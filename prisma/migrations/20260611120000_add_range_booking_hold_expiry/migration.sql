ALTER TABLE "Booking"
ADD COLUMN "holdExpiresAt" TIMESTAMPTZ(3);

CREATE INDEX "Booking_venueId_bookingStatus_holdExpiresAt_idx"
ON "Booking"("venueId", "bookingStatus", "holdExpiresAt");

CREATE INDEX "Booking_venueId_startsAtUtc_occupiedUntilUtc_idx"
ON "Booking"("venueId", "startsAtUtc", "occupiedUntilUtc");
