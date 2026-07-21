import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createPerformanceProfiler } from "@/lib/performance-profiler";

describe("createPerformanceProfiler", () => {
  let debugSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.unstubAllEnvs();
    debugSpy = vi.spyOn(console, "debug").mockImplementation(() => undefined);
  });

  afterEach(() => {
    debugSpy.mockRestore();
    vi.unstubAllEnvs();
  });

  it("keeps measurements silent unless booking performance debug is enabled", () => {
    const profiler = createPerformanceProfiler("TEST_TIMINGS");

    profiler.measureSync("Step", "Critical", () => undefined);
    profiler.report({ outcome: "success" });

    expect(debugSpy).not.toHaveBeenCalled();
  });

  it("emits detailed timings when booking performance debug is enabled", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("BOOKING_PERFORMANCE_DEBUG", "true");
    const profiler = createPerformanceProfiler("TEST_TIMINGS");

    profiler.measureSync("Step", "Critical", () => undefined);
    profiler.report({ outcome: "success" });

    expect(debugSpy).toHaveBeenCalledWith(
      "TEST_TIMINGS",
      expect.objectContaining({
        outcome: "success",
        steps: [expect.objectContaining({ step: "Step", kind: "Critical" })],
        slowest: [expect.objectContaining({ step: "Step" })],
      })
    );
  });
});
