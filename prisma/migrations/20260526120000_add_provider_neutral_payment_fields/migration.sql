-- Add provider-neutral payment bridge fields for Square Hosted Checkout and
-- future gateways without removing existing Razorpay compatibility columns.
ALTER TABLE "Booking"
ADD COLUMN "paymentProvider" TEXT,
ADD COLUMN "paymentOrderId" TEXT,
ADD COLUMN "paymentTransactionId" TEXT,
ADD COLUMN "paymentSignature" TEXT,
ADD COLUMN "paymentCheckoutUrl" TEXT;

CREATE INDEX "Booking_paymentProvider_paymentOrderId_idx"
ON "Booking"("paymentProvider", "paymentOrderId");

CREATE INDEX "Booking_paymentProvider_paymentTransactionId_idx"
ON "Booking"("paymentProvider", "paymentTransactionId");
