ALTER TABLE "Booking"
ADD COLUMN IF NOT EXISTS "abandonmentCustomerEmailSentAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "abandonmentAdminEmailSentAt" TIMESTAMP(3);
