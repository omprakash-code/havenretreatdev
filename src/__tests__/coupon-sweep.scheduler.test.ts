import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { releaseStaleReservedCouponsMock } = vi.hoisted(() => ({
  releaseStaleReservedCouponsMock: vi.fn(),
}));
const { getCouponAuditReportMock } = vi.hoisted(() => ({
  getCouponAuditReportMock: vi.fn(),
}));
const { assessCouponHealthMock } = vi.hoisted(() => ({
  assessCouponHealthMock: vi.fn(),
}));
const { dispatchCouponHealthAlertMock } = vi.hoisted(() => ({
  dispatchCouponHealthAlertMock: vi.fn(),
}));

vi.mock("@/services/coupon/coupon-release.service", () => ({
  releaseStaleReservedCoupons: releaseStaleReservedCouponsMock,
}));
vi.mock("@/services/coupon/coupon-audit.service", () => ({
  getCouponAuditReport: getCouponAuditReportMock,
}));
vi.mock("@/services/coupon/coupon-health.service", () => ({
  assessCouponHealth: assessCouponHealthMock,
}));
vi.mock("@/services/coupon/coupon-health-alert.service", () => ({
  dispatchCouponHealthAlert: dispatchCouponHealthAlertMock,
}));

import {
  startCouponSweepScheduler,
  stopCouponSweepSchedulerForTests,
} from "@/services/coupon/coupon-sweep.scheduler";

const TEN_MINUTES_MS = 10 * 60 * 1000;
let consoleInfoSpy: ReturnType<typeof vi.spyOn>;
let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

async function flushMicrotasks() {
  await Promise.resolve();
  await Promise.resolve();
}

describe("coupon sweep scheduler", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    consoleInfoSpy = vi.spyOn(console, "info").mockImplementation(() => undefined);
    consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    stopCouponSweepSchedulerForTests();
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("COUPON_SWEEP_ENABLED", "false");
    getCouponAuditReportMock.mockResolvedValue({
      summary: {
        activeReservedCount: 0,
        activeConfirmedCount: 0,
        activeUsageCount: 0,
        staleReservedCount: 0,
        staleReservedBookingCount: 0,
        mismatchCount: 0,
      },
      mismatches: [],
      generatedAt: new Date(),
      lockWindowMinutes: 10,
    });
    assessCouponHealthMock.mockReturnValue({
      level: "OK",
      signals: [],
    });
    dispatchCouponHealthAlertMock.mockResolvedValue({
      dispatched: false,
      reason: "ok_level",
    });
  });

  afterEach(() => {
    consoleInfoSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    stopCouponSweepSchedulerForTests();
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it("does not run when scheduler is disabled", async () => {
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => undefined);

    startCouponSweepScheduler();
    await flushMicrotasks();

    expect(releaseStaleReservedCouponsMock).not.toHaveBeenCalled();
    expect(getCouponAuditReportMock).not.toHaveBeenCalled();
    expect(infoSpy).toHaveBeenCalledWith(
      "COUPON_SWEEP_DISABLED",
      { env: "production" }
    );
  });

  it("runs on startup and then every 10 minutes when enabled", async () => {
    vi.stubEnv("COUPON_SWEEP_ENABLED", "true");
    releaseStaleReservedCouponsMock.mockResolvedValue({
      releasedCount: 2,
      affectedBookings: ["booking-1"],
    });

    startCouponSweepScheduler();
    await flushMicrotasks();

    expect(releaseStaleReservedCouponsMock).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(TEN_MINUTES_MS);
    await flushMicrotasks();

    expect(releaseStaleReservedCouponsMock).toHaveBeenCalledTimes(2);
    expect(getCouponAuditReportMock).toHaveBeenCalledTimes(2);
    expect(assessCouponHealthMock).toHaveBeenCalledTimes(2);
    expect(dispatchCouponHealthAlertMock).not.toHaveBeenCalled();
  });

  it("skips overlapping execution while previous sweep is still running", async () => {
    vi.stubEnv("COUPON_SWEEP_ENABLED", "true");

    let resolveSweep!: (value: { releasedCount: number; affectedBookings: string[] }) => void;
    const pendingSweep = new Promise<{ releasedCount: number; affectedBookings: string[] }>(
      (resolve) => {
        resolveSweep = resolve;
      }
    );
    releaseStaleReservedCouponsMock.mockReturnValue(pendingSweep);

    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => undefined);

    startCouponSweepScheduler();
    await flushMicrotasks();
    expect(releaseStaleReservedCouponsMock).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(TEN_MINUTES_MS);
    await flushMicrotasks();

    expect(releaseStaleReservedCouponsMock).toHaveBeenCalledTimes(1);
    expect(infoSpy).toHaveBeenCalledWith(
      "COUPON_SWEEP_SKIP",
      expect.objectContaining({
        trigger: "interval",
        reason: "already_running",
      })
    );

    resolveSweep({ releasedCount: 0, affectedBookings: [] });
    await flushMicrotasks();
    expect(getCouponAuditReportMock).toHaveBeenCalledTimes(1);
    expect(assessCouponHealthMock).toHaveBeenCalledTimes(1);
  });

  it("dispatches alert when health level is not OK", async () => {
    vi.stubEnv("COUPON_SWEEP_ENABLED", "true");
    releaseStaleReservedCouponsMock.mockResolvedValue({
      releasedCount: 0,
      affectedBookings: [],
    });
    getCouponAuditReportMock.mockResolvedValue({
      summary: {
        activeReservedCount: 3,
        activeConfirmedCount: 10,
        activeUsageCount: 13,
        staleReservedCount: 2,
        staleReservedBookingCount: 2,
        mismatchCount: 1,
      },
      mismatches: [],
      generatedAt: new Date("2026-02-25T12:30:00.000Z"),
      lockWindowMinutes: 10,
    });
    assessCouponHealthMock.mockReturnValue({
      level: "WARNING",
      signals: [],
    });

    startCouponSweepScheduler();
    await flushMicrotasks();

    expect(dispatchCouponHealthAlertMock).toHaveBeenCalledTimes(1);
    expect(dispatchCouponHealthAlertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "scheduler",
        trigger: "startup",
        health: expect.objectContaining({ level: "WARNING" }),
      })
    );
  });
});
