import { describe, expect, it } from "vitest";
import { HAVEN_AGREEMENT_CLAUSE_NUMBERS } from "@/constants/haven-agreement-content";
import { normalizeAcknowledgedClauses } from "@/lib/agreement-acknowledgments";

describe("normalizeAcknowledgedClauses", () => {
  it("accepts all 33 clauses and sorts them", () => {
    const reversed = [...HAVEN_AGREEMENT_CLAUSE_NUMBERS].reverse();

    expect(normalizeAcknowledgedClauses(reversed)).toEqual(
      HAVEN_AGREEMENT_CLAUSE_NUMBERS
    );
  });

  it("rejects missing, duplicate, invalid, or additional values", () => {
    expect(
      normalizeAcknowledgedClauses(HAVEN_AGREEMENT_CLAUSE_NUMBERS.slice(0, -1))
    ).toBeNull();
    expect(
      normalizeAcknowledgedClauses([
        ...HAVEN_AGREEMENT_CLAUSE_NUMBERS.slice(0, -1),
        32,
      ])
    ).toBeNull();
    expect(
      normalizeAcknowledgedClauses([
        ...HAVEN_AGREEMENT_CLAUSE_NUMBERS.slice(0, -1),
        34,
      ])
    ).toBeNull();
    expect(
      normalizeAcknowledgedClauses([
        ...HAVEN_AGREEMENT_CLAUSE_NUMBERS,
        "extra",
      ])
    ).toBeNull();
  });
});
