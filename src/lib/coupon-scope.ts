// Persisted DB value for slot-only discounts. We keep this for backward
// compatibility, but business/UI language should prefer "SLOT_ONLY".
export const SLOT_ONLY_DB_SCOPE = "EXTRAS_ONLY" as const;

export type CouponScopeDb =
  | "BOOKING_TOTAL"
  | "PRODUCTS_ONLY"
  | typeof SLOT_ONLY_DB_SCOPE;
export type CouponScopeUi = "BOOKING_TOTAL" | "PRODUCTS_ONLY" | "SLOT_ONLY";

export function isSlotOnlyCouponScope(
  scope: CouponScopeDb | CouponScopeUi | null | undefined
): boolean {
  return scope === SLOT_ONLY_DB_SCOPE || scope === "SLOT_ONLY";
}

export function toUiCouponScope(scope: CouponScopeDb | CouponScopeUi | null | undefined): CouponScopeUi {
  if (scope === "PRODUCTS_ONLY") return "PRODUCTS_ONLY";
  if (isSlotOnlyCouponScope(scope)) return "SLOT_ONLY";
  return "BOOKING_TOTAL";
}

export function toDbCouponScope(scope: string | null | undefined): CouponScopeDb | null {
  if (scope === "BOOKING_TOTAL") return "BOOKING_TOTAL";
  if (scope === "PRODUCTS_ONLY") return "PRODUCTS_ONLY";
  if (isSlotOnlyCouponScope(scope as CouponScopeDb | CouponScopeUi | null | undefined)) {
    return SLOT_ONLY_DB_SCOPE;
  }
  return null;
}
