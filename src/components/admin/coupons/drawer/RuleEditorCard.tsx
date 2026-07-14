import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Calendar, Trash } from "@/components/icons";
import { normalizePhone } from "@/lib/phone";
import type {
  CouponRuleFormState,
  CouponRuleOperator,
  CouponRuleType,
} from "../types";
import { RULE_TYPES, type RuleMeta } from "./constants";
import { getDefaultRuleValue, getRuleMeta } from "./utils";
import { Input, Label, Select } from "./fields";
import type {
  CouponRuleOptionInclude,
  CouponRuleOptions,
} from "./options.types";
import { formatCalendarDate } from "@/lib/formatters";
import SearchableMultiSelect from "./SearchableMultiSelect";

const LOCATION_RESTRICTION_TYPE = "__LOCATION__" as const;

export function RuleEditorCard({
  index,
  displayIndex,
  title,
  rule,
  meta,
  onChange,
  onRemove,
  onSelectLocationType,
  options,
  ensureRuleOptions,
}: {
  index: number;
  displayIndex?: number;
  title?: ReactNode;
  rule: CouponRuleFormState;
  meta: RuleMeta;
  onChange: (rule: CouponRuleFormState) => void;
  onRemove: () => void;
  onSelectLocationType?: () => void;
  options: CouponRuleOptions;
  ensureRuleOptions: (
    include: CouponRuleOptionInclude[]
  ) => Promise<Partial<CouponRuleOptions> | void>;
}) {
  const [dateRangeInteractionError, setDateRangeInteractionError] = useState<string | null>(
    null
  );

  const selectedValues = useMemo(() => {
    if (rule.operator === "EQUALS") {
      return typeof rule.value === "string" && rule.value ? [rule.value] : [];
    }
    return Array.isArray(rule.value) ? rule.value : [];
  }, [rule.operator, rule.value]);
  const setSelectedValues = (values: string[]) => {
    if (rule.operator === "EQUALS") {
      onChange({ ...rule, value: values[0] ?? "" });
      return;
    }
    onChange({ ...rule, value: values });
  };

  const dateValue = rule.value as { from?: string; to?: string };
  const timeValue = rule.value as { start?: string; end?: string };
  const operatorOptions = useMemo(
    () =>
      meta.operators.map((value) => ({
        value,
        label: getOperatorLabel(value),
      })),
    [meta.operators, rule.type]
  );
  const conditionTypeOptions = useMemo(() => {
    // Some supported backend rules are intentionally hidden from new admin
    // selections to keep the coupon UI focused on day-to-day usage. Keep them
    // visible only when editing an existing coupon that already uses them.
    return [
      { value: LOCATION_RESTRICTION_TYPE, label: "Location" },
      ...RULE_TYPES
        .filter(
          (item) =>
            ![
              "USER_ID",
              "TARGET_CATEGORY",
              "TARGET_PRODUCT_ID",
              "BOOKING_TIME_RANGE",
            ].includes(item.value) ||
            item.value === rule.type
        )
        .map((item) => ({
          value: item.value,
          label: item.label,
        })),
    ];
  }, [rule.type]);
  const fromRuleDate = dateValue.from ? new Date(dateValue.from) : null;
  const toRuleDate = dateValue.to ? new Date(dateValue.to) : null;
  const formattedFromRuleDate =
    !fromRuleDate
      ? "Not set"
      : Number.isNaN(fromRuleDate.getTime())
      ? "Invalid date"
      : formatCalendarDate(fromRuleDate);
  const formattedToRuleDate =
    !toRuleDate
      ? "Not set"
      : Number.isNaN(toRuleDate.getTime())
      ? "Invalid date"
      : formatCalendarDate(toRuleDate);
  useEffect(() => {
    if (!["PRODUCT_ID", "TARGET_PRODUCT_ID"].includes(rule.type) || options.products.length > 0) {
      return;
    }
    void ensureRuleOptions(["products"]);
  }, [ensureRuleOptions, options.products.length, rule.type]);

  useEffect(() => {
    if (rule.type !== "BOOKING_DURATION_MIN" || options.slotDurations.length > 0) {
      return;
    }
    void ensureRuleOptions(["slotDurations"]);
  }, [ensureRuleOptions, options.slotDurations.length, rule.type]);

  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          {displayIndex ? (
            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full border border-slate-300 bg-white px-1.5 text-[11px] font-semibold text-slate-700">
              {displayIndex}
            </span>
          ) : null}
          <p className="text-sm font-semibold text-slate-900">
            {title || `Restriction ${index + 1}`}
          </p>
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="inline-flex min-h-8 shrink-0 cursor-pointer items-center gap-1 rounded-md border border-red-200 px-2.5 py-1.5 text-xs text-red-700 hover:bg-red-50 sm:min-h-0 sm:px-2 sm:py-1"
        >
          <Trash size={12} />
          Remove
        </button>
      </div>

      <div
        className={`grid gap-3 ${
          meta.operators.length > 1 ? "sm:grid-cols-2" : "sm:grid-cols-1"
        }`}
      >
        <Select
          label="Restriction Type"
          value={rule.type}
          onChange={(value) => {
            if (value === LOCATION_RESTRICTION_TYPE) {
              onSelectLocationType?.();
              return;
            }
            const nextMeta = getRuleMeta(value as CouponRuleType);
            onChange({
              ...rule,
              type: value as CouponRuleType,
              operator: nextMeta.operators[0],
              value: getDefaultRuleValue(nextMeta.valueKind),
            });
          }}
          options={conditionTypeOptions}
        />

        {meta.operators.length > 1 ? (
          <Select
            label="Condition"
            value={rule.operator}
            onChange={(value) =>
              onChange({ ...rule, operator: value as CouponRuleOperator })
            }
            options={operatorOptions}
          />
        ) : null}
      </div>

      <p className="mt-2 text-xs text-slate-500">{meta.hint}</p>

      <div className="mt-3">
        {meta.valueKind === "dateRange" && (
          <div className="grid gap-3 sm:grid-cols-2">
            <FormattedDateField
              label="From Date"
              value={dateValue.from ?? ""}
              formattedValue={formattedFromRuleDate}
              max={dateValue.to || undefined}
              onChange={(value) => {
                const currentTo = dateValue.to ?? "";
                if (value && currentTo && currentTo < value) {
                  setDateRangeInteractionError(
                    "To Date cannot be before From Date. Please select To Date again."
                  );
                  onChange({
                    ...rule,
                    value: { from: value, to: "" },
                  });
                  return;
                }
                setDateRangeInteractionError(null);
                onChange({
                  ...rule,
                  value: { from: value, to: currentTo },
                });
              }}
            />
            <FormattedDateField
              label="To Date"
              value={dateValue.to ?? ""}
              formattedValue={formattedToRuleDate}
              min={dateValue.from || undefined}
              onChange={(value) => {
                const currentFrom = dateValue.from ?? "";
                if (currentFrom && value && value < currentFrom) {
                  setDateRangeInteractionError(
                    "To Date cannot be before From Date."
                  );
                  return;
                }
                setDateRangeInteractionError(null);
                onChange({
                  ...rule,
                  value: { from: currentFrom, to: value },
                });
              }}
            />
            {dateRangeInteractionError ? (
              <p className="sm:col-span-2 text-xs text-red-600">
                {dateRangeInteractionError}
              </p>
            ) : null}
          </div>
        )}

        {meta.valueKind === "timeRange" && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              label="Start Time"
              value={timeValue.start ?? ""}
              onChange={(value) =>
                onChange({
                  ...rule,
                  value: { start: value, end: timeValue.end ?? "" },
                })
              }
              type="time"
            />
            <Input
              label="End Time"
              value={timeValue.end ?? ""}
              onChange={(value) =>
                onChange({
                  ...rule,
                  value: { start: timeValue.start ?? "", end: value },
                })
              }
              type="time"
            />
          </div>
        )}

        {meta.valueKind === "single" && (
          <Input
            label="Value"
            value={typeof rule.value === "string" ? rule.value : ""}
            onChange={(value) => onChange({ ...rule, value })}
            placeholder="Enter value"
          />
        )}

        {meta.valueKind === "boolean" && (
          <Select
            label="Value"
            value={typeof rule.value === "boolean" ? String(rule.value) : "true"}
            onChange={(value) =>
              onChange({
                ...rule,
                value: value === "false" ? false : true,
              })
            }
            options={[
              { value: "true", label: "Yes" },
              { value: "false", label: "No" },
            ]}
          />
        )}

        {meta.valueKind === "multi" && (
          <div className="space-y-3">
            {(rule.type === "CATEGORY" || rule.type === "TARGET_CATEGORY") && (
              <SearchableMultiSelect
                options={[
                  { value: "CAKE", label: "Cake" },
                  { value: "DECORATION", label: "Decoration" },
                  { value: "GIFT", label: "Gift" },
                ]}
                selected={selectedValues}
                onToggle={(value) => {
                  const has = selectedValues.includes(value);
                  if (rule.operator === "EQUALS") {
                    setSelectedValues(has ? [] : [value]);
                    return;
                  }
                  setSelectedValues(
                    has
                      ? selectedValues.filter((item) => item !== value)
                      : [...selectedValues, value]
                  );
                }}
                onSetSelected={rule.operator === "EQUALS" ? undefined : setSelectedValues}
                searchPlaceholder="Search category"
                summaryLabel="categories"
              />
            )}

            {rule.type === "BOOKING_DURATION_MIN" && (
              <SearchableMultiSelect
                options={options.slotDurations.map((item) => ({
                  value: String(item.value),
                  label: item.label,
                }))}
                selected={selectedValues}
                onToggle={(value) => {
                  const has = selectedValues.includes(value);
                  if (rule.operator === "EQUALS") {
                    setSelectedValues(has ? [] : [value]);
                    return;
                  }
                  setSelectedValues(
                    has
                      ? selectedValues.filter((item) => item !== value)
                      : [...selectedValues, value]
                  );
                }}
                onSetSelected={rule.operator === "EQUALS" ? undefined : setSelectedValues}
                searchPlaceholder="Search duration"
                summaryLabel="durations"
              />
            )}

            {(rule.type === "PRODUCT_ID" || rule.type === "TARGET_PRODUCT_ID") && (
              <SearchableMultiSelect
                options={options.products.map((item) => ({
                  value: item.id,
                  label: `${item.name} (${item.category})`,
                }))}
                selected={selectedValues}
                onToggle={(value) => {
                  const has = selectedValues.includes(value);
                  if (rule.operator === "EQUALS") {
                    setSelectedValues(has ? [] : [value]);
                    return;
                  }
                  setSelectedValues(
                    has
                      ? selectedValues.filter((item) => item !== value)
                      : [...selectedValues, value]
                  );
                }}
                onSetSelected={rule.operator === "EQUALS" ? undefined : setSelectedValues}
                searchPlaceholder="Search products"
                summaryLabel="products"
              />
            )}

            {rule.type === "USER_ID" && (
              <Input
                label={rule.operator === "EQUALS" ? "Mobile Number" : "Mobile Numbers"}
                value={
                  rule.operator === "EQUALS"
                    ? typeof rule.value === "string"
                      ? rule.value
                      : ""
                    : selectedValues.join(", ")
                }
                onChange={(value) => {
                  if (rule.operator === "EQUALS") {
                    onChange({
                      ...rule,
                      value: normalizePhone(value),
                    });
                    return;
                  }
                  onChange({
                    ...rule,
                    value: value
                      .split(",")
                      .map((item) => normalizePhone(item))
                      .filter(Boolean),
                  });
                }}
                placeholder="Comma separated 10-digit mobile numbers"
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function FormattedDateField({
  label,
  value,
  formattedValue,
  onChange,
  min,
  max,
}: {
  label: string;
  value: string;
  formattedValue: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const openPicker = () => {
    const input = inputRef.current;
    if (!input) return;
    if (typeof input.showPicker === "function") {
      try {
        input.showPicker();
        return;
      } catch {
        // fall through to focus
      }
    }
    input.focus();
  };

  return (
    <div>
      <Label text={label} />
      <div
        className="relative mt-1"
        onClick={openPicker}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            openPicker();
          }
        }}
        role="button"
        tabIndex={0}
      >
        <input
          ref={inputRef}
          type="date"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          min={min}
          max={max}
          aria-label={label}
          className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
        />
        <div className="flex h-11 items-center justify-between rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-800">
          <span className="truncate">{formattedValue}</span>
          <Calendar size={14} className="shrink-0 text-slate-500" />
        </div>
      </div>
    </div>
  );
}

function getOperatorLabel(operator: CouponRuleOperator) {
  if (operator === "IN") return "Include selected";
  if (operator === "NOT_IN") return "Exclude selected";
  return operator;
}
