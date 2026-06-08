import { beforeEach, describe, expect, it, vi } from "vitest";

const { rangeAvailabilityMock } = vi.hoisted(() => ({
  rangeAvailabilityMock: vi.fn(),
}));

vi.mock("@/services/availability/availability.service", () => ({
  getRangeAvailabilityForLocation: rangeAvailabilityMock,
}));

import {
  compareTimeRangeAvailability,
  getAvailabilityShadowSummaryForTests,
  resetAvailabilityShadowSummaryForTests,
} from "@/services/availability/availability-shadow.service";

describe("availability shadow service", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
    resetAvailabilityShadowSummaryForTests();
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  it("does nothing when the feature flag is disabled", async () => {
    vi.stubEnv("AVAILABILITY_ENGINE_ENABLED", "false");

    await compareTimeRangeAvailability({
      locationId: "location-1",
      date: "2026-07-04",
      legacyRanges: [],
      legacyDurationMs: 2,
    });

    expect(rangeAvailabilityMock).not.toHaveBeenCalled();
    expect(getAvailabilityShadowSummaryForTests().comparisons).toBe(0);
  });

  it("records matches and emits summary metrics", async () => {
    vi.stubEnv("AVAILABILITY_ENGINE_ENABLED", "true");
    rangeAvailabilityMock.mockResolvedValue({
      unavailableRanges: [
        { startTime: "09:00", endTime: "14:00", reason: "BOOKED" },
      ],
      theatres: [],
      durationMs: 3,
    });

    await compareTimeRangeAvailability({
      locationId: "location-1",
      date: "2026-07-04",
      legacyRanges: [
        { startTime: "09:00", endTime: "14:00", reason: "BOOKED" },
      ],
      legacyDurationMs: 2,
    });

    expect(getAvailabilityShadowSummaryForTests()).toMatchObject({
      comparisons: 1,
      matches: 1,
      mismatches: 0,
      matchRate: 100,
      averageLegacyDurationMs: 2,
      averageRangeDurationMs: 3,
    });
    expect(console.info).toHaveBeenCalledWith(
      "AVAILABILITY_SHADOW_SUMMARY",
      expect.objectContaining({ matchRate: 100 })
    );
  });

  it("isolates range-engine failures", async () => {
    vi.stubEnv("AVAILABILITY_ENGINE_ENABLED", "true");
    rangeAvailabilityMock.mockRejectedValue(new Error("range failed"));

    await expect(
      compareTimeRangeAvailability({
        locationId: "location-1",
        date: "2026-07-04",
        legacyRanges: [],
        legacyDurationMs: 2,
      })
    ).resolves.toBeUndefined();

    expect(getAvailabilityShadowSummaryForTests().errors).toBe(1);
  });

  it("records and reports normalized mismatches", async () => {
    vi.stubEnv("AVAILABILITY_ENGINE_ENABLED", "true");
    rangeAvailabilityMock.mockResolvedValue({
      unavailableRanges: [
        { startTime: "09:00", endTime: "14:00", reason: "BOOKED" },
      ],
      theatres: [
        {
          theatreId: "theatre-1",
          counts: { bookings: 1, locks: 0, blocks: 0 },
        },
      ],
      durationMs: 4,
    });

    await compareTimeRangeAvailability({
      locationId: "location-1",
      date: "2026-07-04",
      legacyRanges: [
        { startTime: "09:00", endTime: "13:00", reason: "BOOKED" },
      ],
      legacyDurationMs: 2,
    });

    expect(getAvailabilityShadowSummaryForTests()).toMatchObject({
      comparisons: 1,
      matches: 0,
      mismatches: 1,
      matchRate: 0,
    });
    expect(console.warn).toHaveBeenCalledWith(
      "AVAILABILITY_SHADOW_MISMATCH",
      expect.objectContaining({
        missingFromRangeEngine: ["09:00|13:00|BOOKED"],
        unexpectedFromRangeEngine: ["09:00|14:00|BOOKED"],
      })
    );
  });
});
