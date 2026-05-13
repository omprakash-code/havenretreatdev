/**
 * // src/lib/date.ts
 * SINGLE SOURCE OF TRUTH for date comparison.
 * Rule:
 * - All YYYY-MM-DD strings = LOCAL date
 * - All comparisons use LOCAL midnight timestamps
 * 
 * CRITICAL:
 * Any date/time logic must go through this file.
 * Do NOT use toISOString(), Date.now() comparisons directly.
 * All booking, availability, and expiry logic depends on this.
 */

export function startOfDay(date: Date) {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate()
  );
}

export function addDays(date: Date, days: number) {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate() + days
  );
}

/**
 * DO NOT USE toISOString() — it breaks dates
 */
export function toDateKeyString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Used everywhere for comparison
 */
export function toDateKey(input: Date | string): number {
  if (typeof input === "string") {
    const [y, m, d] = input.split("-").map(Number);
    return new Date(y, m - 1, d).getTime();
  }

  return new Date(
    input.getFullYear(),
    input.getMonth(),
    input.getDate()
  ).getTime();
}
