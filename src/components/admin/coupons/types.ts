import type { CouponScopeUi } from "@/lib/coupon-scope";

export type AdminCouponFormState = {
  id?: string;
  code: string;
  discountType: "FLAT" | "PERCENTAGE";
  discountValue: number;
  maxDiscount?: number | null;
  scope: CouponScopeUi;
  validFrom: string;
  validTill: string | null;
  isStackable: boolean;
  stackableCouponIds: string[];
  usageLimit?: number | null;
  perUserUsageLimit?: number | null;
  minimumAmount?: number | null;
  locationId?: string | null;
  isActive: boolean;
  rules: CouponRuleFormState[];
};


export type CouponRuleType =
  | "SLOT_DATE_RANGE"
  | "SLOT_TIME_RANGE"
  | "SLOT_DURATION_MIN"
  | "SLOT_ID"
  | "THEATRE_ID"
  | "CATEGORY"
  | "PRODUCT_ID"
  | "USER_ID"
  | "TARGET_CATEGORY"
  | "TARGET_PRODUCT_ID"
  | "DECORATION_REQUIRED";

export type CouponRuleOperator = "IN" | "NOT_IN" | "BETWEEN" | "EQUALS";

export type CouponRuleFormState = {
  id?: string; // exists when editing
  type: CouponRuleType;

  operator: CouponRuleOperator;

  /**
   * Always stored as JSON-compatible value
   * UI decides how to render input
   */
  value:
    | boolean
    | string
    | string[]
    | { from: string; to: string }
    | { start: string; end: string };
};

export type CouponDrawerProps = {
  open: boolean;
  mode: "create" | "edit";
  initialTab?: "basics" | "rules" | "preview";

  couponId?: string; // required for edit

  onClose: () => void;
  onSaved: () => void; // refresh list
};

export type CouponPreviewState = {
  valid: boolean;
  reason?: string;

  bookingTotal: number;
  discountAmount?: number;
  finalPayable?: number;

  scope: CouponScopeUi;
};
