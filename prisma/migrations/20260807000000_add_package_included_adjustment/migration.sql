-- Package-included item reduction.
--
-- Included tables/chairs are pre-paid inside the package price at the same unit
-- rate charged for extras. Reducing below the included quantity now credits the
-- package price back at a SNAPSHOTTED rate.
--
-- All columns are additive with defaults, so existing bookings are untouched:
--   packageAdjustmentAmount = 0        -> no reduction, totals unchanged
--   packageIncludedSnapshot = NULL     -> treated as "legacy", rebuilt read-only
--   includedQuantity        = 0        -> reconciled on next edit, never repriced
--
-- No backfill is performed on purpose. Rewriting historical bookings from
-- today's product prices is exactly the drift this feature exists to prevent.

ALTER TABLE "Booking"
  ADD COLUMN "packageAdjustmentAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN "packageIncludedSnapshot" JSONB;

ALTER TABLE "BookingItem"
  ADD COLUMN "includedQuantity" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "includedUnitPrice" DECIMAL(12,2) NOT NULL DEFAULT 0;
