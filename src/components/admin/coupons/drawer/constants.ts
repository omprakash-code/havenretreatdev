import type {
  AdminCouponFormState,
  CouponRuleOperator,
  CouponRuleType,
} from "../types";

export type TabKey = "basics" | "rules" | "preview";
export type RuleValueKind = "single" | "multi" | "boolean" | "dateRange" | "timeRange";

export type RuleMeta = {
  value: CouponRuleType;
  label: string;
  hint: string;
  valueKind: RuleValueKind;
  operators: CouponRuleOperator[];
};

export const RULE_TYPES: RuleMeta[] = [
  {
    value: "SLOT_DATE_RANGE",
    label: "Slot Date Range",
    hint: "Coupon applies only between selected slot dates",
    valueKind: "dateRange",
    operators: ["BETWEEN"],
  },
  {
    value: "SLOT_TIME_RANGE",
    label: "Slot Time Range",
    hint: "Coupon applies only between selected slot times",
    valueKind: "timeRange",
    operators: ["BETWEEN"],
  },
  {
    value: "SLOT_DURATION_MIN",
    label: "Slot Duration",
    hint: "Restrict to selected slot durations",
    valueKind: "multi",
    operators: ["IN", "NOT_IN"],
  },
  {
    value: "SLOT_ID",
    label: "Slot",
    hint: "Restrict to specific slots",
    valueKind: "multi",
    operators: ["IN", "NOT_IN"],
  },
  {
    value: "THEATRE_ID",
    label: "Theatre",
    hint: "Restrict to selected theatres",
    valueKind: "multi",
    operators: ["IN", "NOT_IN"],
  },
  {
    value: "CATEGORY",
    label: "Cart Category",
    hint: "Coupon works only when the cart matches the selected categories",
    valueKind: "multi",
    operators: ["IN", "NOT_IN"],
  },
  {
    value: "PRODUCT_ID",
    label: "Cart Products",
    hint: "Coupon works only when the cart matches the selected products",
    valueKind: "multi",
    operators: ["IN", "NOT_IN"],
  },
  {
    value: "TARGET_CATEGORY",
    label: "Product Category",
    hint: "Apply discount only on the selected product categories",
    valueKind: "multi",
    operators: ["IN"],
  },
  {
    value: "TARGET_PRODUCT_ID",
    label: "Product",
    hint: "Apply discount only on the selected products",
    valueKind: "multi",
    operators: ["IN"],
  },
  // This rule lets admins tie coupon eligibility to the booking's decoration
  // choice from the contact step. Keep it in the standard restriction list so
  // offers like "WELCOME400 only when Decoration = Yes" can be configured
  // without custom backend work.
  {
    value: "DECORATION_REQUIRED",
    label: "Decoration Required",
    hint: "Coupon applies only when customer decoration preference matches",
    valueKind: "boolean",
    operators: ["EQUALS"],
  },
  {
    value: "USER_ID",
    label: "User Mobile",
    hint: "Restrict to selected mobile numbers",
    valueKind: "multi",
    operators: ["IN", "NOT_IN"],
  },
];

const DEFAULT_VALIDITY_DAYS = 7;

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function endOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(23, 59, 0, 0);
  return next;
}

function toDateTimeLocalInput(input: Date | string) {
  const date = typeof input === "string" ? new Date(input) : input;
  const offsetMinutes = date.getTimezoneOffset();
  return new Date(date.getTime() - offsetMinutes * 60 * 1000)
    .toISOString()
    .slice(0, 16);
}

export function getDefaultCouponValidTill(validFromInput?: Date | string) {
  const baseDate = validFromInput ? new Date(validFromInput) : new Date();
  const fallbackDate = Number.isNaN(baseDate.getTime()) ? new Date() : baseDate;
  return toDateTimeLocalInput(
    endOfDay(
      new Date(
        fallbackDate.getTime() + DEFAULT_VALIDITY_DAYS * 24 * 60 * 60 * 1000
      )
    )
  );
}

export function createEmptyCouponForm(): AdminCouponFormState {
  const now = new Date();
  return {
    code: "",
    discountType: "FLAT",
    discountValue: 0,
    maxDiscount: null,
    scope: "BOOKING_TOTAL",
    validFrom: toDateTimeLocalInput(startOfDay(now)),
    validTill: null,
    isStackable: false,
    stackableCouponIds: [],
    usageLimit: null,
    perUserUsageLimit: null,
    minimumAmount: null,
    locationId: null,
    isActive: true,
    rules: [],
  };
}
