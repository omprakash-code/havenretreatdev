import { after } from "next/server";

import type { AvailabilityRange } from "@/types/availability";
import { getRangeAvailabilityForLocation } from "./availability.service";

type ShadowMetrics = {
  comparisons: number;
  matches: number;
  mismatches: number;
  errors: number;
  legacyDurationTotalMs: number;
  rangeDurationTotalMs: number;
  rangeDurationMaxMs: number;
};

declare global {
  var __availabilityShadowMetrics__: ShadowMetrics | undefined;
}

function getMetrics() {
  if (!globalThis.__availabilityShadowMetrics__) {
    globalThis.__availabilityShadowMetrics__ = {
      comparisons: 0,
      matches: 0,
      mismatches: 0,
      errors: 0,
      legacyDurationTotalMs: 0,
      rangeDurationTotalMs: 0,
      rangeDurationMaxMs: 0,
    };
  }
  return globalThis.__availabilityShadowMetrics__;
}

export function isAvailabilityEngineEnabled() {
  return (
    String(process.env.AVAILABILITY_ENGINE_ENABLED ?? "false").toLowerCase() ===
    "true"
  );
}

export function scheduleAvailabilityShadow(task: () => Promise<void>) {
  if (!isAvailabilityEngineEnabled()) return;
  try {
    after(task);
  } catch {
    // Direct route invocation in tests has no request lifecycle.
    void task();
  }
}

function getDateSampleLimit() {
  const parsed = Number(process.env.AVAILABILITY_SHADOW_DATE_SAMPLE_LIMIT ?? 3);
  if (!Number.isFinite(parsed)) return 3;
  return Math.min(Math.max(Math.trunc(parsed), 1), 14);
}

function rangeKey(range: AvailabilityRange) {
  return `${range.startTime}|${range.endTime}|${range.reason}`;
}

function summarizeMetrics() {
  const metrics = getMetrics();
  const matchRate =
    metrics.comparisons === 0
      ? 0
      : Number(((metrics.matches / metrics.comparisons) * 100).toFixed(2));

  return {
    comparisons: metrics.comparisons,
    matches: metrics.matches,
    mismatches: metrics.mismatches,
    errors: metrics.errors,
    matchRate,
    averageLegacyDurationMs:
      metrics.comparisons === 0
        ? 0
        : Number(
            (metrics.legacyDurationTotalMs / metrics.comparisons).toFixed(2)
          ),
    averageRangeDurationMs:
      metrics.comparisons === 0
        ? 0
        : Number((metrics.rangeDurationTotalMs / metrics.comparisons).toFixed(2)),
    maxRangeDurationMs: Number(metrics.rangeDurationMaxMs.toFixed(2)),
  };
}

function recordResult(input: {
  matched: boolean;
  legacyDurationMs: number;
  rangeDurationMs: number;
}) {
  const metrics = getMetrics();
  metrics.comparisons += 1;
  metrics.matches += input.matched ? 1 : 0;
  metrics.mismatches += input.matched ? 0 : 1;
  metrics.legacyDurationTotalMs += input.legacyDurationMs;
  metrics.rangeDurationTotalMs += input.rangeDurationMs;
  metrics.rangeDurationMaxMs = Math.max(
    metrics.rangeDurationMaxMs,
    input.rangeDurationMs
  );
  console.info("AVAILABILITY_SHADOW_SUMMARY", summarizeMetrics());
}

function recordError(input: {
  endpoint: string;
  locationId: string;
  date?: string;
  error: unknown;
}) {
  getMetrics().errors += 1;
  console.error("AVAILABILITY_SHADOW_ERROR", {
    endpoint: input.endpoint,
    locationId: input.locationId,
    date: input.date ?? null,
    message: input.error instanceof Error ? input.error.message : String(input.error),
    summary: summarizeMetrics(),
  });
}

export async function compareTimeRangeAvailability(input: {
  locationId: string;
  date: string;
  legacyRanges: AvailabilityRange[];
  legacyDurationMs: number;
  requestId?: string | null;
}) {
  if (!isAvailabilityEngineEnabled()) return;

  try {
    const rangeResult = await getRangeAvailabilityForLocation({
      locationId: input.locationId,
      date: input.date,
    });
    const legacyKeys = new Set(input.legacyRanges.map(rangeKey));
    const rangeKeys = new Set(rangeResult.unavailableRanges.map(rangeKey));
    const missingFromRangeEngine = [...legacyKeys].filter(
      (key) => !rangeKeys.has(key)
    );
    const unexpectedFromRangeEngine = [...rangeKeys].filter(
      (key) => !legacyKeys.has(key)
    );
    const matched =
      missingFromRangeEngine.length === 0 &&
      unexpectedFromRangeEngine.length === 0;

    recordResult({
      matched,
      legacyDurationMs: input.legacyDurationMs,
      rangeDurationMs: rangeResult.durationMs,
    });

    if (!matched) {
      console.warn("AVAILABILITY_SHADOW_MISMATCH", {
        endpoint: "time-ranges",
        requestId: input.requestId ?? null,
        locationId: input.locationId,
        date: input.date,
        missingFromRangeEngine,
        unexpectedFromRangeEngine,
        legacyRanges: input.legacyRanges,
        rangeEngineRanges: rangeResult.unavailableRanges,
        counts: rangeResult.theatres.map((theatre) => ({
          theatreId: theatre.theatreId,
          ...theatre.counts,
        })),
        legacyDurationMs: input.legacyDurationMs,
        rangeDurationMs: rangeResult.durationMs,
      });
    }
  } catch (error) {
    recordError({
      endpoint: "time-ranges",
      locationId: input.locationId,
      date: input.date,
      error,
    });
  }
}

export async function compareLegacyDates(input: {
  locationId: string;
  legacyDates: string[];
  legacyDurationMs: number;
  requestId?: string | null;
}) {
  if (!isAvailabilityEngineEnabled()) return;

  try {
    const sampleLimit = getDateSampleLimit();
    const sampledDates = input.legacyDates.slice(0, sampleLimit);
    const rangeResults = await Promise.all(
      sampledDates.map((date) =>
        getRangeAvailabilityForLocation({
          locationId: input.locationId,
          date,
        })
      )
    );
    const rangeAvailableDates = rangeResults
      .filter((result) => result.hasAvailability)
      .map((result) => result.date);
    const unavailableLegacyDates = sampledDates.filter(
      (date) => !rangeAvailableDates.includes(date)
    );
    const rangeDurationMs = Number(
      rangeResults
        .reduce((sum, result) => sum + result.durationMs, 0)
        .toFixed(2)
    );
    const matched = unavailableLegacyDates.length === 0;

    recordResult({
      matched,
      legacyDurationMs: input.legacyDurationMs,
      rangeDurationMs,
    });

    if (!matched) {
      console.warn("AVAILABILITY_SHADOW_MISMATCH", {
        endpoint: "dates",
        comparisonScope: "legacy_advertised_dates",
        requestId: input.requestId ?? null,
        locationId: input.locationId,
        unavailableLegacyDates,
        legacyDateCount: input.legacyDates.length,
        sampledDateCount: sampledDates.length,
        rangeAvailableDateCount: rangeAvailableDates.length,
        legacyDurationMs: input.legacyDurationMs,
        rangeDurationMs,
      });
    }
  } catch (error) {
    recordError({
      endpoint: "dates",
      locationId: input.locationId,
      error,
    });
  }
}

export function getAvailabilityShadowSummaryForTests() {
  return summarizeMetrics();
}

export function resetAvailabilityShadowSummaryForTests() {
  globalThis.__availabilityShadowMetrics__ = undefined;
}
