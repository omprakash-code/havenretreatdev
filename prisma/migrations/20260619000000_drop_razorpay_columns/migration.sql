-- Drop legacy Razorpay-specific columns; payments are now provider-neutral
-- (paymentProvider / paymentOrderId / paymentTransactionId / paymentSignature).
ALTER TABLE "Booking" DROP COLUMN IF EXISTS "razorpayOrderId";
ALTER TABLE "Booking" DROP COLUMN IF EXISTS "razorpayPaymentId";
ALTER TABLE "Booking" DROP COLUMN IF EXISTS "razorpaySignature";
