import type { CouponEntity, CouponRuleEntity } from "./coupon.types";

type CouponWithRules = Pick<CouponEntity, "scope" | "minimumAmount"> & {
  rules?: CouponRuleEntity[];
};

const CATEGORY_LABELS: Record<"CAKE" | "DECORATION" | "GIFT", string> = {
  CAKE: "cake",
  DECORATION: "decoration",
  GIFT: "gift",
};

function toStringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((entry) => String(entry ?? "").trim())
      .filter(Boolean);
  }

  const single = String(value ?? "").trim();
  return single ? [single] : [];
}

function formatJoinedLabels(labels: string[]) {
  if (labels.length === 0) return "";
  if (labels.length === 1) return labels[0];
  if (labels.length === 2) return `${labels[0]} and ${labels[1]}`;
  return `${labels.slice(0, -1).join(", ")}, and ${labels[labels.length - 1]}`;
}

function buildRuleSpecificMessage(rule: CouponRuleEntity) {
  if (rule.type === "DECORATION_REQUIRED") {
    return rule.value
      ? "This coupon is available only when decoration is selected for the booking."
      : "This coupon is available only when decoration is not selected for the booking.";
  }

  if (rule.type === "SLOT_ID" && (rule.operator === "IN" || rule.operator === "EQUALS")) {
    return "This coupon is not valid for the selected slot.";
  }

  if (rule.type === "THEATRE_ID" && (rule.operator === "IN" || rule.operator === "EQUALS")) {
    return "This coupon is not valid for the selected theatre.";
  }

  if (rule.type === "SLOT_DATE_RANGE") {
    return "This coupon is not valid for the selected date.";
  }

  if (rule.type === "SLOT_TIME_RANGE") {
    return "This coupon is not valid for the selected time.";
  }

  if (rule.type === "SLOT_DURATION_MIN") {
    return "This coupon is not valid for the selected slot duration.";
  }

  if (rule.type === "CATEGORY" && rule.operator === "IN") {
    const categoryLabels = toStringList(rule.value)
      .map((value) => CATEGORY_LABELS[value as keyof typeof CATEGORY_LABELS])
      .filter(Boolean);
    const formatted = formatJoinedLabels(categoryLabels);
    if (formatted) {
      return `This coupon is available only when your cart includes ${formatted}.`;
    }
  }

  if (rule.type === "PRODUCT_ID" && rule.operator === "IN") {
    return "This coupon is available only when selected products are in your cart.";
  }

  if (rule.type === "USER_ID") {
    return "This coupon is not valid for this customer.";
  }

  return null;
}

export function buildRuleNotSatisfiedMessage(
  coupon?: CouponWithRules,
  failure?: {
    failedRule?: CouponRuleEntity;
    failedLocation?: boolean;
  }
) {
  if (failure?.failedLocation) {
    return "This coupon is not valid for the selected location.";
  }

  if (failure?.failedRule) {
    return (
      buildRuleSpecificMessage(failure.failedRule) ??
      "This coupon is not valid for the selected booking details."
    );
  }

  for (const rule of coupon?.rules ?? []) {
    const message = buildRuleSpecificMessage(rule);
    if (message) return message;
  }

  return "This coupon is not valid for the selected booking details.";
}
