import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

import {
  buildStoredSignedAgreementPdf,
  createStoredAgreementAttachment,
} from "@/lib/pdf/stored-signed-agreement";
import { HAVEN_AGREEMENT_CLAUSE_NUMBERS } from "@/constants/haven-agreement-content";
import { buildHavenAgreementHtmlSnapshot } from "@/lib/agreement-snapshot";

const TRANSPARENT_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

describe("stored signed agreement PDF", () => {
  it("builds a hashed attachment from the signed snapshot", async () => {
    const agreementRef = "HRA0612202600025";
    const stored = await buildStoredSignedAgreementPdf({
      bookingRef: "HR0612202600025",
      agreement: {
        id: agreementRef,
        signerName: "Test Renter",
        signerEmail: "renter@example.com",
        signedAt: "2026-06-12T18:30:00.000Z",
        signatureImage: TRANSPARENT_PNG,
        agreementVersion: "v1",
        agreementHtmlSnapshot: buildHavenAgreementHtmlSnapshot({
          version: "v1",
          acknowledgedClauses: [...HAVEN_AGREEMENT_CLAUSE_NUMBERS],
        }),
        acknowledgedClauses: [...HAVEN_AGREEMENT_CLAUSE_NUMBERS],
        confirmationAccepted: true,
      },
    });

    expect(stored.filename).toBe(
      "HRA0612202600025-signed-agreement.pdf"
    );
    expect(stored.content.subarray(0, 4).toString()).toBe("%PDF");
    expect(stored.sha256).toBe(
      createHash("sha256").update(stored.content).digest("hex")
    );
    expect(
      createStoredAgreementAttachment({
        filename: stored.filename,
        content: stored.content,
      })
    ).toEqual({
      filename: stored.filename,
      content: stored.content,
      contentType: "application/pdf",
    });
  });
});
