import type { CouponAuditSummary } from "@/services/coupon/coupon-audit.service";

export type CouponHealthLevel = "OK" | "WARNING" | "CRITICAL";

export type CouponHealthSignal = {
  key: "mismatchCount" | "staleReservedCount";
  level: CouponHealthLevel;
  value: number;
  warnThreshold: number;
  criticalThreshold: number;
};

export type CouponHealthAssessment = {
  level: CouponHealthLevel;
  signals: CouponHealthSignal[];
};

type CouponHealthThresholds = {
  mismatchWarn: number;
  mismatchCritical: number;
  staleReservedWarn: number;
  staleReservedCritical: number;
};

const DEFAULT_THRESHOLDS: CouponHealthThresholds = {
  mismatchWarn: 1,
  mismatchCritical: 5,
  staleReservedWarn: 1,
  staleReservedCritical: 20,
};

function toSafeThreshold(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  const normalized = Math.trunc(parsed);
  if (normalized < 0) return fallback;
  return normalized;
}

function resolveThresholds(): CouponHealthThresholds {
  return {
    mismatchWarn: toSafeThreshold(
      process.env.COUPON_HEALTH_MISMATCH_WARN,
      DEFAULT_THRESHOLDS.mismatchWarn
    ),
    mismatchCritical: toSafeThreshold(
      process.env.COUPON_HEALTH_MISMATCH_CRITICAL,
      DEFAULT_THRESHOLDS.mismatchCritical
    ),
    staleReservedWarn: toSafeThreshold(
      process.env.COUPON_HEALTH_STALE_RESERVED_WARN,
      DEFAULT_THRESHOLDS.staleReservedWarn
    ),
    staleReservedCritical: toSafeThreshold(
      process.env.COUPON_HEALTH_STALE_RESERVED_CRITICAL,
      DEFAULT_THRESHOLDS.staleReservedCritical
    ),
  };
}

function normalizeThresholdPair(warnThreshold: number, criticalThreshold: number) {
  const warn = Math.max(Math.trunc(warnThreshold), 1);
  const critical = Math.max(Math.trunc(criticalThreshold), warn);
  return { warn, critical };
}

function evaluateLevel(value: number, warnThreshold: number, criticalThreshold: number): CouponHealthLevel {
  if (!Number.isFinite(value) || value <= 0) return "OK";

  const { warn, critical } = normalizeThresholdPair(warnThreshold, criticalThreshold);

  if (value >= critical) return "CRITICAL";
  if (value >= warn) return "WARNING";
  return "OK";
}

function aggregateLevel(levels: CouponHealthLevel[]): CouponHealthLevel {
  if (levels.includes("CRITICAL")) return "CRITICAL";
  if (levels.includes("WARNING")) return "WARNING";
  return "OK";
}

export function assessCouponHealth(summary: CouponAuditSummary): CouponHealthAssessment {
  const thresholds = resolveThresholds();

  const mismatchSignal: CouponHealthSignal = {
    key: "mismatchCount",
    level: evaluateLevel(
      summary.mismatchCount,
      thresholds.mismatchWarn,
      thresholds.mismatchCritical
    ),
    value: summary.mismatchCount,
    warnThreshold: thresholds.mismatchWarn,
    criticalThreshold: thresholds.mismatchCritical,
  };

  const staleReservedSignal: CouponHealthSignal = {
    key: "staleReservedCount",
    level: evaluateLevel(
      summary.staleReservedCount,
      thresholds.staleReservedWarn,
      thresholds.staleReservedCritical
    ),
    value: summary.staleReservedCount,
    warnThreshold: thresholds.staleReservedWarn,
    criticalThreshold: thresholds.staleReservedCritical,
  };

  const signals = [mismatchSignal, staleReservedSignal];

  return {
    level: aggregateLevel(signals.map((signal) => signal.level)),
    signals,
  };
}
