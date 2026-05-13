-- Slot integrity: prevent duplicate slots for same theatre/date/time
CREATE UNIQUE INDEX "Slot_theatreId_date_startTime_endTime_key"
ON "Slot"("theatreId", "date", "startTime", "endTime");

-- Slot query acceleration for admin listing + overlap checks
CREATE INDEX "Slot_theatreId_date_status_idx"
ON "Slot"("theatreId", "date", "status");

CREATE INDEX "Slot_date_status_startTime_idx"
ON "Slot"("date", "status", "startTime");

CREATE INDEX "Slot_status_lockExpiresAt_idx"
ON "Slot"("status", "lockExpiresAt");

CREATE INDEX "Slot_slotTemplateId_idx"
ON "Slot"("slotTemplateId");

-- Booking relation lookup acceleration for slot booking history/count checks
CREATE INDEX "Booking_slotId_idx"
ON "Booking"("slotId");
