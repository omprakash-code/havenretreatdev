import { describe, expect, it } from "vitest";

import { buildAgreementReference } from "@/lib/agreement-reference";

describe("buildAgreementReference", () => {
  it("creates a readable agreement reference from a Haven booking reference", () => {
    expect(buildAgreementReference("HR0612202600025")).toBe(
      "HRA0612202600025"
    );
  });

  it("normalizes legacy booking references", () => {
    expect(buildAgreementReference(" ds-book-123 ")).toBe("HRADSBOOK123");
  });
});
