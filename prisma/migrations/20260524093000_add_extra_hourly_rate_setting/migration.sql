INSERT INTO "AppSetting" ("key", "value")
VALUES ('EXTRA_HOURLY_RATE', '120')
ON CONFLICT ("key") DO NOTHING;
