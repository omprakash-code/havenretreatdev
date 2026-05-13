import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Calendar, Trash } from "@/components/icons";
import { formatInTimeZone } from "date-fns-tz";
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
import { formatISTDate, formatSlotTime } from "@/lib/formatters";
import SearchableMultiSelect from "./SearchableMultiSelect";

const IST_TIMEZONE = "Asia/Kolkata";
const LOCATION_RESTRICTION_TYPE = "__LOCATION__" as const;

type SlotRuleOption = {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  status?: string;
  theatreId?: string;
  theatreName?: string;
  locationId?: string;
  locationName?: string;
};

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
  const [slotFilterDate, setSlotFilterDate] = useState("");
  const [slotFilterLocationId, setSlotFilterLocationId] = useState("");
  const [slotFilterTheatreId, setSlotFilterTheatreId] = useState("");
  const [slotOptions, setSlotOptions] = useState<SlotRuleOption[]>([]);
  const [slotOptionCache, setSlotOptionCache] = useState<Record<string, SlotRuleOption>>({});
  const [slotOptionsLoading, setSlotOptionsLoading] = useState(false);
  const [dateRangeInteractionError, setDateRangeInteractionError] = useState<string | null>(
    null
  );
  const hydratedSlotContextKeyRef = useRef<string | null>(null);

  const selectedValues = useMemo(() => {
    if (rule.operator === "EQUALS") {
      return typeof rule.value === "string" && rule.value ? [rule.value] : [];
    }
    return Array.isArray(rule.value) ? rule.value : [];
  }, [rule.operator, rule.value]);
  const selectedSlotIdsParam = useMemo(
    () => selectedValues.join(","),
    [selectedValues]
  );

  const upsertSlotCache = (entries: SlotRuleOption[]) => {
    if (entries.length === 0) return;
    setSlotOptionCache((prev) => {
      const next = { ...prev };
      entries.forEach((entry) => {
        next[entry.id] = normalizeSlotOption(entry);
      });
      return next;
    });
  };

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
        label: getOperatorLabel(rule.type, value),
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
              "SLOT_TIME_RANGE",
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
      : formatISTDate(fromRuleDate);
  const formattedToRuleDate =
    !toRuleDate
      ? "Not set"
      : Number.isNaN(toRuleDate.getTime())
      ? "Invalid date"
      : formatISTDate(toRuleDate);
  const formattedSlotFilterDate = useMemo(() => {
    if (!slotFilterDate) return "Not set";
    const parsed = new Date(`${slotFilterDate}T00:00:00+05:30`);
    if (Number.isNaN(parsed.getTime())) return "Invalid date";
    return formatISTDate(parsed);
  }, [slotFilterDate]);

  const theatreOptions = useMemo(() => {
    if (!slotFilterLocationId) return options.theatres;
    return options.theatres.filter((item) => item.locationId === slotFilterLocationId);
  }, [options.theatres, slotFilterLocationId]);
  const groupedSlotOptions = useMemo(() => {
    if (rule.type !== "SLOT_ID") return [];

    const mergedById = new Map<string, SlotRuleOption>();
    slotOptions.forEach((slot) => mergedById.set(slot.id, slot));
    selectedValues.forEach((slotId) => {
      const cached = slotOptionCache[slotId];
      if (cached) mergedById.set(slotId, cached);
    });

    const byDate = new Map<
      string,
      {
        dateKey: string;
        dateLabel: string;
        options: { value: string; label: string }[];
      }
    >();

    mergedById.forEach((slot, slotId) => {
      const dateKey = slot.date?.trim() || "__unknown__";
      const dateLabel =
        dateKey === "__unknown__"
          ? "Unknown date"
          : formatISTDate(new Date(`${dateKey}T00:00:00+05:30`));
      const group = byDate.get(dateKey) ?? {
        dateKey,
        dateLabel,
        options: [],
      };

      const slotLabel =
        slot.startTime && slot.endTime
          ? `${formatSlotTime(slot.startTime, slot.endTime)} · ${slot.status ?? "AVAILABLE"}`
          : `Slot ${slotId}`;

      group.options.push({
        value: slotId,
        label: slotLabel,
      });
      byDate.set(dateKey, group);
    });

    return Array.from(byDate.values())
      .map((group) => ({
        ...group,
        options: group.options.sort((a, b) => {
          const aSlot = mergedById.get(a.value);
          const bSlot = mergedById.get(b.value);
          const aStart = String(aSlot?.startTime ?? "99:99");
          const bStart = String(bSlot?.startTime ?? "99:99");
          const startSort = aStart.localeCompare(bStart);
          if (startSort !== 0) return startSort;
          return a.label.localeCompare(b.label);
        }),
      }))
      .sort((a, b) => {
        if (a.dateKey === "__unknown__") return 1;
        if (b.dateKey === "__unknown__") return -1;
        return b.dateKey.localeCompare(a.dateKey);
      });
  }, [rule.type, slotOptions, selectedValues, slotOptionCache]);

  useEffect(() => {
    if (!["PRODUCT_ID", "TARGET_PRODUCT_ID"].includes(rule.type) || options.products.length > 0) {
      return;
    }
    void ensureRuleOptions(["products"]);
  }, [ensureRuleOptions, options.products.length, rule.type]);

  useEffect(() => {
    if (rule.type !== "THEATRE_ID" || options.theatres.length > 0) {
      return;
    }
    void ensureRuleOptions(["theatres"]);
  }, [ensureRuleOptions, options.theatres.length, rule.type]);

  useEffect(() => {
    if (rule.type !== "SLOT_DURATION_MIN" || options.slotDurations.length > 0) {
      return;
    }
    void ensureRuleOptions(["slotDurations"]);
  }, [ensureRuleOptions, options.slotDurations.length, rule.type]);

  useEffect(() => {
    if (rule.type !== "SLOT_ID") return;
    const selectedSlotIds = selectedSlotIdsParam
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
    if (selectedSlotIds.length === 0) return;
    if (slotFilterLocationId && slotFilterTheatreId && slotFilterDate) return;

    let cancelled = false;
    const loadSelectedSlotContext = async () => {
      setSlotOptionsLoading(true);
      try {
        const params = new URLSearchParams({
          slotIds: selectedSlotIdsParam,
          includeContext: "true",
        });
        const res = await fetch(`/api/admin/coupons/options/slots?${params.toString()}`);
        const json = (await res.json()) as {
          success: boolean;
          data?: SlotRuleOption[];
        };
        if (!res.ok || !json.success || !Array.isArray(json.data) || cancelled) return;

        const normalizedSlots = json.data.map(normalizeSlotOption);
        setSlotOptions(normalizedSlots);
        upsertSlotCache(normalizedSlots);

        const matched = normalizedSlots
          .filter((slot) => selectedSlotIds.includes(slot.id))
          .sort((a, b) => {
            const dateSort = b.date.localeCompare(a.date);
            if (dateSort !== 0) return dateSort;
            return b.startTime.localeCompare(a.startTime);
          })[0];
        if (!matched) return;

        if (!slotFilterLocationId && matched.locationId) {
          setSlotFilterLocationId(matched.locationId);
        }
        if (!slotFilterTheatreId && matched.theatreId) {
          setSlotFilterTheatreId(matched.theatreId);
        }
        if (!slotFilterDate && matched.date) {
          setSlotFilterDate(String(matched.date).slice(0, 10));
        }
        if (matched.locationId && matched.theatreId && matched.date) {
          hydratedSlotContextKeyRef.current = [
            matched.locationId,
            matched.theatreId,
            String(matched.date).slice(0, 10),
          ].join("|");
        }
      } finally {
        if (!cancelled) setSlotOptionsLoading(false);
      }
    };

    void loadSelectedSlotContext();
    return () => {
      cancelled = true;
    };
  }, [
    rule.type,
    selectedSlotIdsParam,
    slotFilterDate,
    slotFilterLocationId,
    slotFilterTheatreId,
  ]);

  useEffect(() => {
    if (rule.type !== "SLOT_ID") return;
    if (!slotFilterLocationId || !slotFilterTheatreId || !slotFilterDate) {
      setSlotOptions([]);
      return;
    }

    const requestedContextKey = [
      slotFilterLocationId,
      slotFilterTheatreId,
      slotFilterDate,
    ].join("|");
    if (
      hydratedSlotContextKeyRef.current === requestedContextKey &&
      slotOptions.length > 0
    ) {
      hydratedSlotContextKeyRef.current = null;
      return;
    }

    let cancelled = false;
    const load = async () => {
      setSlotOptionsLoading(true);
      try {
        const params = new URLSearchParams({
          locationId: slotFilterLocationId,
          theatreId: slotFilterTheatreId,
          date: slotFilterDate,
        });
        const res = await fetch(`/api/admin/coupons/options/slots?${params.toString()}`);
        const json = (await res.json()) as {
          success: boolean;
          data?: SlotRuleOption[];
        };
        if (!cancelled && res.ok && json.success && Array.isArray(json.data)) {
          const normalizedSlots = json.data.map(normalizeSlotOption);
          setSlotOptions(normalizedSlots);
          upsertSlotCache(normalizedSlots);
        }
      } finally {
        if (!cancelled) setSlotOptionsLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [
    rule.type,
    slotFilterLocationId,
    slotFilterTheatreId,
    slotFilterDate,
    slotOptions.length,
  ]);

  useEffect(() => {
    if (meta.valueKind !== "dateRange") {
      setDateRangeInteractionError(null);
      return;
    }
    if (!dateValue.from || !dateValue.to) {
      setDateRangeInteractionError(null);
      return;
    }
    if (dateValue.to >= dateValue.from) {
      setDateRangeInteractionError(null);
    }
  }, [meta.valueKind, dateValue.from, dateValue.to]);

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

            {rule.type === "THEATRE_ID" && (
              options.theatres.length === 0 ? (
                <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-500">
                  Loading theatres...
                </div>
              ) : (
                <MultiSelectGrid
                  options={options.theatres.map((item) => ({
                    value: item.id,
                    label: `${item.name} (${item.locationName})`,
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
                />
              )
            )}

            {rule.type === "SLOT_DURATION_MIN" && (
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

            {rule.type === "SLOT_ID" && (
              <div className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-3">
                  <Select
                    label="Location"
                    value={slotFilterLocationId}
                    onChange={(value) => {
                      setSlotFilterLocationId(value);
                      setSlotFilterTheatreId("");
                      setSlotFilterDate("");
                      setSlotOptions([]);
                    }}
                    options={[
                      { value: "", label: "Select Location" },
                      ...options.locations.map((item) => ({
                        value: item.id,
                        label: item.name,
                      })),
                    ]}
                  />
                  <Select
                    label="Theatre"
                    value={slotFilterTheatreId}
                    onChange={(value) => {
                      setSlotFilterTheatreId(value);
                      setSlotFilterDate("");
                      setSlotOptions([]);
                    }}
                    options={[
                      { value: "", label: "Select Theatre" },
                      ...theatreOptions.map((item) => ({
                        value: item.id,
                        label: item.name,
                      })),
                    ]}
                  />
                  <FormattedDateField
                    label="Date"
                    value={slotFilterDate}
                    formattedValue={formattedSlotFilterDate}
                    onChange={(value) => {
                      setSlotFilterDate(value);
                      setSlotOptions([]);
                    }}
                  />
                </div>

                {!slotFilterLocationId || !slotFilterTheatreId || !slotFilterDate ? (
                  <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-500">
                    Select Location, Theatre and Date to load slots.
                  </div>
                ) : null}

                {slotOptionsLoading && (
                  <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
                    Loading slots...
                  </div>
                )}

                <GroupedMultiSelectGrid
                  groups={groupedSlotOptions}
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
                />
              </div>
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

function normalizeSlotDateKey(rawDate: string): string {
  const trimmed = rawDate.trim();
  if (!trimmed) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return trimmed;
  return formatInTimeZone(parsed, IST_TIMEZONE, "yyyy-MM-dd");
}

function normalizeSlotOption(slot: SlotRuleOption): SlotRuleOption {
  return {
    ...slot,
    date: normalizeSlotDateKey(String(slot.date ?? "")),
  };
}

function getOperatorLabel(
  ruleType: CouponRuleType,
  operator: CouponRuleOperator
) {
  if (operator === "IN") return "Include selected";
  if (operator === "NOT_IN") return "Exclude selected";
  if (ruleType === "SLOT_ID" && operator === "EQUALS") return "Include selected";
  return operator;
}

function GroupedMultiSelectGrid({
  groups,
  selected,
  onToggle,
}: {
  groups: Array<{
    dateKey: string;
    dateLabel: string;
    options: { value: string; label: string }[];
  }>;
  selected: string[];
  onToggle: (value: string) => void;
}) {
  if (groups.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-500">
        No options found.
      </div>
    );
  }

  return (
    <div className="max-h-56 overflow-auto rounded-md border border-slate-200 bg-slate-50 p-2">
      <div className="space-y-2">
        {groups.map((group) => (
          <div key={group.dateKey} className="rounded-md border border-slate-200 bg-white">
            <div className="border-b border-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-600">
              {group.dateLabel}
            </div>
            <div className="space-y-1 p-1.5">
              {group.options.map((option) => {
                const checked = selected.includes(option.value);
                return (
                  <label
                    key={option.value}
                    className="flex min-h-10 cursor-pointer items-center gap-3 rounded-md px-2 py-2 text-sm text-slate-700 hover:bg-slate-50 sm:min-h-0 sm:gap-2 sm:py-1.5 sm:text-xs"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => onToggle(option.value)}
                      className="h-4 w-4 cursor-pointer rounded border-slate-300 accent-slate-900 sm:h-3.5 sm:w-3.5"
                    />
                    <span>{option.label}</span>
                  </label>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MultiSelectGrid({
  options,
  selected,
  onToggle,
}: {
  options: { value: string; label: string }[];
  selected: string[];
  onToggle: (value: string) => void;
}) {
  if (options.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-500">
        No options found.
      </div>
    );
  }

  return (
    <div className="max-h-48 overflow-auto rounded-md border border-slate-200 bg-slate-50 p-2">
      <div className="space-y-1">
        {options.map((option) => {
          const checked = selected.includes(option.value);
          return (
            <label
              key={option.value}
              className="flex min-h-10 cursor-pointer items-center gap-3 rounded-md px-2 py-2 text-sm text-slate-700 hover:bg-white sm:min-h-0 sm:gap-2 sm:py-1.5 sm:text-xs"
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => onToggle(option.value)}
                className="h-4 w-4 cursor-pointer rounded border-slate-300 accent-slate-900 sm:h-3.5 sm:w-3.5"
              />
              <span>{option.label}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
