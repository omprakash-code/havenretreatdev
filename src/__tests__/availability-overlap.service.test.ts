import { describe, expect, it } from "vitest";

import {
  mergeMinuteRanges,
  rangesOverlap,
  subtractMinuteRanges,
} from "@/services/availability/overlap.service";

describe("availability overlap service", () => {
  it("treats adjacent ranges as non-overlapping", () => {
    expect(
      rangesOverlap(
        { start: 9 * 60, end: 13 * 60 },
        { start: 13 * 60, end: 17 * 60 }
      )
    ).toBe(false);
  });

  it("merges overlapping and adjacent occupied ranges", () => {
    expect(
      mergeMinuteRanges([
        { start: 9 * 60, end: 14 * 60 },
        { start: 14 * 60, end: 15 * 60 },
        { start: 18 * 60, end: 19 * 60 },
      ])
    ).toEqual([
      { start: 9 * 60, end: 15 * 60 },
      { start: 18 * 60, end: 19 * 60 },
    ]);
  });

  it("subtracts occupied ranges from business hours", () => {
    expect(
      subtractMinuteRanges(
        { start: 9 * 60, end: 23 * 60 },
        [
          { start: 9 * 60, end: 14 * 60 },
          { start: 18 * 60, end: 20 * 60 },
        ]
      )
    ).toEqual([
      { start: 14 * 60, end: 18 * 60 },
      { start: 20 * 60, end: 23 * 60 },
    ]);
  });
});
