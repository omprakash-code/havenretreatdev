import { useEffect, useRef, useState } from "react";
import type {
  AdminCouponFormState,
  CouponRuleFormState,
  CouponRuleType,
} from "../../types";
import type {
  CouponRuleOptionInclude,
  CouponRuleOptions,
} from "../options.types";
import { SectionCard, Select } from "../fields";
import { RuleEditorCard } from "../RuleEditorCard";
import { RULE_TYPES } from "../constants";
import { getRuleMeta } from "../utils";
import {
  buildRestrictionPickerOptions,
  mergeRestrictionOrder,
  resolveLocationRestrictionSelection,
} from "./rulesTab.helpers";

type RuleWithIndex = {
  index: number;
  rule: CouponRuleFormState;
};

type OrderedRestrictionEntry =
  | {
      kind: "location";
      token: string;
      label: string;
    }
  | {
      kind: "rule";
      token: string;
      label: string;
      item: RuleWithIndex;
    };

const TARGET_RULE_TYPES = new Set<CouponRuleType>([
  "TARGET_CATEGORY",
  "TARGET_PRODUCT_ID",
]);

const LEGACY_HIDDEN_CONDITION_TYPES = new Set<CouponRuleType>([
  "USER_ID",
]);
const LOCATION_RESTRICTION_TYPE = "__LOCATION__" as const;

export default function RulesTab({
  form,
  patchForm,
  addRule,
  removeRule,
  updateRule,
  options,
  ensureRuleOptions,
}: {
  form: AdminCouponFormState;
  patchForm: (patch: Partial<AdminCouponFormState>) => void;
  addRule: (type?: CouponRuleType) => void;
  removeRule: (index: number) => void;
  updateRule: (index: number, rule: CouponRuleFormState) => void;
  options: CouponRuleOptions;
  ensureRuleOptions: (
    include: CouponRuleOptionInclude[]
  ) => Promise<Partial<CouponRuleOptions> | void>;
}) {
  const [restrictionPickerOpen, setRestrictionPickerOpen] = useState(false);
  const [selectedRestrictionType, setSelectedRestrictionType] = useState("");
  const [pendingLocationRestriction, setPendingLocationRestriction] = useState(false);
  const restrictionsListRef = useRef<HTMLDivElement | null>(null);
  const shouldScrollToNewRestrictionRef = useRef(false);
  const visibleConditions: Array<RuleWithIndex & { token: string; label: string }> = [];
  const typeOccurrence = new Map<string, number>();
  form.rules.forEach((rule, index) => {
    if (TARGET_RULE_TYPES.has(rule.type) || LEGACY_HIDDEN_CONDITION_TYPES.has(rule.type)) {
      return;
    }
    const occurrence = typeOccurrence.get(rule.type) ?? 0;
    typeOccurrence.set(rule.type, occurrence + 1);
    visibleConditions.push({
      index,
      rule,
      token: `${rule.id ?? rule.type}:${occurrence}`,
      label: getRuleMeta(rule.type).label,
    });
  });
  const hiddenLegacyConditions: RuleWithIndex[] = form.rules
    .map((rule, index) => ({ rule, index }))
    .filter(({ rule }) => LEGACY_HIDDEN_CONDITION_TYPES.has(rule.type));
  const restrictionTypeOptions = [
    { value: LOCATION_RESTRICTION_TYPE, label: "Location" },
    ...RULE_TYPES.filter(
      (item) =>
        ![
          "USER_ID",
          "TARGET_CATEGORY",
          "TARGET_PRODUCT_ID",
          "SLOT_TIME_RANGE",
        ].includes(item.value)
    ).map((item) => ({
      value: item.value,
      label: item.label,
    })),
  ];
  const handleSelectLocationType = async () => {
    const decision = resolveLocationRestrictionSelection({
      currentLocationId: form.locationId,
      availableLocationIds: options.locations.map((location) => location.id),
    });

    if (decision.nextLocationId) {
      patchForm({ locationId: decision.nextLocationId });
      setPendingLocationRestriction(false);
    }

    setPendingLocationRestriction(decision.pending);

    if (decision.shouldLoad) {
      const loadedOptions = await ensureRuleOptions(["locations"]);
      patchForm({ locationId: loadedOptions?.locations?.[0]?.id ?? null });
      setPendingLocationRestriction(false);
    }
  };
  const hasRestriction = (type: CouponRuleType) =>
    visibleConditions.some(({ rule }) => rule.type === type);
  const addRestriction = (type: CouponRuleType) => {
    if (hasRestriction(type)) return;
    addRule(type);
  };
  const replaceLocationWithRule = (type: CouponRuleType) => {
    patchForm({ locationId: null });
    addRestriction(type);
  };
  const availableRestrictionOptions = restrictionTypeOptions.filter((option) =>
    option.value === LOCATION_RESTRICTION_TYPE
      ? !form.locationId
      : !hasRestriction(option.value as CouponRuleType)
  );
  const pickerRestrictionOptions = buildRestrictionPickerOptions({
    restrictionTypeOptions,
    availableRestrictionOptions,
    selectedRestrictionType,
  });
  const activeRestrictionCount =
    (form.locationId || pendingLocationRestriction ? 1 : 0) + visibleConditions.length;
  const totalRestrictionCount =
    activeRestrictionCount + hiddenLegacyConditions.length;
  const [restrictionsManuallyEnabled, setRestrictionsManuallyEnabled] = useState(
    totalRestrictionCount > 0
  );
  const [restrictionOrder, setRestrictionOrder] = useState<string[]>([]);
  const restrictionsEnabled = restrictionsManuallyEnabled || totalRestrictionCount > 0;

  const restrictionEntries: OrderedRestrictionEntry[] = [
    ...(form.locationId || pendingLocationRestriction
      ? [
          {
            kind: "location" as const,
            token: "location",
            label: "Location",
          },
        ]
      : []),
    ...visibleConditions.map((item) => ({
      kind: "rule" as const,
      token: item.token,
      label: item.label,
      item,
    })),
  ];
  const restrictionTokenKey = restrictionEntries.map((entry) => entry.token).join("|");

  const mergedRestrictionOrder = mergeRestrictionOrder(
    restrictionOrder,
    restrictionEntries.map((entry) => entry.token)
  );

  const orderedRestrictionEntries = [...restrictionEntries].sort((a, b) => {
    const aIndex = mergedRestrictionOrder.indexOf(a.token);
    const bIndex = mergedRestrictionOrder.indexOf(b.token);
    const safeA = aIndex === -1 ? Number.MAX_SAFE_INTEGER : aIndex;
    const safeB = bIndex === -1 ? Number.MAX_SAFE_INTEGER : bIndex;
    return safeA - safeB;
  });

  useEffect(() => {
    if (!shouldScrollToNewRestrictionRef.current) return;
    if (orderedRestrictionEntries.length === 0) return;

    shouldScrollToNewRestrictionRef.current = false;

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const container = restrictionsListRef.current;
        if (!container) return;
        container.scrollIntoView({ behavior: "smooth", block: "end" });
        const lastRestriction = container.lastElementChild as HTMLElement | null;
        lastRestriction?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      });
    });
  }, [orderedRestrictionEntries.length, restrictionTokenKey]);

  const clearAllRestrictions = () => {
    patchForm({
      locationId: null,
      rules: form.rules.filter((rule) => TARGET_RULE_TYPES.has(rule.type)),
    });
    setPendingLocationRestriction(false);
    setRestrictionPickerOpen(false);
    setSelectedRestrictionType("");
    setRestrictionOrder([]);
  };

  const handleRestrictionsToggle = (checked: boolean) => {
    setRestrictionsManuallyEnabled(checked);
    setSelectedRestrictionType("");

    if (!checked) {
      clearAllRestrictions();
      return;
    }

    if (totalRestrictionCount === 0) {
      setRestrictionPickerOpen(true);
    }
  };

  const handleAddRestriction = (value: string) => {
    if (!value) return;

    shouldScrollToNewRestrictionRef.current = true;

    if (value === LOCATION_RESTRICTION_TYPE) {
      void handleSelectLocationType();
      setRestrictionOrder((prev) =>
        prev.includes("location") ? prev : [...prev, "location"]
      );
    } else {
      addRestriction(value as CouponRuleType);
      setRestrictionOrder((prev) => [...prev, `${value}:0`]);
    }

    setRestrictionPickerOpen(false);
  };

  return (
    <div className="space-y-3">
      <SectionCard
        keepHeaderInlineOnMobile
        title={
          <span className="inline-flex items-baseline gap-1.5">
            <span>Additional Restrictions</span>
            {restrictionsEnabled && totalRestrictionCount > 0 ? (
              <span className="whitespace-nowrap text-xs font-medium text-slate-500">
                {totalRestrictionCount} added
              </span>
            ) : null}
          </span>
        }
        rightContent={
          restrictionsEnabled && totalRestrictionCount > 0 ? (
            <button
              type="button"
              onClick={() => {
                setRestrictionPickerOpen((current) => !current);
                setSelectedRestrictionType("");
              }}
              className="inline-flex min-h-8 shrink-0 cursor-pointer items-center justify-center gap-1 rounded-md border border-slate-200 px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50 sm:min-h-9 sm:px-3 sm:text-sm"
            >
              {restrictionPickerOpen ? "Cancel" : "+ Add"}
            </button>
          ) : null
        }
      >
        <div className="space-y-2">
          <label className="flex items-start gap-3 px-0.5 py-2">
            <input
              type="checkbox"
              checked={restrictionsEnabled}
              onChange={(event) => handleRestrictionsToggle(event.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 accent-slate-900 focus:ring-slate-300"
            />
            <span className="text-sm font-medium text-slate-900">
              Limit where this coupon works
            </span>
          </label>

          {restrictionsEnabled &&
          (restrictionPickerOpen || totalRestrictionCount === 0) ? (
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
              <Select
                label="Restriction Type"
                value={selectedRestrictionType}
                onChange={(value) => {
                  setSelectedRestrictionType(value);
                  handleAddRestriction(value);
                }}
                options={pickerRestrictionOptions}
              />
            </div>
          ) : null}

          {restrictionsEnabled && orderedRestrictionEntries.length > 0 ? (
            <div ref={restrictionsListRef} className="space-y-3">
              {orderedRestrictionEntries.map((entry, displayIndex) => {
                if (entry.kind === "location") {
                  return (
                    <div key={entry.token} className="rounded-md border border-slate-200 bg-slate-50 p-3">
                      <div className="mb-3 flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full border border-slate-300 bg-white px-1.5 text-[11px] font-semibold text-slate-700">
                            {displayIndex + 1}
                          </span>
                          <p className="text-sm font-semibold text-slate-900">{entry.label}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => patchForm({ locationId: null })}
                          className="inline-flex min-h-8 shrink-0 cursor-pointer items-center gap-1 rounded-md border border-red-200 px-2.5 py-1.5 text-xs text-red-700 hover:bg-red-50 sm:min-h-0 sm:px-2 sm:py-1"
                        >
                          Remove
                        </button>
                      </div>
                      {pendingLocationRestriction && !form.locationId ? (
                        <div className="rounded-md border border-dashed border-slate-300 bg-white px-3 py-3 text-sm text-slate-500">
                          Loading locations...
                        </div>
                      ) : (
                        <>
                          <div className="mb-3">
                            <Select
                              label="Restriction Type"
                              value={LOCATION_RESTRICTION_TYPE}
                              onChange={(value) => {
                                if (value === LOCATION_RESTRICTION_TYPE) return;
                                replaceLocationWithRule(value as CouponRuleType);
                              }}
                              options={restrictionTypeOptions}
                            />
                          </div>
                          <Select
                            label="Location"
                            info="Coupon will work only for bookings from this location."
                            value={form.locationId ?? ""}
                            onChange={(value) => patchForm({ locationId: value || null })}
                            options={options.locations.map((location) => ({
                              value: location.id,
                              label: location.name,
                            }))}
                          />
                        </>
                      )}
                    </div>
                  );
                }

                const { rule, index } = entry.item;
                const meta = getRuleMeta(rule.type);
                return (
                  <RuleEditorCard
                    key={entry.token}
                    index={index}
                    displayIndex={displayIndex + 1}
                    title={entry.label}
                    rule={rule}
                    meta={meta}
                    onChange={(nextRule) => updateRule(index, nextRule)}
                    onRemove={() => removeRule(index)}
                    onSelectLocationType={() => {
                      removeRule(index);
                      handleSelectLocationType();
                    }}
                    options={options}
                    ensureRuleOptions={ensureRuleOptions}
                  />
                );
              })}
            </div>
          ) : null}

          {restrictionsEnabled && hiddenLegacyConditions.length > 0 ? (
            <div className="space-y-3">
              <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-800">
                This coupon contains legacy advanced rules kept for backward compatibility.
              </div>
              {hiddenLegacyConditions.map(({ rule, index }) => {
                const meta = getRuleMeta(rule.type);
                return (
                  <RuleEditorCard
                    key={`${rule.type}-${index}`}
                    index={index}
                    rule={rule}
                    meta={meta}
                    onChange={(nextRule) => updateRule(index, nextRule)}
                    onRemove={() => removeRule(index)}
                    onSelectLocationType={() => {
                      removeRule(index);
                      handleSelectLocationType();
                    }}
                    options={options}
                    ensureRuleOptions={ensureRuleOptions}
                  />
                );
              })}
            </div>
          ) : null}
        </div>
      </SectionCard>
    </div>
  );
}
