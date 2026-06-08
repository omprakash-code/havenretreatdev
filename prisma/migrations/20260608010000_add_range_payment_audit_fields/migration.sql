ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'MANUAL_REVIEW';

ALTER TABLE "Payment"
ADD COLUMN "providerOrderId" TEXT,
ADD COLUMN "providerPaymentId" TEXT,
ADD COLUMN "bookingLockVersion" INTEGER,
ADD COLUMN "idempotencyKey" TEXT,
ADD COLUMN "providerPayload" JSONB,
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX "Payment_bookingId_bookingLockVersion_createdAt_idx"
ON "Payment"("bookingId", "bookingLockVersion", "createdAt");

CREATE UNIQUE INDEX "Payment_provider_providerOrderId_key"
ON "Payment"("provider", "providerOrderId");

CREATE UNIQUE INDEX "Payment_provider_providerPaymentId_key"
ON "Payment"("provider", "providerPaymentId");

CREATE UNIQUE INDEX "Payment_provider_idempotencyKey_key"
ON "Payment"("provider", "idempotencyKey");
