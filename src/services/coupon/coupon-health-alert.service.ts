import type { CouponAuditSummary } from "@/services/coupon/coupon-audit.service";
import type {
  CouponHealthAssessment,
  CouponHealthLevel,
} from "@/services/coupon/coupon-health.service";

type CouponHealthAlertSource = "scheduler" | "manual";
type CouponHealthAlertTrigger = "startup" | "interval" | "on-demand";

type CouponHealthAlertState = {
  lastLevel: CouponHealthLevel | null;
  lastSentAtMs: number | null;
};

type DispatchCouponHealthAlertInput = {
  health: CouponHealthAssessment;
  summary: CouponAuditSummary;
  source: CouponHealthAlertSource;
  trigger?: CouponHealthAlertTrigger;
  generatedAt?: Date;
};

export type DispatchCouponHealthAlertResult = {
  dispatched: boolean;
  reason:
    | "disabled"
    | "ok_level"
    | "below_min_level"
    | "cooldown_active"
    | "dispatched"
    | "dispatch_failed";
};

const DEFAULT_COOLDOWN_MINUTES = 30;
const LEVEL_RANK: Record<CouponHealthLevel, number> = {
  OK: 0,
  WARNING: 1,
  CRITICAL: 2,
};

declare global {
  var __couponHealthAlertState__: CouponHealthAlertState | undefined;
}

function getState(): CouponHealthAlertState {
  if (!globalThis.__couponHealthAlertState__) {
    globalThis.__couponHealthAlertState__ = {
      lastLevel: null,
      lastSentAtMs: null,
    };
  }

  return globalThis.__couponHealthAlertState__;
}

function isAlertEnabled() {
  return String(process.env.COUPON_HEALTH_ALERT_ENABLED ?? "").toLowerCase() === "true";
}

function resolveMinLevel(): CouponHealthLevel {
  const configured = String(process.env.COUPON_HEALTH_ALERT_MIN_LEVEL ?? "CRITICAL")
    .trim()
    .toUpperCase();
  if (configured === "WARNING") return "WARNING";
  if (configured === "CRITICAL") return "CRITICAL";
  return "CRITICAL";
}

function resolveCooldownMs() {
  const parsed = Number(process.env.COUPON_HEALTH_ALERT_COOLDOWN_MINUTES);
  if (!Number.isFinite(parsed)) return DEFAULT_COOLDOWN_MINUTES * 60 * 1000;
  const normalizedMinutes = Math.max(Math.trunc(parsed), 0);
  return normalizedMinutes * 60 * 1000;
}

function shouldSkipDueToCooldown(level: CouponHealthLevel, nowMs: number) {
  const state = getState();
  if (!state.lastLevel || !state.lastSentAtMs) return false;

  if (LEVEL_RANK[level] > LEVEL_RANK[state.lastLevel]) {
    return false;
  }

  return nowMs - state.lastSentAtMs < resolveCooldownMs();
}

function markAlertSent(level: CouponHealthLevel, nowMs: number) {
  const state = getState();
  state.lastLevel = level;
  state.lastSentAtMs = nowMs;
}

function toPayload(input: DispatchCouponHealthAlertInput) {
  return {
    timestamp: new Date().toISOString(),
    source: input.source,
    trigger: input.trigger ?? "on-demand",
    level: input.health.level,
    generatedAt: (input.generatedAt ?? new Date()).toISOString(),
    signals: input.health.signals,
    summary: input.summary,
  };
}

async function postWebhook(payload: ReturnType<typeof toPayload>) {
  const webhookUrl = String(process.env.COUPON_HEALTH_ALERT_WEBHOOK_URL ?? "").trim();
  if (!webhookUrl) {
    console.warn("COUPON_HEALTH_ALERT", payload);
    return true;
  }

  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(`Webhook responded ${res.status}`);
  }

  return true;
}

export async function dispatchCouponHealthAlert(
  input: DispatchCouponHealthAlertInput
): Promise<DispatchCouponHealthAlertResult> {
  if (!isAlertEnabled()) {
    return { dispatched: false, reason: "disabled" };
  }

  if (input.health.level === "OK") {
    return { dispatched: false, reason: "ok_level" };
  }

  const minLevel = resolveMinLevel();
  if (LEVEL_RANK[input.health.level] < LEVEL_RANK[minLevel]) {
    return { dispatched: false, reason: "below_min_level" };
  }

  const nowMs = Date.now();
  if (shouldSkipDueToCooldown(input.health.level, nowMs)) {
    return { dispatched: false, reason: "cooldown_active" };
  }

  const payload = toPayload(input);

  try {
    await postWebhook(payload);
    markAlertSent(input.health.level, nowMs);
    return { dispatched: true, reason: "dispatched" };
  } catch (error) {
    console.error("COUPON_HEALTH_ALERT_ERROR", {
      timestamp: new Date().toISOString(),
      source: input.source,
      trigger: input.trigger ?? "on-demand",
      level: input.health.level,
      message: error instanceof Error ? error.message : "Unknown coupon alert error",
    });
    return { dispatched: false, reason: "dispatch_failed" };
  }
}

export function resetCouponHealthAlertStateForTests() {
  const state = getState();
  state.lastLevel = null;
  state.lastSentAtMs = null;
}
