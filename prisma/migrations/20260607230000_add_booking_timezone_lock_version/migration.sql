ALTER TABLE "Theatre"
ADD COLUMN "timezone" TEXT NOT NULL DEFAULT 'America/New_York';

ALTER TABLE "Booking"
ADD COLUMN "timezone" TEXT,
ADD COLUMN "lockVersion" INTEGER;
