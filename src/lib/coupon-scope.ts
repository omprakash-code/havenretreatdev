// Persisted DB value for slot-only discounts. We keep this for backward
// compatibility, but business/UI language should prefer "PACKAGE_ONLY".
export const PACKAGE_ONLY_DB_SCOPE = "EXTRAS_ONLY" as const;

export type CouponScopeDb =
  | "BOOKING_TOTAL"
  | "PRODUCTS_ONLY"
  | typeof PACKAGE_ONLY_DB_SCOPE;
export type CouponScopeUi = "BOOKING_TOTAL" | "PRODUCTS_ONLY" | "PACKAGE_ONLY";

export function isSlotOnlyCouponScope(
  scope: CouponScopeDb | CouponScopeUi | null | undefined
): boolean {
  return scope === PACKAGE_ONLY_DB_SCOPE || scope === "PACKAGE_ONLY";
}

export function toUiCouponScope(scope: CouponScopeDb | CouponScopeUi | null | undefined): CouponScopeUi {
  if (scope === "PRODUCTS_ONLY") return "PRODUCTS_ONLY";
  if (isSlotOnlyCouponScope(scope)) return "PACKAGE_ONLY";
  return "BOOKING_TOTAL";
}

export function toDbCouponScope(scope: string | null | undefined): CouponScopeDb | null {
  if (scope === "BOOKING_TOTAL") return "BOOKING_TOTAL";
  if (scope === "PRODUCTS_ONLY") return "PRODUCTS_ONLY";
  if (isSlotOnlyCouponScope(scope as CouponScopeDb | CouponScopeUi | null | undefined)) {
    return PACKAGE_ONLY_DB_SCOPE;
  }
  return null;
}
