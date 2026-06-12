import { describe, expect, it } from "vitest";
import type { BookingSuccessData } from "@/components/booking/success/types";
import { buildSignedAgreementPdf } from "@/components/booking/success/pdf/downloadSignedAgreementPdf";
import { HAVEN_AGREEMENT_CLAUSE_NUMBERS } from "@/constants/haven-agreement-content";

const TRANSPARENT_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

describe("buildSignedAgreementPdf", () => {
  it("creates a full signed agreement PDF", async () => {
    const data: BookingSuccessData = {
      bookingRef: "HR-AGREEMENT-123",
      contact: {
        name: "Test Renter",
        phone: "3055550100",
        email: "renter@example.com",
      },
      theatreName: "Haven Retreat",
      date: "12 Jun 2026",
      timeSlot: "18:00 - 22:00",
      locationName: "Miami",
      dateTime: "12 Jun 2026, 18:00 - 22:00",
      occasionDetails: [],
      guestCount: 20,
      totalAmount: 1200,
      advancePaid: 150,
      remainingPayable: 1050,
      items: [],
      signedAgreement: {
        id: "agreement-123",
        signerName: "Test Renter",
        signerEmail: "renter@example.com",
        signedAt: "2026-06-12T18:30:00.000Z",
        signatureImage: TRANSPARENT_PNG,
        agreementVersion: "v1",
        agreementHtmlSnapshot: null,
        acknowledgedClauses: [...HAVEN_AGREEMENT_CLAUSE_NUMBERS],
        confirmationAccepted: true,
      },
    };

    const result = await buildSignedAgreementPdf(data);

    expect(result.filename).toBe(
      "HR-AGREEMENT-123-signed-agreement.pdf"
    );
    expect(result.arrayBuffer.byteLength).toBeGreaterThan(5000);
    expect(
      Buffer.from(result.arrayBuffer).subarray(0, 4).toString()
    ).toBe("%PDF");
  });
});
