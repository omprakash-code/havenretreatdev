import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  dispatchCouponHealthAlert,
  resetCouponHealthAlertStateForTests,
} from "@/services/coupon/coupon-health-alert.service";

let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

const warningHealth = {
  level: "WARNING" as const,
  signals: [],
};

const criticalHealth = {
  level: "CRITICAL" as const,
  signals: [],
};

const summary = {
  activeReservedCount: 1,
  activeConfirmedCount: 2,
  activeUsageCount: 3,
  staleReservedCount: 1,
  staleReservedBookingCount: 1,
  mismatchCount: 1,
};

describe("dispatchCouponHealthAlert", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.unstubAllEnvs();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-25T00:00:00.000Z"));
    resetCouponHealthAlertStateForTests();
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.useRealTimers();
    resetCouponHealthAlertStateForTests();
  });

  it("does not dispatch when disabled", async () => {
    vi.stubEnv("COUPON_HEALTH_ALERT_ENABLED", "false");
    const fetchMock = global.fetch as unknown as ReturnType<typeof vi.fn>;

    const result = await dispatchCouponHealthAlert({
      health: criticalHealth,
      summary,
      source: "scheduler",
      trigger: "startup",
    });

    expect(result).toEqual({ dispatched: false, reason: "disabled" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("respects minimum alert level", async () => {
    vi.stubEnv("COUPON_HEALTH_ALERT_ENABLED", "true");
    vi.stubEnv("COUPON_HEALTH_ALERT_MIN_LEVEL", "CRITICAL");

    const result = await dispatchCouponHealthAlert({
      health: warningHealth,
      summary,
      source: "scheduler",
      trigger: "interval",
    });

    expect(result).toEqual({ dispatched: false, reason: "below_min_level" });
  });

  it("dispatches via webhook when enabled", async () => {
    vi.stubEnv("COUPON_HEALTH_ALERT_ENABLED", "true");
    vi.stubEnv("COUPON_HEALTH_ALERT_MIN_LEVEL", "WARNING");
    vi.stubEnv("COUPON_HEALTH_ALERT_WEBHOOK_URL", "https://example.com/hook");
    const fetchMock = global.fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
    });

    const result = await dispatchCouponHealthAlert({
      health: warningHealth,
      summary,
      source: "scheduler",
      trigger: "interval",
    });

    expect(result).toEqual({ dispatched: true, reason: "dispatched" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("enforces cooldown for same level alerts", async () => {
    vi.stubEnv("COUPON_HEALTH_ALERT_ENABLED", "true");
    vi.stubEnv("COUPON_HEALTH_ALERT_MIN_LEVEL", "WARNING");
    vi.stubEnv("COUPON_HEALTH_ALERT_WEBHOOK_URL", "https://example.com/hook");
    vi.stubEnv("COUPON_HEALTH_ALERT_COOLDOWN_MINUTES", "30");
    const fetchMock = global.fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
    });

    const first = await dispatchCouponHealthAlert({
      health: warningHealth,
      summary,
      source: "scheduler",
      trigger: "interval",
    });
    const second = await dispatchCouponHealthAlert({
      health: warningHealth,
      summary,
      source: "scheduler",
      trigger: "interval",
    });

    expect(first).toEqual({ dispatched: true, reason: "dispatched" });
    expect(second).toEqual({ dispatched: false, reason: "cooldown_active" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("bypasses cooldown on escalation", async () => {
    vi.stubEnv("COUPON_HEALTH_ALERT_ENABLED", "true");
    vi.stubEnv("COUPON_HEALTH_ALERT_MIN_LEVEL", "WARNING");
    vi.stubEnv("COUPON_HEALTH_ALERT_WEBHOOK_URL", "https://example.com/hook");
    vi.stubEnv("COUPON_HEALTH_ALERT_COOLDOWN_MINUTES", "30");
    const fetchMock = global.fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
    });

    const first = await dispatchCouponHealthAlert({
      health: warningHealth,
      summary,
      source: "scheduler",
      trigger: "interval",
    });
    const second = await dispatchCouponHealthAlert({
      health: criticalHealth,
      summary,
      source: "scheduler",
      trigger: "interval",
    });

    expect(first).toEqual({ dispatched: true, reason: "dispatched" });
    expect(second).toEqual({ dispatched: true, reason: "dispatched" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("returns dispatch_failed on webhook failure", async () => {
    vi.stubEnv("COUPON_HEALTH_ALERT_ENABLED", "true");
    vi.stubEnv("COUPON_HEALTH_ALERT_MIN_LEVEL", "WARNING");
    vi.stubEnv("COUPON_HEALTH_ALERT_WEBHOOK_URL", "https://example.com/hook");
    const fetchMock = global.fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
    });

    const result = await dispatchCouponHealthAlert({
      health: criticalHealth,
      summary,
      source: "scheduler",
      trigger: "interval",
    });

    expect(result).toEqual({ dispatched: false, reason: "dispatch_failed" });
  });
});
