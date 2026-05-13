INSERT INTO "AppSetting" ("key", "value")
VALUES (
  'ADVANCE_PAYMENT_AMOUNT',
  COALESCE(
    NULLIF(
      (SELECT CAST(MAX("advanceAmount") AS TEXT) FROM "Theatre"),
      ''
    ),
    '750'
  )
)
ON CONFLICT ("key") DO UPDATE
SET "value" = CASE
  WHEN "AppSetting"."value" ~ '^[0-9]+$' THEN "AppSetting"."value"
  ELSE EXCLUDED."value"
END;

ALTER TABLE "Theatre"
DROP COLUMN "advanceAmount";
