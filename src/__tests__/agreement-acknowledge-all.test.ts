import { describe, expect, it } from "vitest";

import {
  HAVEN_AGREEMENT_CLAUSE_NUMBERS,
  HAVEN_AGREEMENT_REQUIRED_ACKNOWLEDGMENTS,
  HAVEN_AGREEMENT_SECTIONS,
  HAVEN_AGREEMENT_TOTAL_CLAUSES,
} from "@/constants/haven-agreement-content";

/** Mirrors the agreement step's "acknowledge all" toggle. */
function buildAcknowledgedClauses(acknowledged: boolean) {
  return Object.fromEntries(
    HAVEN_AGREEMENT_CLAUSE_NUMBERS.map((clauseNumber) => [
      clauseNumber,
      acknowledged,
    ])
  ) as Record<number, boolean>;
}

describe("acknowledge all clauses", () => {
  it("acknowledges every clause the submit payload requires", () => {
    const acknowledged = buildAcknowledgedClauses(true);

    const selected = HAVEN_AGREEMENT_CLAUSE_NUMBERS.filter(
      (clauseNumber) => acknowledged[clauseNumber]
    );

    expect(selected).toHaveLength(HAVEN_AGREEMENT_TOTAL_CLAUSES);
    expect(
      HAVEN_AGREEMENT_CLAUSE_NUMBERS.every(
        (clauseNumber) => acknowledged[clauseNumber]
      )
    ).toBe(true);
  });

  it("clears every clause when toggled off", () => {
    const acknowledged = buildAcknowledgedClauses(false);

    expect(
      HAVEN_AGREEMENT_CLAUSE_NUMBERS.some(
        (clauseNumber) => acknowledged[clauseNumber]
      )
    ).toBe(false);
  });

  it("covers the required-acknowledgment sections, not just the numbered ones", () => {
    // The check-all writes HAVEN_AGREEMENT_CLAUSE_NUMBERS, while the trailing
    // sections render by their own `number`. If those ever fall outside the
    // range, check-all would silently leave clauses (e.g. Section 33) unticked.
    const acknowledged = buildAcknowledgedClauses(true);

    for (const section of HAVEN_AGREEMENT_REQUIRED_ACKNOWLEDGMENTS) {
      expect(HAVEN_AGREEMENT_CLAUSE_NUMBERS).toContain(section.number);
      expect(acknowledged[section.number]).toBe(true);
    }

    // The numbered sections occupy 1..n and the required ones continue after.
    HAVEN_AGREEMENT_SECTIONS.forEach((_, index) => {
      expect(acknowledged[index + 1]).toBe(true);
    });
  });
});
