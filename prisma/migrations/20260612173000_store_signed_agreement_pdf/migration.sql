ALTER TABLE "SignedAgreement"
ADD COLUMN "agreementRef" TEXT,
ADD COLUMN "pdfFileName" TEXT,
ADD COLUMN "pdfSha256" TEXT,
ADD COLUMN "pdfContent" BYTEA;

WITH ranked_agreements AS (
  SELECT
    agreement."id",
    booking."bookingRef",
    ROW_NUMBER() OVER (
      PARTITION BY agreement."bookingId"
      ORDER BY agreement."signedAt" DESC, agreement."createdAt" DESC
    ) AS agreement_rank
  FROM "SignedAgreement" AS agreement
  JOIN "Booking" AS booking ON booking."id" = agreement."bookingId"
)
UPDATE "SignedAgreement" AS agreement
SET "agreementRef" =
  'HRA' ||
  SUBSTRING(ranked."bookingRef" FROM 3) ||
  CASE
    WHEN ranked.agreement_rank = 1 THEN ''
    ELSE '-' || LPAD(ranked.agreement_rank::TEXT, 2, '0')
  END
FROM ranked_agreements AS ranked
WHERE agreement."id" = ranked."id";

UPDATE "SignedAgreement"
SET "agreementRef" = 'HRA-' || UPPER(SUBSTRING(MD5("id") FROM 1 FOR 16))
WHERE "agreementRef" IS NULL;

ALTER TABLE "SignedAgreement"
ALTER COLUMN "agreementRef" SET NOT NULL;

CREATE UNIQUE INDEX "SignedAgreement_agreementRef_key"
ON "SignedAgreement"("agreementRef");
