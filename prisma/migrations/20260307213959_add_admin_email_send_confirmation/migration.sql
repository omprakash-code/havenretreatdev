ALTER TABLE "Booking"
ADD COLUMN IF NOT EXISTS "abandonmentCustomerEmailSentAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "abandonmentAdminEmailSentAt" TIMESTAMP(3);

ALTER TABLE "Booking"
ALTER COLUMN "abandonmentCustomerEmailSentAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "abandonmentAdminEmailSentAt" SET DATA TYPE TIMESTAMP(3);
