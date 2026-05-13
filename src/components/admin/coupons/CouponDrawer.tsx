"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import AdminDrawer from "@/components/admin/drawer/AdminDrawer";
import type {
  AdminCouponFormState,
  CouponDrawerProps,
  CouponRuleFormState,
  CouponRuleType,
} from "./types";
import { createEmptyCouponForm } from "./drawer/constants";
import {
  getDefaultRuleValue,
  getRuleMeta,
  normalizeRuleFromApi,
  serializeForm,
  toDateTimeLocalInput,
  validateForm,
} from "./drawer/utils";
import BasicsTab, { ActiveDatesSection } from "./drawer/tabs/BasicsTab";
import RulesTab from "./drawer/tabs/RulesTab";
import PreviewTab from "./drawer/tabs/PreviewTab";
import type {
  CouponRuleOptionInclude,
  CouponRuleOptions,
} from "./drawer/options.types";
import { mergeRuleOptions } from "./drawer/couponRuleOptions.helpers";

type CouponDetailsResponse = {
  success: boolean;
  message?: string;
  data?: AdminCouponFormState;
};

function createEmptyRuleOptions(): CouponRuleOptions {
  return {
    locations: [],
    theatres: [],
    products: [],
    slots: [],
    slotDurations: [],
    coupons: [],
  };
}

export function invalidateCouponRuleOptionsCache() {
  // Intentionally left as a no-op.
  // Coupon rule options are now fetched fresh instead of using a shared cache.
}

export default function CouponDrawer({
  open,
  mode,
  couponId,
  onClose,
  onSaved,
}: CouponDrawerProps) {
  const isEdit = mode === "edit";
  const [form, setForm] = useState<AdminCouponFormState>(createEmptyCouponForm);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [initialRuleSignature, setInitialRuleSignature] = useState("[]");
  const [ruleOptions, setRuleOptions] = useState<CouponRuleOptions>(createEmptyRuleOptions);
  const [error, setError] = useState<string | null>(null);
  const [errorKind, setErrorKind] = useState<"validation" | "request" | null>(
    null
  );
  const [endDateEnabled, setEndDateEnabled] = useState(isEdit);
  const [editorInstanceKey, setEditorInstanceKey] = useState(0);
  const loadReqRef = useRef(0);

  const drawerTitle = isEdit ? "Edit Coupon" : "Create Coupon";

  const previewLocationName = useMemo(() => {
    if (!form.locationId) return "All locations";
    const selectedLocation = ruleOptions.locations.find(
      (location) => location.id === form.locationId
    );
    return selectedLocation?.name ?? "Selected location";
  }, [form.locationId, ruleOptions.locations]);
  const getValidationError = useCallback((candidate: AdminCouponFormState) => {
    if (endDateEnabled && !candidate.validTill) {
      return { message: "End date is required.", tab: "basics" as const };
    }
    return validateForm(candidate);
  }, [endDateEnabled]);

  useEffect(() => {
    if (errorKind !== "validation" || !error) return;
    const validation = getValidationError(form);
    if (!validation || validation.message !== error) {
      setError(null);
      setErrorKind(null);
    }
  }, [error, errorKind, form, getValidationError]);

  const ensureRuleOptions = useCallback(async (include: CouponRuleOptionInclude[]) => {
    setOptionsLoading(true);
    try {
      const params = new URLSearchParams();
      include.forEach((item) => params.append("include", item));

      const res = await fetch(`/api/admin/coupons/options?${params.toString()}`);
      const json = (await res.json()) as {
        success: boolean;
        data?: Partial<CouponRuleOptions>;
      };

      if (!res.ok || !json.success || !json.data) {
        return undefined;
      }

      setRuleOptions((prev) => mergeRuleOptions(prev, json.data ?? {}));
      return json.data ?? {};
    } catch {
      // non-blocking
      return undefined;
    } finally {
      setOptionsLoading(false);
    }
  }, []);

  const loadCoupon = useCallback(async (id: string) => {
    const reqId = ++loadReqRef.current;
    setLoading(true);
    setError(null);
    setErrorKind(null);
    setForm(createEmptyCouponForm());

    try {
      const res = await fetch(`/api/admin/coupons/${id}`);
      const json: CouponDetailsResponse = await res.json();

      if (reqId !== loadReqRef.current) return;

      if (!res.ok || !json.success || !json.data) {
        throw new Error(json.message ?? "Failed to load coupon");
      }

      setForm({
        ...json.data,
        stackableCouponIds: (json.data.stackableCouponIds ?? []).filter(
          (selectedCouponId) => selectedCouponId !== json.data?.id
        ),
        validFrom: toDateTimeLocalInput(json.data.validFrom),
        validTill: json.data.validTill ? toDateTimeLocalInput(json.data.validTill) : null,
        rules: (json.data.rules ?? []).map((rule) => normalizeRuleFromApi(rule)),
      });
      setEndDateEnabled(Boolean(json.data.validTill));
      setInitialRuleSignature(
        JSON.stringify(
          (json.data.rules ?? []).map((rule) => normalizeRuleFromApi(rule))
        )
      );
      setEditorInstanceKey((prev) => prev + 1);
    } catch (loadError) {
      if (reqId !== loadReqRef.current) return;
      const message = loadError instanceof Error ? loadError.message : "Failed to load coupon";
      setError(message);
      setErrorKind("request");
    } finally {
      if (reqId === loadReqRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (!open) return;

    setEditorInstanceKey((prev) => prev + 1);
    setError(null);
    setErrorKind(null);
    void ensureRuleOptions(["locations", "theatres", "slotDurations"]);

    if (mode === "create") {
      setForm(createEmptyCouponForm());
      setEndDateEnabled(false);
      setInitialRuleSignature("[]");
      return;
    }

    if (couponId) {
      void loadCoupon(couponId);
    }
  }, [couponId, ensureRuleOptions, loadCoupon, mode, open]);

  function patchForm(patch: Partial<AdminCouponFormState>) {
    setForm((prev) => ({ ...prev, ...patch }));
  }

  function updateRule(index: number, rule: CouponRuleFormState) {
    setForm((prev) => {
      const next = [...prev.rules];
      next[index] = rule;
      return { ...prev, rules: next };
    });
  }

  function addRule(type: CouponRuleType = "THEATRE_ID") {
    const meta = getRuleMeta(type);
    const nextRule: CouponRuleFormState = {
      type,
      operator: meta.operators[0],
      value: getDefaultRuleValue(meta.valueKind),
    };

    setForm((prev) => ({ ...prev, rules: [...prev.rules, nextRule] }));
  }

  function removeRule(index: number) {
    setForm((prev) => ({
      ...prev,
      rules: prev.rules.filter((_, i) => i !== index),
    }));
  }

  async function handleSave(nextForm?: AdminCouponFormState) {
    const rawCandidate = nextForm ?? form;
    const candidate = endDateEnabled ? rawCandidate : { ...rawCandidate, validTill: null };
    const validation = getValidationError(candidate);
    if (validation) {
      setError(validation.message);
      setErrorKind("validation");
      return;
    }

    setSaving(true);
    setError(null);
    setErrorKind(null);

    const payload = serializeForm(candidate);
    const url = isEdit ? `/api/admin/coupons/${couponId}` : "/api/admin/coupons";
    const method = isEdit ? "PUT" : "POST";

    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json: { success: boolean; message?: string; couponId?: string } = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.message ?? "Failed to save coupon");
      }

      const savedRuleLabels = Array.from(
        new Set(candidate.rules.map((rule) => getRuleMeta(rule.type).label))
      );
      const nextRuleSignature = JSON.stringify(candidate.rules);
      const rulesChanged = !isEdit || nextRuleSignature !== initialRuleSignature;
      const actionLabel = isEdit ? "updated" : "created";
      const successMessage =
        isEdit && !rulesChanged
          ? "Coupon updated successfully."
          : candidate.rules.length === 0
          ? `Coupon ${actionLabel} successfully.`
          : savedRuleLabels.length === 1
          ? `Coupon ${actionLabel} with ${savedRuleLabels[0]} rule.`
          : `Coupon ${actionLabel} with ${candidate.rules.length} rules (${savedRuleLabels
              .slice(0, 2)
              .join(", ")}${savedRuleLabels.length > 2 ? ", ..." : ""}).`;

      invalidateCouponRuleOptionsCache();
      toast.success(successMessage);
      onSaved();
      if (isEdit && couponId) {
        await loadCoupon(couponId);
        return;
      }
      onClose();
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : "Failed to save coupon";
      setError(message);
      setErrorKind("request");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminDrawer
      open={open}
      onClose={onClose}
      title={drawerTitle}
      description={undefined}
      width={950}
    >
      {loading ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
          Loading coupon details...
        </div>
      ) : (
        <div className="flex h-full min-h-0 flex-col">
          <div className="flex-1 overflow-y-auto pr-1 pt-1 pb-4">
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_380px]">
              <div className="min-w-0 space-y-4">
        <BasicsTab
          key={`basics-${editorInstanceKey}`}
          form={form}
          patchForm={patchForm}
          options={ruleOptions}
          currentCouponId={couponId}
          ensureRuleOptions={ensureRuleOptions}
          optionsLoading={optionsLoading}
        />
        <RulesTab
          key={`rules-${editorInstanceKey}`}
          form={form}
                  patchForm={patchForm}
                  addRule={addRule}
          removeRule={removeRule}
          updateRule={updateRule}
          options={ruleOptions}
          ensureRuleOptions={ensureRuleOptions}
        />
                <ActiveDatesSection
                  form={form}
                  patchForm={patchForm}
                  endDateEnabled={endDateEnabled}
                  onEndDateEnabledChange={setEndDateEnabled}
                />
              </div>

              <aside className="min-w-0 xl:sticky xl:top-0 xl:self-start">
                <PreviewTab
                  form={form}
                  locationName={previewLocationName}
                  endDateEnabled={endDateEnabled}
                />
              </aside>
            </div>
          </div>

          {optionsLoading && (
            <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
              Loading selector options...
            </div>
          )}

          {error && (
            <div className="mt-4">
              <div className="inline-flex w-fit max-w-full rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            </div>
          )}

          <div className="border-t border-slate-200 pt-4">
            <div className="flex w-full items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="cursor-pointer whitespace-nowrap rounded-md border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={saving}
                className="cursor-pointer whitespace-nowrap rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? "Saving..." : isEdit ? "Save Changes" : "Create Coupon"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminDrawer>
  );
}
