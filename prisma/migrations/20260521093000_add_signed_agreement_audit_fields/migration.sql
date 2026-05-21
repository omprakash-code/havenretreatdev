-- AlterTable
ALTER TABLE "SignedAgreement"
ADD COLUMN IF NOT EXISTS "userAgent" TEXT,
ADD COLUMN IF NOT EXISTS "agreementVersion" TEXT,
ADD COLUMN IF NOT EXISTS "agreementHtmlSnapshot" TEXT,
ADD COLUMN IF NOT EXISTS "confirmationAccepted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "paymentReference" TEXT,
ADD COLUMN IF NOT EXISTS "pdfGeneratedAt" TIMESTAMP(3);
