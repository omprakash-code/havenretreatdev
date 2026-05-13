import { useEffect, useRef, useState } from "react";
import { formatISTDateTime } from "@/lib/formatters";
import { Calendar } from "@/components/icons";
import { ToggleSwitch } from "@/components/ui/ToggleSwitch";
import type { AdminCouponFormState, CouponRuleFormState } from "../../types";
import type {
  CouponRuleOptionInclude,
  CouponRuleOptions,
} from "../options.types";
import SearchableMultiSelect from "../SearchableMultiSelect";
import {
  Label,
  NumberInput,
  SectionCard,
  Select,
} from "../fields";
import { getDefaultCouponValidTill } from "../constants";
import {
  getStackableCouponUiState,
  shouldEnableLimitStackableCoupons,
  shouldLoadStackableCouponsOptions,
  shouldLoadTargetProductsOptions,
} from "./basicsTab.helpers";

type ApplyDiscountOnMode =
  | "BOOKING_TOTAL"
  | "SLOT_ONLY"
  | "ALL_PRODUCTS"
  | "TARGET_CATEGORY"
  | "TARGET_PRODUCT_ID";

function replaceTargetRules(
  rules: CouponRuleFormState[],
  targetRules: CouponRuleFormState[]
) {
  const withoutTargets = rules.filter(
    (rule) => rule.type !== "TARGET_CATEGORY" && rule.type !== "TARGET_PRODUCT_ID"
  );
  return [...withoutTargets, ...targetRules];
}

function deriveApplyDiscountOn(form: AdminCouponFormState): ApplyDiscountOnMode {
  const hasProductTarget = form.rules.some((rule) => rule.type === "TARGET_PRODUCT_ID");
  if (hasProductTarget) return "TARGET_PRODUCT_ID";

  const hasCategoryTarget = form.rules.some((rule) => rule.type === "TARGET_CATEGORY");
  if (hasCategoryTarget) return "TARGET_CATEGORY";

  if (form.scope === "PRODUCTS_ONLY") return "ALL_PRODUCTS";
  if (form.scope === "SLOT_ONLY") return "SLOT_ONLY";
  return "BOOKING_TOTAL";
}

function generateCouponCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const parts = Array.from({ length: 2 }, () =>
    Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join("")
  );
  return parts.join("-");
}

export default function BasicsTab({
  form,
  patchForm,
  options,
  currentCouponId,
  ensureRuleOptions,
  optionsLoading,
}: {
  form: AdminCouponFormState;
  patchForm: (patch: Partial<AdminCouponFormState>) => void;
  options: CouponRuleOptions;
  currentCouponId?: string;
  ensureRuleOptions: (
    include: CouponRuleOptionInclude[]
  ) => Promise<Partial<CouponRuleOptions> | void>;
  optionsLoading: boolean;
}) {
  const applyDiscountOn = deriveApplyDiscountOn(form);
  const targetCategoryRule = form.rules.find((rule) => rule.type === "TARGET_CATEGORY");
  const targetProductRule = form.rules.find((rule) => rule.type === "TARGET_PRODUCT_ID");
  const selectedTargetCategories = Array.isArray(targetCategoryRule?.value)
    ? targetCategoryRule.value.map(String)
    : [];
  const selectedTargetProducts = Array.isArray(targetProductRule?.value)
    ? targetProductRule.value.map(String)
    : [];
  const [minimumAmountManualEnabled, setMinimumAmountManualEnabled] = useState(false);
  const [usageLimitManualEnabled, setUsageLimitManualEnabled] = useState(false);
  const [perUserLimitManualEnabled, setPerUserLimitManualEnabled] = useState(false);
  const [maxDiscountManualEnabled, setMaxDiscountManualEnabled] = useState(false);
  const [limitStackableCouponsManualEnabled, setLimitStackableCouponsManualEnabled] =
    useState(false);
  const { stackableCouponOptions, canLimitStackableCoupons } = getStackableCouponUiState({
    coupons: options.coupons,
    currentCouponId,
    formId: form.id,
    selectedStackableCouponIds: form.stackableCouponIds,
  });

  const minimumAmountEnabled = form.minimumAmount != null || minimumAmountManualEnabled;
  const usageLimitEnabled = form.usageLimit != null || usageLimitManualEnabled;
  const perUserLimitEnabled = form.perUserUsageLimit != null || perUserLimitManualEnabled;
  const maxDiscountEnabled = form.maxDiscount != null || maxDiscountManualEnabled;
  const limitStackableCouponsEnabled = shouldEnableLimitStackableCoupons({
    isStackable: form.isStackable,
    stackableCouponIds: form.stackableCouponIds,
    canLimitStackableCoupons,
  })
    ? true
    : form.isStackable && canLimitStackableCoupons && limitStackableCouponsManualEnabled;

  useEffect(() => {
    if (
      !shouldLoadTargetProductsOptions({
        applyDiscountOn,
        productsCount: options.products.length,
      })
    ) {
      return;
    }
    void ensureRuleOptions(["products"]);
  }, [applyDiscountOn, ensureRuleOptions, options.products.length]);

  useEffect(() => {
    if (
      !shouldLoadStackableCouponsOptions({
        isStackable: form.isStackable,
        couponsCount: options.coupons.length,
      })
    ) {
      return;
    }
    void ensureRuleOptions(["coupons"]);
  }, [ensureRuleOptions, form.isStackable, options.coupons.length]);

  const setApplyDiscountOn = (value: ApplyDiscountOnMode) => {
    if (value === "BOOKING_TOTAL") {
      patchForm({
        scope: "BOOKING_TOTAL",
        rules: replaceTargetRules(form.rules, []),
      });
      return;
    }

    if (value === "SLOT_ONLY") {
      patchForm({
        scope: "SLOT_ONLY",
        rules: replaceTargetRules(form.rules, []),
      });
      return;
    }

    if (value === "ALL_PRODUCTS") {
      patchForm({
        scope: "PRODUCTS_ONLY",
        rules: replaceTargetRules(form.rules, []),
      });
      return;
    }

    if (value === "TARGET_CATEGORY") {
      patchForm({
        scope: "PRODUCTS_ONLY",
        rules: replaceTargetRules(form.rules, [
          {
            type: "TARGET_CATEGORY",
            operator: "IN",
            value: selectedTargetCategories,
          },
        ]),
      });
      return;
    }

    patchForm({
      scope: "PRODUCTS_ONLY",
      rules: replaceTargetRules(form.rules, [
        {
          type: "TARGET_PRODUCT_ID",
          operator: "IN",
          value: selectedTargetProducts,
        },
      ]),
    });
  };

  const toggleTargetCategory = (value: string) => {
    const has = selectedTargetCategories.includes(value);
    const next = has
      ? selectedTargetCategories.filter((item) => item !== value)
      : [...selectedTargetCategories, value];
    patchForm({
      rules: replaceTargetRules(form.rules, [
        {
          type: "TARGET_CATEGORY",
          operator: "IN",
          value: next,
        },
      ]),
    });
  };

  const setTargetCategories = (values: string[]) => {
    patchForm({
      rules: replaceTargetRules(form.rules, [
        {
          type: "TARGET_CATEGORY",
          operator: "IN",
          value: values,
        },
      ]),
    });
  };

  const toggleTargetProduct = (value: string) => {
    const has = selectedTargetProducts.includes(value);
    const next = has
      ? selectedTargetProducts.filter((item) => item !== value)
      : [...selectedTargetProducts, value];
    patchForm({
      rules: replaceTargetRules(form.rules, [
        {
          type: "TARGET_PRODUCT_ID",
          operator: "IN",
          value: next,
        },
      ]),
    });
  };

  const setTargetProducts = (values: string[]) => {
    patchForm({
      rules: replaceTargetRules(form.rules, [
        {
          type: "TARGET_PRODUCT_ID",
          operator: "IN",
          value: values,
        },
      ]),
    });
  };

  return (
    <div className="space-y-3">
      <SectionCard
        title="Coupon Code"
        keepHeaderInlineOnMobile
        rightContent={
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs font-medium text-slate-600">
              {form.isActive ? "Active" : "Disabled"}
            </span>
            <ToggleSwitch
              checked={form.isActive}
              onChange={(checked) => patchForm({ isActive: checked })}
            />
          </div>
        }
      >
        <div>
          <div className="mb-0.5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-1">
              <Label text="Discount Code" />
              <span className="text-xs font-semibold text-red-500">*</span>
            </div>
            <button
              type="button"
              onClick={() => patchForm({ code: generateCouponCode() })}
              className="shrink-0 text-xs font-medium text-blue-600 hover:text-blue-700"
            >
              Generate random code
            </button>
          </div>
          <input
            value={form.code}
            onChange={(event) => patchForm({ code: event.target.value.toUpperCase() })}
            placeholder="e.g. WELCOME500"
            className="mt-1 h-11 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-slate-300"
          />
        </div>
      </SectionCard>

      <SectionCard title="Applies To">
        <div>
          <Select
            label="Discount Applies To"
            required
            value={applyDiscountOn}
            onChange={(value) => setApplyDiscountOn(value as ApplyDiscountOnMode)}
            options={[
              { value: "BOOKING_TOTAL", label: "Booking Total" },
              { value: "SLOT_ONLY", label: "Slot Price" },
              { value: "ALL_PRODUCTS", label: "All Booking Products" },
              { value: "TARGET_CATEGORY", label: "Product Category" },
              { value: "TARGET_PRODUCT_ID", label: "Products" },
            ]}
          />
        </div>

        {applyDiscountOn === "TARGET_CATEGORY" ? (
          <div className="mt-3">
            <Label text="Product Category" />
            <div className="mt-1">
              <SearchableMultiSelect
                options={[
                  { value: "CAKE", label: "Cake" },
                  { value: "DECORATION", label: "Decoration" },
                  { value: "GIFT", label: "Gift" },
                ]}
                selected={selectedTargetCategories}
                onToggle={toggleTargetCategory}
                onSetSelected={setTargetCategories}
                searchPlaceholder="Search category"
                summaryLabel="categories"
              />
            </div>
          </div>
        ) : null}

        {applyDiscountOn === "TARGET_PRODUCT_ID" ? (
          <div className="mt-3">
            <Label text="Products" />
            <div className="mt-1">
              <SearchableMultiSelect
                options={options.products.map((item) => ({
                  value: item.id,
                  label: `${item.name} (${item.category})`,
                }))}
                selected={selectedTargetProducts}
                onToggle={toggleTargetProduct}
                onSetSelected={setTargetProducts}
                searchPlaceholder="Search products"
                summaryLabel="products"
              />
            </div>
          </div>
        ) : null}
      </SectionCard>

      <SectionCard title="Discount Value">
        <div className="grid gap-3 sm:grid-cols-2">
          <Select
            label="Discount Type"
            required
            value={form.discountType}
            onChange={(value) =>
              patchForm({
                discountType: value as AdminCouponFormState["discountType"],
                maxDiscount: value === "PERCENTAGE" ? form.maxDiscount : null,
              })
            }
            options={[
              { value: "FLAT", label: "Fixed" },
              { value: "PERCENTAGE", label: "Percentage" },
            ]}
          />

          <NumberInput
            label={
              form.discountType === "FLAT"
                ? "Discount Amount"
                : "Discount Percentage (%)"
            }
            required
            value={form.discountValue > 0 ? form.discountValue : null}
            onChange={(value) => patchForm({ discountValue: value ?? 0 })}
            allowEmpty
            placeholder={
              form.discountType === "FLAT"
                ? "e.g. 500"
                : "e.g. 20"
            }
          />
        </div>

        {form.discountType === "PERCENTAGE" ? (
          <div className="mt-3">
            <OptionalNumberControl
              label="Set maximum discount amount"
              description=""
              checked={maxDiscountEnabled}
              onToggle={(checked) => {
                setMaxDiscountManualEnabled(checked);
                patchForm({ maxDiscount: checked ? form.maxDiscount ?? null : null });
              }}
              inputLabel="Maximum Discount Amount"
              value={form.maxDiscount ?? null}
              onChange={(value) => patchForm({ maxDiscount: value })}
              placeholder="e.g. 1000"
            />
          </div>
        ) : null}
      </SectionCard>

      <SectionCard title="Minimum Purchase Requirements">
        <OptionalNumberControl
          label="Set minimum purchase amount"
          description=""
          checked={minimumAmountEnabled}
          onToggle={(checked) => {
            setMinimumAmountManualEnabled(checked);
            patchForm({ minimumAmount: checked ? form.minimumAmount ?? null : null });
          }}
          inputLabel="Minimum Amount to Apply Coupon"
          inputInfo="Coupon will apply only when the selected amount reaches this value."
          value={form.minimumAmount ?? null}
          onChange={(value) => patchForm({ minimumAmount: value })}
          placeholder="e.g. 2000"
        />
      </SectionCard>

      <SectionCard title="Maximum Discount Uses">
        <div className="space-y-2">
          <OptionalNumberControl
            label="Set total usage limit"
            description=""
            checked={usageLimitEnabled}
            onToggle={(checked) => {
              setUsageLimitManualEnabled(checked);
              patchForm({ usageLimit: checked ? form.usageLimit ?? null : null });
            }}
            inputLabel="Usage Limit"
            inputInfo="Once this limit is reached, the coupon stops working for everyone."
            value={form.usageLimit ?? null}
            onChange={(value) => patchForm({ usageLimit: value })}
            placeholder="e.g. 100"
          />

          <OptionalNumberControl
            label="Set per-customer limit"
            description=""
            checked={perUserLimitEnabled}
            onToggle={(checked) => {
              setPerUserLimitManualEnabled(checked);
              patchForm({
                perUserUsageLimit: checked ? form.perUserUsageLimit ?? null : null,
              });
            }}
            inputLabel="Per-user Limit"
            inputInfo="Customers will not be able to use the coupon more than this number of times."
            value={form.perUserUsageLimit ?? null}
            onChange={(value) => patchForm({ perUserUsageLimit: value })}
            placeholder="e.g. 1"
          />
        </div>
      </SectionCard>

      <SectionCard title="Combinations">
        <label className="flex items-center gap-3 px-0.5 py-2">
          <input
            type="checkbox"
            checked={form.isStackable}
            onChange={(event) => {
              const checked = event.target.checked;
              setLimitStackableCouponsManualEnabled(
                checked ? form.stackableCouponIds.length > 0 : false
              );
              if (checked && options.coupons.length === 0) {
                void ensureRuleOptions(["coupons"]);
              }
              patchForm({
                isStackable: checked,
                stackableCouponIds: checked
                  ? form.stackableCouponIds
                  : [],
              });
            }}
            className="h-4 w-4 rounded border-slate-300 accent-slate-900 focus:ring-slate-300"
          />
          <span className="text-sm text-slate-700">
            Allow coupon combinations
          </span>
        </label>

        {form.isStackable && (optionsLoading && options.coupons.length === 0 || canLimitStackableCoupons) ? (
          <div className="space-y-3 pt-2">
            {optionsLoading && options.coupons.length === 0 ? (
              <p className="px-0.5 text-sm text-slate-500">
                Loading available coupons...
              </p>
            ) : canLimitStackableCoupons ? (
              <label className="flex items-center gap-3 px-0.5 py-2">
                <input
                  type="checkbox"
                  checked={limitStackableCouponsEnabled}
                  onChange={(event) => {
                    const checked = event.target.checked;
                    setLimitStackableCouponsManualEnabled(checked);
                    if (!checked) {
                      patchForm({ stackableCouponIds: [] });
                    }
                  }}
                  className="h-4 w-4 rounded border-slate-300 accent-slate-900 focus:ring-slate-300"
                />
                <span className="text-sm text-slate-700">
                  Limit which coupons it can combine with
                </span>
              </label>
            ) : null}

            {canLimitStackableCoupons && limitStackableCouponsEnabled ? (
              <SearchableMultiSelect
                options={stackableCouponOptions}
                selected={form.stackableCouponIds}
                onToggle={(couponId) => {
                  const exists = form.stackableCouponIds.includes(couponId);
                  patchForm({
                    stackableCouponIds: exists
                      ? form.stackableCouponIds.filter((value) => value !== couponId)
                      : [...form.stackableCouponIds, couponId],
                  });
                }}
                onSetSelected={(values) =>
                  patchForm({ stackableCouponIds: values })
                }
                emptyText="No other coupons available."
                searchPlaceholder="Search coupon code..."
                summaryLabel="coupons"
                emptySelectionLabel="All stackable coupons allowed"
              />
            ) : null}
          </div>
        ) : null}
      </SectionCard>

    </div>
  );
}

export function ActiveDatesSection({
  form,
  patchForm,
  endDateEnabled,
  onEndDateEnabledChange,
}: {
  form: AdminCouponFormState;
  patchForm: (patch: Partial<AdminCouponFormState>) => void;
  endDateEnabled: boolean;
  onEndDateEnabledChange: (enabled: boolean) => void;
}) {
  const validFromDate = form.validFrom ? new Date(form.validFrom) : null;
  const validTillDate = form.validTill ? new Date(form.validTill) : null;
  const formattedValidFrom =
    !validFromDate
      ? "Not set"
      : Number.isNaN(validFromDate.getTime())
      ? "Invalid date"
      : formatISTDateTime(validFromDate);
  const formattedValidTill =
    !validTillDate
      ? "Not set"
      : Number.isNaN(validTillDate.getTime())
      ? "Invalid date"
      : formatISTDateTime(validTillDate);

  return (
    <SectionCard title="Active Dates">
      <div className="space-y-3">
        <FormattedDateTimeField
          label="Start Date"
          value={form.validFrom}
          formattedValue={formattedValidFrom}
          onChange={(value) => patchForm({ validFrom: value })}
        />

        <label className="flex items-center gap-3 px-0.5 py-2">
          <input
            type="checkbox"
            checked={endDateEnabled}
            onChange={(event) => {
              const checked = event.target.checked;
              onEndDateEnabledChange(checked);
              patchForm({
                validTill: checked
                  ? form.validTill ?? getDefaultCouponValidTill(form.validFrom)
                  : null,
              });
            }}
            className="h-4 w-4 rounded border-slate-300 accent-slate-900 focus:ring-slate-300"
          />
          <span className="text-sm text-slate-700">Set end date and time</span>
        </label>

        {endDateEnabled ? (
          <FormattedDateTimeField
            label="End Date"
            value={form.validTill ?? ""}
            formattedValue={formattedValidTill}
            onChange={(value) => patchForm({ validTill: value || null })}
          />
        ) : null}
      </div>
    </SectionCard>
  );
}

function OptionalNumberControl({
  label,
  description,
  checked,
  onToggle,
  inputLabel,
  inputInfo,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  description: string;
  checked: boolean;
  onToggle: (checked: boolean) => void;
  inputLabel: string;
  inputInfo?: string;
  value: number | null;
  onChange: (value: number | null) => void;
  placeholder: string;
}) {
  return (
    <div>
      <label className="flex cursor-pointer items-start gap-3 px-0.5 py-2">
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) => onToggle(event.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-slate-300 accent-slate-900 focus:ring-slate-300"
        />
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-900">{label}</p>
          {description ? (
            <p className="mt-0.5 text-[11px] text-slate-500">{description}</p>
          ) : null}
        </div>
      </label>

      {checked ? (
        <div className="pt-1.5">
          <NumberInput
            label={inputLabel}
            info={inputInfo}
            value={value}
            onChange={onChange}
            allowEmpty
            placeholder={placeholder}
          />
        </div>
      ) : null}
    </div>
  );
}

function FormattedDateTimeField({
  label,
  value,
  formattedValue,
  onChange,
}: {
  label: string;
  value: string;
  formattedValue: string;
  onChange: (value: string) => void;
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
          type="datetime-local"
          value={value}
          onChange={(e) => onChange(e.target.value)}
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
