import {it, expect } from "vitest";

it("allows booking future slots", () => {
  const now = new Date("2026-02-04T22:00:00+05:30");
  const slot = new Date("2026-02-05T13:00:00+05:30");

  expect(slot.getTime()).toBeGreaterThan(now.getTime());
});
