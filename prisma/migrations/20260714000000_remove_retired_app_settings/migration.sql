-- Remove retired app settings left over from the slot-based booking system.
-- These keys are no longer read anywhere; the admin settings UI would still
-- surface stale rows, so they are deleted here. Safe to re-run (idempotent).
DELETE FROM "AppSetting"
WHERE "key" IN (
  'SPECIAL_SLOT_TEXT',
  'SLOT_EXPIRY_GRACE_MINUTES',
  'SLOT_EXPIRY_MODE'
);
