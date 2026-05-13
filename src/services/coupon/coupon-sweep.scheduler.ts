import { releaseStaleReservedCoupons } from "@/services/coupon/coupon-release.service";
import { getCouponAuditReport } from "@/services/coupon/coupon-audit.service";
import { assessCouponHealth } from "@/services/coupon/coupon-health.service";
import { dispatchCouponHealthAlert } from "@/services/coupon/coupon-health-alert.service";

const COUPON_SWEEP_INTERVAL_MS = 10 * 60 * 1000;

type CouponSweepSchedulerState = {
  initialized: boolean;
  running: boolean;
  timer: NodeJS.Timeout | null;
};

declare global {
  var __couponSweepSchedulerState__: CouponSweepSchedulerState | undefined;
}

function getState(): CouponSweepSchedulerState {
  if (!globalThis.__couponSweepSchedulerState__) {
    globalThis.__couponSweepSchedulerState__ = {
      initialized: false,
      running: false,
      timer: null,
    };
  }

  return globalThis.__couponSweepSchedulerState__;
}

function isSweepEnabled() {
  return String(process.env.COUPON_SWEEP_ENABLED ?? "").toLowerCase() === "true";
}

function isHealthSnapshotEnabled() {
  const value = String(process.env.COUPON_SWEEP_HEALTH_LOG_ENABLED ?? "true").toLowerCase();
  return value !== "false";
}

async function logCouponHealthSnapshot(trigger: "startup" | "interval") {
  if (!isHealthSnapshotEnabled()) return;

  const startedAtMs = Date.now();
  try {
    const report = await getCouponAuditReport({ mismatchLimit: 0 });
    const health = assessCouponHealth(report.summary);

    const payload = {
      timestamp: new Date().toISOString(),
      trigger,
      level: health.level,
      durationMs: Date.now() - startedAtMs,
      summary: report.summary,
    };

    if (health.level === "OK") {
      console.info("COUPON_HEALTH_SNAPSHOT", payload);
      return;
    }

    console.warn("COUPON_HEALTH_SNAPSHOT", payload);
    await dispatchCouponHealthAlert({
      health,
      summary: report.summary,
      source: "scheduler",
      trigger,
      generatedAt: report.generatedAt,
    });
  } catch (error) {
    console.error("COUPON_HEALTH_SNAPSHOT_ERROR", {
      timestamp: new Date().toISOString(),
      trigger,
      durationMs: Date.now() - startedAtMs,
      message: error instanceof Error ? error.message : "Unknown health snapshot error",
    });
  }
}

async function runSweep(trigger: "startup" | "interval") {
  const state = getState();
  if (state.running) {
    console.info("COUPON_SWEEP_SKIP", { trigger, reason: "already_running" });
    return;
  }

  state.running = true;
  const startedAtMs = Date.now();

  try {
    const result = await releaseStaleReservedCoupons();

    console.info("COUPON_SWEEP_DONE", {
      trigger,
      released: result.releasedCount,
      durationMs: Date.now() - startedAtMs,
    });

    await logCouponHealthSnapshot(trigger);
  } catch (error) {
    console.error("COUPON_SWEEP_ERROR", {
      trigger,
      durationMs: Date.now() - startedAtMs,
      message: error instanceof Error ? error.message : "Unknown sweep error",
    });
  } finally {
    state.running = false;
  }
}

export function startCouponSweepScheduler() {
  const state = getState();

  if (state.initialized) {
    return;
  }

  if (!isSweepEnabled()) {
    console.info("COUPON_SWEEP_DISABLED", { env: process.env.NODE_ENV ?? "unknown" });
    return;
  }

  state.initialized = true;

  const isProd = process.env.NODE_ENV === "production";
  console.info("COUPON_SWEEP_ENABLED", {
    mode: isProd ? "production" : "non_production_explicit",
    intervalMin: 10,
  });

  void runSweep("startup");

  state.timer = setInterval(() => {
    void runSweep("interval");
  }, COUPON_SWEEP_INTERVAL_MS);

  state.timer.unref?.();
}

export function stopCouponSweepSchedulerForTests() {
  const state = getState();
  if (state.timer) {
    clearInterval(state.timer);
  }
  state.timer = null;
  state.initialized = false;
  state.running = false;
}
