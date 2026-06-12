import { HAVEN_AGREEMENT_CLAUSE_NUMBERS } from "@/constants/haven-agreement-content";

export function normalizeAcknowledgedClauses(value: unknown): number[] | null {
  if (!Array.isArray(value)) return null;
  if (
    value.length !== HAVEN_AGREEMENT_CLAUSE_NUMBERS.length ||
    !value.every(
      (entry): entry is number =>
        typeof entry === "number" && Number.isInteger(entry)
    )
  ) {
    return null;
  }

  const clauses = [...new Set(value)].sort((left, right) => left - right);
  const isComplete =
    clauses.length === HAVEN_AGREEMENT_CLAUSE_NUMBERS.length &&
    HAVEN_AGREEMENT_CLAUSE_NUMBERS.every(
      (clauseNumber, index) => clauses[index] === clauseNumber
    );

  return isComplete ? clauses : null;
}
