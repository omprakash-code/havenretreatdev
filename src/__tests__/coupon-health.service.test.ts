import { afterEach, describe, expect, it, vi } from "vitest";

import { assessCouponHealth } from "@/services/coupon/coupon-health.service";

afterEach(() => {
  vi.unstubAllEnvs();
});

function baseSummary() {
  return {
    activeReservedCount: 0,
    activeConfirmedCount: 0,
    activeUsageCount: 0,
    staleReservedCount: 0,
    staleReservedBookingCount: 0,
    mismatchCount: 0,
  };
}

describe("assessCouponHealth", () => {
  it("returns OK when mismatch and stale counts are zero", () => {
    const result = assessCouponHealth(baseSummary());
    expect(result.level).toBe("OK");
    expect(result.signals).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: "mismatchCount", level: "OK", value: 0 }),
        expect.objectContaining({ key: "staleReservedCount", level: "OK", value: 0 }),
      ])
    );
  });

  it("returns WARNING when counts cross warning threshold", () => {
    const result = assessCouponHealth({
      ...baseSummary(),
      mismatchCount: 1,
    });
    expect(result.level).toBe("WARNING");
    expect(result.signals.find((signal) => signal.key === "mismatchCount")?.level).toBe(
      "WARNING"
    );
  });

  it("returns CRITICAL when counts cross critical threshold", () => {
    const result = assessCouponHealth({
      ...baseSummary(),
      staleReservedCount: 22,
    });
    expect(result.level).toBe("CRITICAL");
    expect(
      result.signals.find((signal) => signal.key === "staleReservedCount")?.level
    ).toBe("CRITICAL");
  });

  it("respects environment threshold overrides", () => {
    vi.stubEnv("COUPON_HEALTH_MISMATCH_WARN", "2");
    vi.stubEnv("COUPON_HEALTH_MISMATCH_CRITICAL", "4");

    const warning = assessCouponHealth({
      ...baseSummary(),
      mismatchCount: 2,
    });
    expect(warning.level).toBe("WARNING");

    const critical = assessCouponHealth({
      ...baseSummary(),
      mismatchCount: 4,
    });
    expect(critical.level).toBe("CRITICAL");
  });
});
