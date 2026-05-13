import type { AdminCouponFormState } from "../../types";
import type { CouponRuleOptions } from "../options.types";

export function getStackableCouponUiState(params: {
  coupons: CouponRuleOptions["coupons"];
  currentCouponId?: string;
  formId?: string;
  selectedStackableCouponIds: string[];
}) {
  const selfCouponId = params.currentCouponId ?? params.formId;
  const stackableCouponOptions = params.coupons
    .filter((coupon) => coupon.id !== selfCouponId)
    .map((coupon) => ({
      value: coupon.id,
      label: coupon.isActive ? coupon.code : `${coupon.code} (Inactive)`,
    }));

  return {
    stackableCouponOptions,
    canLimitStackableCoupons:
      stackableCouponOptions.length > 0 || params.selectedStackableCouponIds.length > 0,
  };
}

export function shouldLoadTargetProductsOptions(params: {
  applyDiscountOn:
    | "BOOKING_TOTAL"
    | "SLOT_ONLY"
    | "ALL_PRODUCTS"
    | "TARGET_CATEGORY"
    | "TARGET_PRODUCT_ID";
  productsCount: number;
}) {
  return params.applyDiscountOn === "TARGET_PRODUCT_ID" && params.productsCount === 0;
}

export function shouldLoadStackableCouponsOptions(params: {
  isStackable: boolean;
  couponsCount: number;
}) {
  return params.isStackable && params.couponsCount === 0;
}

export function shouldEnableLimitStackableCoupons(params: Pick<
  AdminCouponFormState,
  "isStackable" | "stackableCouponIds"
> & { canLimitStackableCoupons: boolean }) {
  if (!params.isStackable) return false;
  if (!params.canLimitStackableCoupons) return false;
  return params.stackableCouponIds.length > 0;
}
