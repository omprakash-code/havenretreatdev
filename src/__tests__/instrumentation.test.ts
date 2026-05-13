import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { startCouponSweepSchedulerMock } = vi.hoisted(() => ({
  startCouponSweepSchedulerMock: vi.fn(),
}));

vi.mock("@/services/coupon/coupon-sweep.scheduler", () => ({
  startCouponSweepScheduler: startCouponSweepSchedulerMock,
}));

import { register } from "@/instrumentation";

let consoleInfoSpy: ReturnType<typeof vi.spyOn>;

describe("instrumentation register", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    consoleInfoSpy = vi.spyOn(console, "info").mockImplementation(() => undefined);
  });

  afterEach(() => {
    consoleInfoSpy.mockRestore();
    vi.unstubAllEnvs();
  });

  it("does not start scheduler on non-node runtime", async () => {
    vi.stubEnv("NEXT_RUNTIME", "edge");

    await register();

    expect(startCouponSweepSchedulerMock).not.toHaveBeenCalled();
  });

  it("starts scheduler on node runtime", async () => {
    vi.stubEnv("NEXT_RUNTIME", "nodejs");

    await register();

    expect(startCouponSweepSchedulerMock).toHaveBeenCalledTimes(1);
  });
});
