import { describe, expect, it } from "vitest";

import {
  DEFAULT_LOCATION_NAME,
  resolveLocationDisplayName,
} from "@/lib/location-display";

describe("resolveLocationDisplayName", () => {
  it("prefers the configured location name", () => {
    expect(resolveLocationDisplayName("Miami", "Fort Lauderdale")).toBe("Miami");
  });

  it("uses the venue city instead of the venue brand name", () => {
    expect(resolveLocationDisplayName(null, "Miami")).toBe("Miami");
  });

  it("falls back to the default location", () => {
    expect(resolveLocationDisplayName()).toBe(DEFAULT_LOCATION_NAME);
  });
});
