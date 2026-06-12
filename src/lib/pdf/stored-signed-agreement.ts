import { createHash } from "node:crypto";

import { buildSignedAgreementPdf } from "@/components/booking/success/pdf/downloadSignedAgreementPdf";
import type { BookingSuccessSignedAgreement } from "@/components/booking/success/types";

export type StoredSignedAgreementAttachment = {
  filename: string;
  content: Buffer;
  contentType: "application/pdf";
};

export async function buildStoredSignedAgreementPdf(input: {
  bookingRef: string;
  agreement: BookingSuccessSignedAgreement;
}) {
  const { filename, arrayBuffer } = await buildSignedAgreementPdf({
    bookingRef: input.bookingRef,
    contact: {
      name: input.agreement.signerName,
      phone: "",
      email: input.agreement.signerEmail,
    },
    theatreName: "Haven Retreat",
    date: "",
    timeSlot: "",
    locationName: "Miami",
    dateTime: "",
    occasionDetails: [],
    guestCount: 0,
    totalAmount: 0,
    advancePaid: 0,
    remainingPayable: 0,
    items: [],
    signedAgreement: input.agreement,
  });
  const content = Buffer.from(arrayBuffer);

  return {
    filename,
    content,
    sha256: createHash("sha256").update(content).digest("hex"),
    generatedAt: new Date(),
  };
}

export function createStoredAgreementAttachment(input: {
  filename: string | null;
  content: Uint8Array | null;
}): StoredSignedAgreementAttachment | null {
  if (!input.filename || !input.content?.byteLength) return null;

  return {
    filename: input.filename,
    content: Buffer.from(input.content),
    contentType: "application/pdf",
  };
}
