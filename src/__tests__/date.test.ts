// src/__tests__/date.test.ts
import { describe, it, expect } from "vitest";
import { toDateKey } from "@/lib/date";

describe("date helpers", () => {
  it("treats YYYY-MM-DD as local calendar date", () => {
    const key = toDateKey("2026-02-05");
    const expected = new Date(2026, 1, 5).getTime(); // Feb = 1

    expect(key).toBe(expected);
  });
});

it("does not confuse future day with today", () => {
  const today = new Date(2026, 1, 4); // Feb 4
  const tomorrowKey = toDateKey("2026-02-05");

  expect(tomorrowKey).toBeGreaterThan(today.getTime());
});
