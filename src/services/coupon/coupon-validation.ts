import { CouponDiscountType, CouponRuleType, CouponScope, RuleOperator } from "@prisma/client";
import { toDbCouponScope } from "@/lib/coupon-scope";
import { isValidPhone, normalizePhone } from "@/lib/phone";

export class CouponValidationError extends Error {
  constructor(message: string) {
    super(message);
  }
}

type CouponRuleInput = {
  id?: string;
  type: CouponRuleType;
  operator: RuleOperator;
  value: unknown;
};

type CouponPayloadInput = {
  code: unknown;
  discountType: unknown;
  discountValue: unknown;
  maxDiscount?: unknown;
  scope?: unknown;
  validFrom: unknown;
  validTill?: unknown;
  isStackable?: unknown;
  stackableCouponIds?: unknown;
  usageLimit?: unknown;
  perUserUsageLimit?: unknown;
  minimumAmount?: unknown;
  locationId?: unknown;
  isActive?: unknown;
  rules?: unknown;
};

type NormalizedCouponRule = {
  id?: string;
  type: CouponRuleType;
  operator: RuleOperator;
  value:
    | boolean
    | string
    | string[]
    | { from: string; to: string }
    | { start: string; end: string };
};

export type NormalizedCouponPayload = {
  code: string;
  discountType: CouponDiscountType;
  discountValue: number;
  maxDiscount: number | null;
  scope: CouponScope;
  validFrom: Date;
  validTill: Date | null;
  isStackable: boolean;
  stackableCouponIds: string[];
  usageLimit: number | null;
  perUserUsageLimit: number | null;
  minimumAmount: number | null;
  locationId: string | null;
  isActive: boolean;
  rules: NormalizedCouponRule[];
};

const CATEGORY_VALUES = ["CAKE", "DECORATION", "GIFT"] as const;
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;
const CODE_PATTERN = /^[A-Z0-9][A-Z0-9_-]{1,31}$/;
const PHONE_LIKE_PATTERN = /^\+?[\d\s()-]+$/;
const LEGACY_USER_ID_PATTERN =
  /^(c[a-z0-9]{8,}|[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i;

function ensureObject(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new CouponValidationError("Invalid coupon payload.");
  }
  return input as Record<string, unknown>;
}

function asPositiveIntOrNull(input: unknown, fieldLabel: string): number | null {
  if (input == null || input === "") return null;
  const parsed = Number(input);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new CouponValidationError(`${fieldLabel} must be a positive integer.`);
  }
  return parsed;
}

function normalizeStringList(input: unknown, fieldLabel: string): string[] {
  if (typeof input === "string") {
    const one = input.trim();
    return one ? [one] : [];
  }

  if (!Array.isArray(input)) {
    throw new CouponValidationError(`${fieldLabel} must be a string or array.`);
  }

  return input
    .map((value) => String(value ?? "").trim())
    .filter((value) => value.length > 0);
}

function normalizeUserIdentityValue(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new CouponValidationError("User condition requires a value.");
  }

  if (PHONE_LIKE_PATTERN.test(trimmed)) {
    const normalizedPhone = normalizePhone(trimmed);
    if (isValidPhone(normalizedPhone)) {
      return normalizedPhone;
    }
  }

  // Backward compatibility for older USER_ID coupons.
  if (LEGACY_USER_ID_PATTERN.test(trimmed)) {
    return trimmed;
  }

  throw new CouponValidationError(
    "User condition accepts valid 10-digit mobile numbers."
  );
}

function ensureValidDateIso(input: unknown, fieldLabel: string): Date {
  const value = String(input ?? "").trim();
  if (!value) {
    throw new CouponValidationError(`${fieldLabel} is required.`);
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new CouponValidationError(`${fieldLabel} is invalid.`);
  }

  return parsed;
}

function normalizeRuleValue(rule: CouponRuleInput) {
  switch (rule.type) {
    case "SLOT_DATE_RANGE": {
      const value = ensureObject(rule.value);
      const from = String(value.from ?? "").trim();
      const to = String(value.to ?? "").trim();
      if (!from || !to) {
        throw new CouponValidationError("SLOT_DATE_RANGE rule requires from/to dates.");
      }
      const fromDate = new Date(from);
      const toDate = new Date(to);
      if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
        throw new CouponValidationError("SLOT_DATE_RANGE rule has invalid date values.");
      }
      if (fromDate.getTime() > toDate.getTime()) {
        throw new CouponValidationError("SLOT_DATE_RANGE from date cannot be after to date.");
      }
      return {
        from,
        to,
      };
    }

    case "SLOT_TIME_RANGE": {
      const value = ensureObject(rule.value);
      const start = String(value.start ?? "").trim();
      const end = String(value.end ?? "").trim();

      if (!TIME_PATTERN.test(start) || !TIME_PATTERN.test(end)) {
        throw new CouponValidationError("SLOT_TIME_RANGE rule requires valid HH:mm start/end.");
      }

      return {
        start,
        end,
      };
    }

    case "SLOT_DURATION_MIN": {
      if (rule.operator === "EQUALS") {
        const single = String(rule.value ?? "").trim();
        const parsed = Number(single);
        if (!Number.isInteger(parsed) || parsed < 1) {
          throw new CouponValidationError(
            "SLOT_DURATION_MIN rule requires a valid duration in minutes."
          );
        }
        return String(parsed);
      }

      const list = normalizeStringList(rule.value, "SLOT_DURATION_MIN rule value");
      if (list.length === 0) {
        throw new CouponValidationError(
          "SLOT_DURATION_MIN rule requires at least one duration."
        );
      }

      const normalizedDurations = list.map((value) => {
        const parsed = Number(value);
        if (!Number.isInteger(parsed) || parsed < 1) {
          throw new CouponValidationError(
            "SLOT_DURATION_MIN values must be positive whole minutes."
          );
        }
        return String(parsed);
      });

      if (rule.operator === "BETWEEN") {
        if (normalizedDurations.length < 2) {
          throw new CouponValidationError("SLOT_DURATION_MIN BETWEEN requires two values.");
        }
        return [normalizedDurations[0] as string, normalizedDurations[1] as string];
      }

      return normalizedDurations;
    }

    case "CATEGORY": {
      if (rule.operator === "EQUALS") {
        const single = String(rule.value ?? "").trim();
        if (!single || !CATEGORY_VALUES.includes(single as (typeof CATEGORY_VALUES)[number])) {
          throw new CouponValidationError("CATEGORY EQUALS value must be one of CAKE/DECORATION/GIFT.");
        }
        return single;
      }

      const list = normalizeStringList(rule.value, "CATEGORY rule value");
      if (list.length === 0) {
        throw new CouponValidationError("CATEGORY rule requires at least one value.");
      }

      if (!list.every((value) => CATEGORY_VALUES.includes(value as (typeof CATEGORY_VALUES)[number]))) {
        throw new CouponValidationError("CATEGORY rule values must be CAKE/DECORATION/GIFT.");
      }

      if (rule.operator === "BETWEEN") {
        if (list.length < 2) {
          throw new CouponValidationError("CATEGORY BETWEEN requires two values.");
        }
        return [list[0] as string, list[1] as string];
      }

      return list;
    }

    case "USER_ID": {
      if (rule.operator === "EQUALS") {
        const singleRaw = String(rule.value ?? "").trim();
        if (!singleRaw) {
          throw new CouponValidationError(`${rule.type} EQUALS value is required.`);
        }
        return normalizeUserIdentityValue(singleRaw);
      }

      const list = normalizeStringList(rule.value, `${rule.type} rule value`);
      if (list.length === 0) {
        throw new CouponValidationError(`${rule.type} rule requires at least one value.`);
      }
      const normalizedList = list.map(normalizeUserIdentityValue);

      if (rule.operator === "BETWEEN") {
        if (normalizedList.length < 2) {
          throw new CouponValidationError(`${rule.type} BETWEEN requires two values.`);
        }
        return [normalizedList[0] as string, normalizedList[1] as string];
      }

      return normalizedList;
    }

    case "DECORATION_REQUIRED": {
      if (rule.operator !== "EQUALS") {
        throw new CouponValidationError("DECORATION_REQUIRED supports EQUALS only.");
      }

      if (typeof rule.value === "boolean") {
        return rule.value;
      }

      const raw = String(rule.value ?? "").trim().toLowerCase();
      if (raw === "true" || raw === "yes") return true;
      if (raw === "false" || raw === "no") return false;
      throw new CouponValidationError(
        "DECORATION_REQUIRED value must be Yes or No."
      );
    }

    case "SLOT_ID":
    case "THEATRE_ID":
    case "PRODUCT_ID": {
      if (rule.operator === "EQUALS") {
        const single = String(rule.value ?? "").trim();
        if (!single) {
          throw new CouponValidationError(`${rule.type} EQUALS value is required.`);
        }
        return single;
      }

      const list = normalizeStringList(rule.value, `${rule.type} rule value`);
      if (list.length === 0) {
        throw new CouponValidationError(`${rule.type} rule requires at least one value.`);
      }

      if (rule.operator === "BETWEEN") {
        if (list.length < 2) {
          throw new CouponValidationError(`${rule.type} BETWEEN requires two values.`);
        }
        return [list[0] as string, list[1] as string];
      }

      return list;
    }

    case "TARGET_CATEGORY": {
      if (rule.operator !== "IN") {
        throw new CouponValidationError("TARGET_CATEGORY supports Include selected only.");
      }

      const list = normalizeStringList(rule.value, "TARGET_CATEGORY rule value");
      if (list.length === 0) {
        throw new CouponValidationError("TARGET_CATEGORY requires at least one value.");
      }
      if (!list.every((value) => CATEGORY_VALUES.includes(value as (typeof CATEGORY_VALUES)[number]))) {
        throw new CouponValidationError("TARGET_CATEGORY values must be CAKE/DECORATION/GIFT.");
      }

      return list;
    }

    case "TARGET_PRODUCT_ID": {
      if (rule.operator !== "IN") {
        throw new CouponValidationError("TARGET_PRODUCT_ID supports Include selected only.");
      }

      const list = normalizeStringList(rule.value, "TARGET_PRODUCT_ID rule value");
      if (list.length === 0) {
        throw new CouponValidationError("TARGET_PRODUCT_ID requires at least one value.");
      }

      return list;
    }

    default:
      throw new CouponValidationError(`Unsupported rule type: ${rule.type}`);
  }
}

function normalizeRules(input: unknown): NormalizedCouponRule[] {
  if (input == null) return [];
  if (!Array.isArray(input)) {
    throw new CouponValidationError("Rules must be an array.");
  }

  return input.map((entry, index) => {
    const row = ensureObject(entry);

    const type = row.type;
    const operator = row.operator;

    if (!Object.values(CouponRuleType).includes(type as CouponRuleType)) {
      throw new CouponValidationError(`Rule ${index + 1}: invalid rule type.`);
    }

    if (!Object.values(RuleOperator).includes(operator as RuleOperator)) {
      throw new CouponValidationError(`Rule ${index + 1}: invalid operator.`);
    }

    return {
      id: typeof row.id === "string" && row.id.trim() ? row.id : undefined,
      type: type as CouponRuleType,
      operator: operator as RuleOperator,
      value: normalizeRuleValue({
        id: typeof row.id === "string" ? row.id : undefined,
        type: type as CouponRuleType,
        operator: operator as RuleOperator,
        value: row.value,
      }),
    };
  });
}

export function normalizeCouponPayload(input: unknown): NormalizedCouponPayload {
  const payload = ensureObject(input) as CouponPayloadInput;

  const code = String(payload.code ?? "").trim().toUpperCase();
  if (!code) {
    throw new CouponValidationError("Coupon code is required.");
  }
  if (!CODE_PATTERN.test(code)) {
    throw new CouponValidationError(
      "Coupon code must be 2-32 chars and contain only A-Z, 0-9, _ or -."
    );
  }

  const discountType = payload.discountType as CouponDiscountType;
  if (!Object.values(CouponDiscountType).includes(discountType)) {
    throw new CouponValidationError("Invalid discount type.");
  }

  if (payload.discountValue == null || String(payload.discountValue).trim() === "") {
    throw new CouponValidationError("Discount value is required.");
  }

  const discountValue = Number(payload.discountValue);
  if (!Number.isFinite(discountValue)) {
    throw new CouponValidationError("Discount value is required.");
  }
  if (discountValue <= 0) {
    throw new CouponValidationError("Discount value must be greater than zero.");
  }

  if (discountType === "PERCENTAGE" && discountValue > 100) {
    throw new CouponValidationError("Percentage discount cannot exceed 100.");
  }

  let maxDiscount: number | null = null;
  if (discountType === "PERCENTAGE") {
    maxDiscount = asPositiveIntOrNull(payload.maxDiscount, "Max discount");
  }

  const validFrom = ensureValidDateIso(payload.validFrom, "Valid From");
  const validTill =
    payload.validTill == null || String(payload.validTill).trim() === ""
      ? null
      : ensureValidDateIso(payload.validTill, "Valid Till");
  if (validTill && validFrom.getTime() >= validTill.getTime()) {
    throw new CouponValidationError("Valid Till must be after Valid From.");
  }

  const scopeInput = String(payload.scope ?? "BOOKING_TOTAL");
  const mappedScope = toDbCouponScope(scopeInput);
  if (!mappedScope || !Object.values(CouponScope).includes(mappedScope as CouponScope)) {
    throw new CouponValidationError("Invalid coupon scope.");
  }

  const usageLimit = asPositiveIntOrNull(payload.usageLimit, "Usage limit");
  const perUserUsageLimit = asPositiveIntOrNull(
    payload.perUserUsageLimit,
    "Per-user usage limit"
  );
  const isStackable = Boolean(payload.isStackable);
  const stackableCouponIds = isStackable
    ? Array.from(
        new Set(normalizeStringList(payload.stackableCouponIds ?? [], "Stackable coupons"))
      )
    : [];
  const minimumAmount = asPositiveIntOrNull(
    payload.minimumAmount,
    "Minimum amount"
  );

  if (
    usageLimit != null &&
    perUserUsageLimit != null &&
    perUserUsageLimit > usageLimit
  ) {
    throw new CouponValidationError(
      "Per-user usage limit cannot exceed global usage limit."
    );
  }

  const locationRaw = String(payload.locationId ?? "").trim();
  const locationId = locationRaw.length > 0 ? locationRaw : null;

  const rules = normalizeRules(payload.rules);
  const hasTargetRule = rules.some(
    (rule) => rule.type === "TARGET_CATEGORY" || rule.type === "TARGET_PRODUCT_ID"
  );
  if (hasTargetRule && mappedScope !== CouponScope.PRODUCTS_ONLY) {
    throw new CouponValidationError(
      "Target product/category rules can be used only with Products Only scope."
    );
  }

  return {
    code,
    discountType,
    discountValue: Math.trunc(discountValue),
    maxDiscount,
    scope: mappedScope as CouponScope,
    validFrom,
    validTill,
    isStackable,
    stackableCouponIds,
    usageLimit,
    perUserUsageLimit,
    minimumAmount,
    locationId,
    isActive: payload.isActive == null ? true : Boolean(payload.isActive),
    rules,
  };
}
