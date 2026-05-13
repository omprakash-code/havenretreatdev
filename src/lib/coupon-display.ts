const ARCHIVED_COUPON_MARKER = "__DELETED__";

export function getCouponDisplayCode(code: string | null | undefined) {
  const normalized = String(code ?? "").trim();
  if (!normalized) return "";
  const markerIndex = normalized.indexOf(ARCHIVED_COUPON_MARKER);
  if (markerIndex === -1) return normalized;
  return normalized.slice(0, markerIndex).trim();
}

export function isArchivedDeletedCouponCode(code: string | null | undefined) {
  return String(code ?? "").includes(ARCHIVED_COUPON_MARKER);
}
