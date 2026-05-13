import type {
  AdminCouponFormState,
  CouponRuleFormState,
  CouponRuleType,
} from "../types";
import { isValidPhone, normalizePhone } from "@/lib/phone";
import { RULE_TYPES, type RuleMeta, type RuleValueKind, type TabKey } from "./constants";

const LEGACY_EQUALS_MULTI_RULE_TYPES = new Set<CouponRuleType>([
  "SLOT_ID",
  "THEATRE_ID",
  "CATEGORY",
  "PRODUCT_ID",
  "USER_ID",
]);
const PHONE_LIKE_PATTERN = /^\+?[\d\s()-]+$/;
const LEGACY_USER_ID_PATTERN =
  /^(c[a-z0-9]{8,}|[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i;

function normalizeUserRuleEntry(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (PHONE_LIKE_PATTERN.test(trimmed)) {
    const normalizedPhone = normalizePhone(trimmed);
    if (isValidPhone(normalizedPhone)) return normalizedPhone;
  }
  return trimmed;
}

function isAllowedUserRuleEntry(value: string) {
  if (PHONE_LIKE_PATTERN.test(value)) {
    const normalizedPhone = normalizePhone(value);
    if (isValidPhone(normalizedPhone)) return true;
  }
  return LEGACY_USER_ID_PATTERN.test(value.trim());
}

export function toDateTimeLocalInput(input: Date | string) {
  const date = typeof input === "string" ? new Date(input) : input;
  const offsetMinutes = date.getTimezoneOffset();
  return new Date(date.getTime() - offsetMinutes * 60 * 1000)
    .toISOString()
    .slice(0, 16);
}

export function getRuleMeta(type: CouponRuleType): RuleMeta {
  return RULE_TYPES.find((item) => item.value === type) ?? RULE_TYPES[0];
}

export function getDefaultRuleValue(kind: RuleValueKind): CouponRuleFormState["value"] {
  if (kind === "boolean") return true;
  if (kind === "single") return "";
  if (kind === "multi") return [];
  if (kind === "dateRange") return { from: "", to: "" };
  return { start: "", end: "" };
}

export function normalizeRuleForApi(rule: CouponRuleFormState): CouponRuleFormState {
  const meta = getRuleMeta(rule.type);

  if (meta.valueKind === "single") {
    return { ...rule, value: String(rule.value ?? "").trim() };
  }

  if (meta.valueKind === "boolean") {
    if (typeof rule.value === "boolean") {
      return rule;
    }
    const normalized = String(rule.value ?? "").trim().toLowerCase();
    return {
      ...rule,
      value: normalized === "false" || normalized === "no" ? false : true,
    };
  }

  if (meta.valueKind === "multi") {
    if (LEGACY_EQUALS_MULTI_RULE_TYPES.has(rule.type) && rule.operator === "EQUALS") {
      const single = String(rule.value ?? "").trim();
      return { ...rule, operator: "IN", value: single ? [single] : [] };
    }

    const valuesRaw = Array.isArray(rule.value)
      ? rule.value
      : String(rule.value ?? "")
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean);
    const values =
      rule.type === "USER_ID"
        ? valuesRaw.map((item) => normalizeUserRuleEntry(String(item))).filter(Boolean)
        : valuesRaw;

    if (rule.operator === "EQUALS") {
      return { ...rule, value: values[0] ?? "" };
    }

    return { ...rule, value: values };
  }

  if (meta.valueKind === "dateRange") {
    const value = rule.value as { from?: string; to?: string };
    return {
      ...rule,
      value: { from: value.from ?? "", to: value.to ?? "" },
    };
  }

  const value = rule.value as { start?: string; end?: string };
  return {
    ...rule,
    value: { start: value.start ?? "", end: value.end ?? "" },
  };
}

export function normalizeRuleFromApi(rule: CouponRuleFormState): CouponRuleFormState {
  const meta = getRuleMeta(rule.type);

  if (meta.valueKind === "multi") {
    if (LEGACY_EQUALS_MULTI_RULE_TYPES.has(rule.type) && rule.operator === "EQUALS") {
      const single = String(rule.value ?? "").trim();
      return {
        ...rule,
        operator: "IN",
        value: single ? [single] : [],
      };
    }

    if (rule.operator === "EQUALS" && typeof rule.value === "string") {
      return rule;
    }
    if (Array.isArray(rule.value)) {
      return { ...rule, value: rule.value.map(String) };
    }
    return {
      ...rule,
      value: String(rule.value ?? "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    };
  }

  if (meta.valueKind === "single") {
    return { ...rule, value: String(rule.value ?? "") };
  }

  if (meta.valueKind === "boolean") {
    if (typeof rule.value === "boolean") return rule;
    const normalized = String(rule.value ?? "").trim().toLowerCase();
    return {
      ...rule,
      value: normalized === "false" || normalized === "no" ? false : true,
    };
  }

  if (meta.valueKind === "dateRange") {
    const value = rule.value as { from?: string; to?: string };
    return { ...rule, value: { from: value.from ?? "", to: value.to ?? "" } };
  }

  const value = rule.value as { start?: string; end?: string };
  return { ...rule, value: { start: value.start ?? "", end: value.end ?? "" } };
}

export function serializeForm(form: AdminCouponFormState): AdminCouponFormState {
  return {
    ...form,
    code: form.code.trim().toUpperCase(),
    validFrom: new Date(form.validFrom).toISOString(),
    validTill: form.validTill ? new Date(form.validTill).toISOString() : null,
    maxDiscount: form.discountType === "PERCENTAGE" ? form.maxDiscount ?? null : null,
    stackableCouponIds: form.isStackable
      ? Array.from(
          new Set(
            (form.stackableCouponIds ?? [])
              .map((value) => String(value ?? "").trim())
              .filter(Boolean)
          )
        )
      : [],
    usageLimit: form.usageLimit ?? null,
    perUserUsageLimit: form.perUserUsageLimit ?? null,
    minimumAmount: form.minimumAmount ?? null,
    locationId: form.locationId?.trim() ? form.locationId.trim() : null,
    rules: form.rules.map((rule) => normalizeRuleForApi(rule)),
  };
}

export function validateForm(
  form: AdminCouponFormState
): { message: string; tab: TabKey } | null {
  if (!form.code.trim()) return { message: "Coupon code is required.", tab: "basics" };
  if (!form.validFrom) {
    return { message: "Start date is required.", tab: "basics" };
  }

  const from = new Date(form.validFrom).getTime();
  if (Number.isNaN(from)) {
    return { message: "Start date is invalid.", tab: "basics" };
  }
  if (form.validTill) {
    const till = new Date(form.validTill).getTime();
    if (Number.isNaN(till)) {
      return { message: "End date is invalid.", tab: "basics" };
    }
    if (from >= till) {
      return { message: "End date must be after start date.", tab: "basics" };
    }
  }

  if (form.discountValue <= 0) {
    return { message: "Discount value is required.", tab: "basics" };
  }
  if (form.discountType === "PERCENTAGE" && form.discountValue > 100) {
    return { message: "Percentage discount cannot exceed 100.", tab: "basics" };
  }
  if (form.discountType === "PERCENTAGE" && form.maxDiscount != null && form.maxDiscount <= 0) {
    return { message: "Max discount cap must be greater than zero.", tab: "basics" };
  }

  for (const [index, rule] of form.rules.entries()) {
    const meta = getRuleMeta(rule.type);
    if (!meta.operators.includes(rule.operator)) {
      return {
        message: `Rule ${index + 1}: invalid operator for selected rule type.`,
        tab: "rules",
      };
    }

    if (meta.valueKind === "single") {
      if (typeof rule.value !== "string" || !rule.value.trim()) {
        return { message: `Rule ${index + 1}: value is required.`, tab: "rules" };
      }
    }

    if (meta.valueKind === "boolean") {
      if (typeof rule.value !== "boolean") {
        return { message: `Rule ${index + 1}: choose Yes or No.`, tab: "rules" };
      }
    }

    if (meta.valueKind === "multi") {
      if (rule.operator === "EQUALS") {
        if (typeof rule.value !== "string" || !rule.value.trim()) {
          return { message: `Rule ${index + 1}: value is required.`, tab: "rules" };
        }
      } else if (!Array.isArray(rule.value) || rule.value.length === 0) {
        return { message: `Rule ${index + 1}: at least one value is required.`, tab: "rules" };
      }

      if (rule.type === "USER_ID") {
        const values =
          rule.operator === "EQUALS"
            ? [String(rule.value ?? "").trim()].filter(Boolean)
            : Array.isArray(rule.value)
            ? rule.value.map((value) => String(value ?? "").trim()).filter(Boolean)
            : [];

        if (values.some((value) => !isAllowedUserRuleEntry(value))) {
          return {
            message: `Restriction ${index + 1}: enter valid 10-digit mobile number(s).`,
            tab: "rules",
          };
        }
      }
    }

    if (meta.valueKind === "dateRange") {
      const value = rule.value as { from?: string; to?: string };
      if (!value.from || !value.to) {
        return { message: `Rule ${index + 1}: date range is required.`, tab: "rules" };
      }
      const fromDate = new Date(value.from).getTime();
      const toDate = new Date(value.to).getTime();
      if (Number.isNaN(fromDate) || Number.isNaN(toDate)) {
        return { message: `Rule ${index + 1}: date range is invalid.`, tab: "rules" };
      }
      if (toDate < fromDate) {
        return {
          message: `Rule ${index + 1}: To Date cannot be before From Date.`,
          tab: "rules",
        };
      }
    }

    if (meta.valueKind === "timeRange") {
      const value = rule.value as { start?: string; end?: string };
      if (!value.start || !value.end) {
        return { message: `Rule ${index + 1}: time range is required.`, tab: "rules" };
      }
    }
  }

  return null;
}
