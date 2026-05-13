const HOME_COUPON_STRIP_HIDDEN_UNTIL_KEY = "home_coupon_strip_hidden_until";

export const HOME_COUPON_STRIP_DISMISS_HOURS = 2;

function getNowMs() {
  return Date.now();
}

export function readCouponStripHiddenUntilMs(): number | null {
  if (typeof window === "undefined") return null;

  const rawValue = window.localStorage.getItem(HOME_COUPON_STRIP_HIDDEN_UNTIL_KEY);
  if (!rawValue) return null;

  const parsed = Number(rawValue);
  return Number.isFinite(parsed) ? parsed : null;
}

export function isCouponStripDismissed(nowMs = getNowMs()): boolean {
  const hiddenUntilMs = readCouponStripHiddenUntilMs();
  return hiddenUntilMs != null && hiddenUntilMs > nowMs;
}

export function dismissCouponStripForHours(hours: number, nowMs = getNowMs()) {
  if (typeof window === "undefined") return;
  const safeHours = Number.isFinite(hours) && hours > 0 ? hours : 0;
  const hiddenUntilMs = nowMs + safeHours * 60 * 60 * 1000;
  window.localStorage.setItem(HOME_COUPON_STRIP_HIDDEN_UNTIL_KEY, String(hiddenUntilMs));
}

export function clearCouponStripDismissal() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(HOME_COUPON_STRIP_HIDDEN_UNTIL_KEY);
}
