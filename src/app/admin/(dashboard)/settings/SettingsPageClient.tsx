"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import PageHeader from "@/components/admin/page/PageHeader";
import { toast } from "sonner";
import { InfoTooltipButton } from "@/components/admin/coupons/drawer/fields";
import AdminEmptyState from "@/components/admin/shared/AdminEmptyState";
import { Plus, Settings } from "@/components/icons";
import { ToggleSwitch } from "@/components/ui/ToggleSwitch";
import {
  APP_SETTING_META,
  normalizeAppSettingValue,
  sortAppSettings,
  type SettingMeta,
  validateAppSetting,
  type AppSettingItem,
} from "@/lib/app-settings";
import {
  getDefaultHomeCouponWidgetSettings,
  HOME_COUPON_DRAWER_CONFIG_KEY,
  HOME_COUPON_STRIP_CONFIG_KEY,
  sanitizeHomeCouponWidgetSettings,
  type HomeCouponWidgetSettingsPayload,
} from "@/lib/coupon-widget-settings";
import {
  DEFAULT_SLOT_EXPIRY_MODE,
  SLOT_EXPIRY_GRACE_MINUTES_KEY,
  SLOT_EXPIRY_MODE_KEY,
} from "@/lib/slot-time";

type SettingsResponse = {
  success: boolean;
  message?: string;
  data?: AppSettingItem[];
};

type CouponWidgetSettingsResponse = {
  success: boolean;
  message?: string;
  data?: HomeCouponWidgetSettingsPayload;
};

function toMap(items: AppSettingItem[]) {
  return Object.fromEntries(items.map((item) => [item.key, item.value]));
}

const SLOT_EXPIRY_MODE_GRACE_VALUE = "START_TIME_WITH_GRACE";
const HIDDEN_APP_SETTING_KEYS = new Set([
  HOME_COUPON_DRAWER_CONFIG_KEY,
  HOME_COUPON_STRIP_CONFIG_KEY,
]);

function shouldShowSetting(
  item: AppSettingItem,
  draftMap: Record<string, string>
) {
  if (item.key !== SLOT_EXPIRY_GRACE_MINUTES_KEY) return true;
  const mode = draftMap[SLOT_EXPIRY_MODE_KEY] ?? DEFAULT_SLOT_EXPIRY_MODE;
  return mode === SLOT_EXPIRY_MODE_GRACE_VALUE;
}

function shouldValidateSetting(
  item: AppSettingItem,
  draftMap: Record<string, string>
) {
  if (item.key !== SLOT_EXPIRY_GRACE_MINUTES_KEY) return true;
  return shouldShowSetting(item, draftMap);
}

function getSettingInfoContent(key: string, meta?: SettingMeta) {
  if (meta?.description) return meta.description;
  return `Setting key: ${key}`;
}

function cloneCouponWidgetSettings(payload: HomeCouponWidgetSettingsPayload) {
  return JSON.parse(JSON.stringify(payload)) as HomeCouponWidgetSettingsPayload;
}

function makeDefaultCouponItem(index: number) {
  const stamp = `${Date.now()}_${Math.trunc(Math.random() * 100000)}`;
  return {
    id: `coupon_${stamp}`,
    code: "",
    description: "",
    badge: "",
    terms: "",
    isActive: true,
    sortOrder: index,
  };
}

function formatNumberForInput(value: number) {
  const safe = Number.isFinite(value) ? Math.max(0, value) : 0;
  const plain = safe.toString();
  if (!plain.includes("e") && !plain.includes("E")) return plain;

  const fixed = safe
    .toLocaleString("en-US", { useGrouping: false, maximumFractionDigits: 8 })
    .replace(/\.?0+$/, "");

  return fixed || "0";
}

const SETTINGS_FIELD_BASE_CLASS =
  "w-full rounded-md border bg-slate-50 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 hover:border-slate-400 focus:bg-white";

const SETTINGS_FIELD_CLASS = `${SETTINGS_FIELD_BASE_CLASS} mt-1 h-10 px-3`;
const SETTINGS_SMALL_FIELD_CLASS = `${SETTINGS_FIELD_BASE_CLASS} mt-1 h-9 px-2.5`;
const SETTINGS_TOGGLE_ROW_CLASS =
  "mt-1 flex items-center justify-between rounded-md border border-slate-300 bg-slate-50";

export default function SettingsPageClient() {
  const [settings, setSettings] = useState<AppSettingItem[]>([]);
  const [draftMap, setDraftMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAdvanceConfirm, setShowAdvanceConfirm] = useState(false);
  const [pendingPayload, setPendingPayload] = useState<AppSettingItem[] | null>(
    null
  );

  const defaultCouponWidgetSettings = useMemo(
    () => getDefaultHomeCouponWidgetSettings(),
    []
  );
  const [couponWidgetSettings, setCouponWidgetSettings] =
    useState<HomeCouponWidgetSettingsPayload>(() =>
      cloneCouponWidgetSettings(defaultCouponWidgetSettings)
    );
  const [couponWidgetDraft, setCouponWidgetDraft] =
    useState<HomeCouponWidgetSettingsPayload>(() =>
      cloneCouponWidgetSettings(defaultCouponWidgetSettings)
    );
  const [couponWidgetLoading, setCouponWidgetLoading] = useState(true);
  const [couponWidgetSaving, setCouponWidgetSaving] = useState(false);
  const [couponWidgetError, setCouponWidgetError] = useState<string | null>(null);
  const [activeCouponWidgetTab, setActiveCouponWidgetTab] = useState<
    "drawer" | "strip"
  >("drawer");
  const drawerCouponsListRef = useRef<HTMLDivElement | null>(null);

  async function fetchSettings() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/settings", {
        cache: "no-store",
      });
      const json = (await res.json()) as SettingsResponse;

      if (!res.ok || !json.success || !json.data) {
        throw new Error(json.message ?? "Failed to load settings.");
      }

      setSettings(json.data);
      setDraftMap(toMap(json.data));
    } catch (fetchError) {
      const message =
        fetchError instanceof Error
          ? fetchError.message
          : "Failed to load settings.";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  async function fetchCouponWidgetSettings() {
    setCouponWidgetLoading(true);
    setCouponWidgetError(null);

    try {
      const res = await fetch("/api/admin/settings/coupon-widgets", {
        cache: "no-store",
      });
      const json = (await res.json()) as CouponWidgetSettingsResponse;

      if (!res.ok || !json.success || !json.data) {
        throw new Error(json.message ?? "Failed to load coupon widget settings.");
      }

      const safe = sanitizeHomeCouponWidgetSettings(json.data);
      setCouponWidgetSettings(safe);
      setCouponWidgetDraft(cloneCouponWidgetSettings(safe));
    } catch (fetchError) {
      const message =
        fetchError instanceof Error
          ? fetchError.message
          : "Failed to load coupon widget settings.";
      setCouponWidgetError(message);
      toast.error(message);
    } finally {
      setCouponWidgetLoading(false);
    }
  }

  useEffect(() => {
    void Promise.all([fetchSettings(), fetchCouponWidgetSettings()]);
  }, []);

  const orderedSettings = useMemo(() => {
    return sortAppSettings(settings).filter(
      (item) => !HIDDEN_APP_SETTING_KEYS.has(item.key)
    );
  }, [settings]);

  const visibleSettings = useMemo(
    () => orderedSettings.filter((item) => shouldShowSetting(item, draftMap)),
    [orderedSettings, draftMap]
  );

  const validationErrors = useMemo(() => {
    const next: Record<string, string> = {};
    for (const item of orderedSettings) {
      if (!shouldValidateSetting(item, draftMap)) continue;
      const error = validateAppSetting(item.key, draftMap[item.key] ?? "");
      if (error) next[item.key] = error;
    }
    return next;
  }, [orderedSettings, draftMap]);

  const hasChanges = useMemo(() => {
    const currentMap = toMap(settings);
    return orderedSettings.some(
      (item) => (currentMap[item.key] ?? "") !== (draftMap[item.key] ?? "")
    );
  }, [orderedSettings, settings, draftMap]);

  const couponWidgetHasChanges = useMemo(() => {
    const current = JSON.stringify(
      sanitizeHomeCouponWidgetSettings(couponWidgetSettings)
    );
    const draft = JSON.stringify(sanitizeHomeCouponWidgetSettings(couponWidgetDraft));
    return current !== draft;
  }, [couponWidgetSettings, couponWidgetDraft]);

  const isDrawerVisible = couponWidgetDraft.drawer.status === "on";
  const isStripVisible = couponWidgetDraft.strip.status === "on";
  const dismissForHoursInputValue = formatNumberForInput(
    couponWidgetDraft.strip.dismissForHours
  );

  function updateDraft(key: string, value: string) {
    setDraftMap((prev) => ({
      ...prev,
      [key]: value,
    }));
  }

  function updateCouponWidgetDraft(
    updater: (current: HomeCouponWidgetSettingsPayload) => HomeCouponWidgetSettingsPayload
  ) {
    setCouponWidgetDraft((prev) => updater(cloneCouponWidgetSettings(prev)));
  }

  function handleAddDrawerCoupon() {
    updateCouponWidgetDraft((prev) => ({
      ...prev,
      drawer: {
        ...prev.drawer,
        coupons: [
          ...prev.drawer.coupons,
          makeDefaultCouponItem(prev.drawer.coupons.length + 1),
        ],
      },
    }));

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const list = drawerCouponsListRef.current;
        if (!list) return;
        list.scrollTo({
          top: list.scrollHeight,
          behavior: "smooth",
        });
      });
    });
  }

  async function submitSettings(payload: AppSettingItem[]) {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ settings: payload }),
      });
      const json = (await res.json()) as SettingsResponse;

      if (!res.ok || !json.success || !json.data) {
        throw new Error(json.message ?? "Failed to update settings.");
      }

      setSettings(json.data);
      setDraftMap(toMap(json.data));
      toast.success("Settings updated successfully.");
    } catch (saveError) {
      const message =
        saveError instanceof Error
          ? saveError.message
          : "Failed to update settings.";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  async function submitCouponWidgetSettings(payload: HomeCouponWidgetSettingsPayload) {
    setCouponWidgetSaving(true);
    try {
      const res = await fetch("/api/admin/settings/coupon-widgets", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      const json = (await res.json()) as CouponWidgetSettingsResponse;

      if (!res.ok || !json.success || !json.data) {
        throw new Error(json.message ?? "Failed to update coupon widget settings.");
      }

      const safe = sanitizeHomeCouponWidgetSettings(json.data);
      setCouponWidgetSettings(safe);
      setCouponWidgetDraft(cloneCouponWidgetSettings(safe));
      toast.success("Coupon widget settings updated successfully.");
    } catch (saveError) {
      const message =
        saveError instanceof Error
          ? saveError.message
          : "Failed to update coupon widget settings.";
      toast.error(message);
    } finally {
      setCouponWidgetSaving(false);
    }
  }

  async function saveSettings() {
    if (!hasChanges) {
      toast.message("No changes to save.");
      return;
    }

    const payload: AppSettingItem[] = orderedSettings.map((item) => ({
      key: item.key,
      value: normalizeAppSettingValue(item.key, draftMap[item.key] ?? ""),
    }));

    const invalidItem = payload.find((item) =>
      Boolean(validateAppSetting(item.key, item.value))
    );
    if (invalidItem) {
      const validationError = validateAppSetting(invalidItem.key, invalidItem.value);
      toast.error(validationError ?? "Please fix validation errors before saving.");
      return;
    }

    const currentMap = toMap(settings);
    const advanceChanged =
      (currentMap.ADVANCE_PAYMENT_AMOUNT ?? "") !==
      (payload.find((item) => item.key === "ADVANCE_PAYMENT_AMOUNT")?.value ?? "");

    if (advanceChanged) {
      setPendingPayload(payload);
      setShowAdvanceConfirm(true);
      return;
    }

    await submitSettings(payload);
  }

  async function saveCouponWidgets() {
    if (!couponWidgetHasChanges) {
      toast.message("No coupon widget changes to save.");
      return;
    }

    const safePayload = sanitizeHomeCouponWidgetSettings(couponWidgetDraft);
    await submitCouponWidgetSettings(safePayload);
  }

  function cancelAdvanceConfirm() {
    setShowAdvanceConfirm(false);
    setPendingPayload(null);
  }

  function confirmAdvanceConfirm() {
    if (!pendingPayload) {
      setShowAdvanceConfirm(false);
      return;
    }

    const payload = pendingPayload;
    setShowAdvanceConfirm(false);
    setPendingPayload(null);
    void submitSettings(payload);
  }

  return (
    <>
      <PageHeader
        title="Settings"
        description="Configure global application settings used by booking and payment flows."
      />

      <section className="mt-6 rounded-xl border border-neutral-200 bg-white p-4 sm:p-5">
        <div className="mb-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">App Settings</h2>
          </div>
        </div>

        {loading ? (
          <div className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50 p-5 text-sm text-neutral-600">
            Loading settings...
          </div>
        ) : error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-5 text-sm text-red-700">
            {error}
          </div>
        ) : orderedSettings.length === 0 ? (
          <AdminEmptyState
            className="mt-0"
            title="No settings found"
            description="No app settings are available right now. Please retry after initialization."
            icon={<Settings size={18} />}
          />
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              {visibleSettings.map((item) => {
                const meta = APP_SETTING_META[item.key];
                const value = draftMap[item.key] ?? "";
                const inputType = meta?.type ?? "text";
                const validationError = validationErrors[item.key];

                return (
                  <div
                    key={item.key}
                    className="rounded-lg border border-neutral-200 bg-white p-4"
                  >
                    <div className="mb-2 flex items-center gap-1.5">
                      <p className="text-sm font-medium text-slate-900">
                        {meta?.label ?? item.key}
                      </p>
                      <InfoTooltipButton
                        label={meta?.label ?? item.key}
                        content={getSettingInfoContent(item.key, meta)}
                      />
                    </div>

                    {!meta && (
                      <p className="mb-2 inline-flex rounded bg-neutral-100 px-2 py-1 font-mono text-[11px] text-neutral-700">
                        {item.key}
                      </p>
                    )}

                    {inputType === "select" ? (
                      <select
                        value={value}
                        onChange={(e) => updateDraft(item.key, e.target.value)}
                        className={`${SETTINGS_FIELD_CLASS} ${validationError ? "border-red-300 focus:border-red-400 focus:ring-2 focus:ring-red-100" : "border-slate-300 focus:border-slate-500 focus:ring-2 focus:ring-slate-200"}`}
                      >
                        {(meta?.options ?? []).map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        value={value}
                        onChange={(e) => {
                          const nextValue =
                            inputType === "number"
                              ? e.target.value.replace(/\D+/g, "")
                              : e.target.value;
                          updateDraft(item.key, nextValue);
                        }}
                        type={inputType}
                        placeholder={meta?.placeholder}
                        min={inputType === "number" ? meta?.min : undefined}
                        max={inputType === "number" ? meta?.max : undefined}
                        step={inputType === "number" ? meta?.step ?? 1 : undefined}
                        className={`${SETTINGS_FIELD_CLASS} ${validationError ? "border-red-300 focus:border-red-400 focus:ring-2 focus:ring-red-100" : "border-slate-300 focus:border-slate-500 focus:ring-2 focus:ring-slate-200"}`}
                      />
                    )}
                    {validationError ? (
                      <p className="mt-1 text-xs text-red-600">{validationError}</p>
                    ) : null}
                  </div>
                );
              })}
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-end gap-2 border-t border-neutral-200 pt-4">
              <button
                type="button"
                onClick={() => void saveSettings()}
                disabled={!hasChanges || saving || Object.keys(validationErrors).length > 0}
                className="cursor-pointer rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </>
        )}
      </section>

      <section className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-1.5">
              <h2 className="text-base font-semibold text-slate-900">Coupon Widgets</h2>
              <InfoTooltipButton
                label="Coupon Widgets"
                content="Manage visibility, copy, positions, and coupon list for home page coupon widgets."
              />
            </div>
          </div>
        </div>

        {couponWidgetLoading ? (
          <div className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50 p-5 text-sm text-neutral-600">
            Loading coupon widget settings...
          </div>
        ) : couponWidgetError ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-5 text-sm text-red-700">
            {couponWidgetError}
          </div>
        ) : (
          <>
            <div className="space-y-4">
              <div className="border-b border-slate-200 -mx-4 px-4 sm:-mx-5 sm:px-5">
                <div className="grid grid-cols-2 gap-1">
                  {[
                    {
                      key: "drawer" as const,
                      label: "Floating Widget",
                    },
                    {
                      key: "strip" as const,
                      label: "Coupon Strip",
                    },
                  ].map((tab) => {
                    const isActive = activeCouponWidgetTab === tab.key;
                    return (
                      <button
                        key={tab.key}
                        type="button"
                        onClick={() => setActiveCouponWidgetTab(tab.key)}
                        className={`relative min-w-0 cursor-pointer px-2 py-2.5 text-center text-xs font-medium transition-colors sm:px-4 sm:text-sm ${
                          isActive
                            ? "text-slate-900"
                            : "text-slate-500 hover:text-slate-700"
                        }`}
                      >
                        {isActive ? (
                          <motion.div
                            layoutId="couponWidgetsActiveTab"
                            className="absolute inset-0 -mx-px border-b-2 border-black"
                            transition={{ type: "spring", stiffness: 500, damping: 30 }}
                          />
                        ) : null}
                        <span className="relative block whitespace-normal leading-tight">
                          {tab.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <AnimatePresence mode="wait">
              {activeCouponWidgetTab === "drawer" ? (
              <motion.div
                key="drawer"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="rounded-xl border border-slate-300 bg-white p-4 shadow-sm"
              >
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h3 className="text-sm font-semibold text-slate-900">
                        Floating Widget
                      </h3>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center justify-end gap-2">
                    <span
                      className={`inline-flex text-xs font-medium ${
                        isDrawerVisible ? "text-emerald-700" : "text-slate-500"
                      }`}
                    >
                      {isDrawerVisible ? "Active" : "Disabled"}
                    </span>
                    <ToggleSwitch
                      checked={isDrawerVisible}
                      onChange={(checked) =>
                        updateCouponWidgetDraft((prev) => ({
                          ...prev,
                          drawer: {
                            ...prev.drawer,
                            status: checked ? "on" : "off",
                          },
                        }))
                      }
                    />
                    <InfoTooltipButton
                      label="Floating Widget Visibility"
                      content="Turns the floating coupon widget on or off for home page visitors."
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <label className="text-sm text-slate-700 md:col-span-3">
                    <span className="mb-1 flex items-center gap-1.5">
                      <span>Title</span>
                      <InfoTooltipButton
                        label="Title"
                        content="Main heading shown at the top of the floating coupon panel."
                      />
                    </span>
                    <input
                      value={couponWidgetDraft.drawer.title}
                      onChange={(e) =>
                        updateCouponWidgetDraft((prev) => ({
                          ...prev,
                          drawer: {
                            ...prev.drawer,
                            title: e.target.value,
                          },
                        }))
                      }
                      className={`${SETTINGS_FIELD_CLASS} border-slate-300 focus:border-slate-500 focus:ring-2 focus:ring-slate-200`}
                      placeholder="Available Coupons"
                    />
                  </label>

                  <label className="text-sm text-slate-700 md:col-span-3">
                    <span className="mb-1 flex items-center gap-1.5">
                      <span>Subtitle</span>
                      <InfoTooltipButton
                        label="Subtitle"
                        content="Short supporting text shown below the title in the coupon panel."
                      />
                    </span>
                    <input
                      value={couponWidgetDraft.drawer.subtitle}
                      onChange={(e) =>
                        updateCouponWidgetDraft((prev) => ({
                          ...prev,
                          drawer: {
                            ...prev.drawer,
                            subtitle: e.target.value,
                          },
                        }))
                      }
                      className={`${SETTINGS_FIELD_CLASS} border-slate-300 focus:border-slate-500 focus:ring-2 focus:ring-slate-200`}
                      placeholder="Copy and save instantly"
                    />
                  </label>

                  <label className="text-sm text-slate-700">
                    <span className="mb-1 flex items-center gap-1.5">
                      <span>Desktop Position</span>
                      <InfoTooltipButton
                        label="Desktop Position"
                        content="Controls where the floating coupon trigger appears on desktop screens."
                      />
                    </span>
                    <select
                      value={couponWidgetDraft.drawer.desktopPosition}
                      onChange={(e) =>
                        updateCouponWidgetDraft((prev) => ({
                          ...prev,
                          drawer: {
                            ...prev.drawer,
                            desktopPosition: e.target.value as "left" | "right",
                          },
                        }))
                      }
                      className={`${SETTINGS_FIELD_CLASS} border-slate-300 focus:border-slate-500 focus:ring-2 focus:ring-slate-200`}
                    >
                      <option value="right">Right</option>
                      <option value="left">Left</option>
                    </select>
                  </label>

                  <label className="text-sm text-slate-700">
                    <span className="mb-1 flex items-center gap-1.5">
                      <span>Mobile Button Position</span>
                      <InfoTooltipButton
                        label="Mobile Button Position"
                        content="Controls whether the floating coupon button appears at bottom-left or bottom-right on mobile."
                      />
                    </span>
                    <select
                      value={couponWidgetDraft.drawer.mobilePosition}
                      onChange={(e) =>
                        updateCouponWidgetDraft((prev) => ({
                          ...prev,
                          drawer: {
                            ...prev.drawer,
                            mobilePosition: e.target.value as
                              | "bottom-left"
                              | "bottom-right",
                          },
                        }))
                      }
                      className={`${SETTINGS_FIELD_CLASS} border-slate-300 focus:border-slate-500 focus:ring-2 focus:ring-slate-200`}
                    >
                      <option value="bottom-right">Bottom Right</option>
                      <option value="bottom-left">Bottom Left</option>
                    </select>
                  </label>

                  <label className="text-sm text-slate-700">
                    <span className="mb-1 flex items-center gap-1.5">
                      <span>Trigger Button Name</span>
                      <InfoTooltipButton
                        label="Trigger Button Name"
                        content="Text shown on the floating coupon button users tap to open the coupon drawer."
                      />
                    </span>
                    <input
                      value={couponWidgetDraft.drawer.triggerLabel}
                      onChange={(e) =>
                        updateCouponWidgetDraft((prev) => ({
                          ...prev,
                          drawer: {
                            ...prev.drawer,
                            triggerLabel: e.target.value,
                          },
                        }))
                      }
                      className={`${SETTINGS_FIELD_CLASS} border-slate-300 focus:border-slate-500 focus:ring-2 focus:ring-slate-200`}
                      placeholder="View Coupons"
                    />
                  </label>
                </div>

                <div className="mt-4 rounded-lg border border-slate-300 bg-slate-100 p-3">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <h4 className="text-sm font-semibold text-slate-900">Coupons List</h4>
                      <span className="shrink-0 rounded bg-white px-2 py-1 text-xs text-slate-600">
                        {couponWidgetDraft.drawer.coupons.length}
                      </span>
                    </div>
                    <div className="flex shrink-0 items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={handleAddDrawerCoupon}
                        className="inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-slate-800 active:scale-[0.98]"
                      >
                        <Plus size={12} />
                        Add More
                      </button>
                    </div>
                  </div>

                  <div
                    ref={drawerCouponsListRef}
                    className="space-y-2 max-h-[420px] overflow-y-auto overscroll-contain pr-1 [webkit-overflow-scrolling:touch]"
                  >
                    {couponWidgetDraft.drawer.coupons.map((coupon, index) => (
                      <div
                        key={coupon.id || `${index}`}
                        className="rounded-md border border-slate-200 bg-white p-4 sm:p-5"
                      >
                        <div className="mb-2 grid grid-cols-1 gap-2 md:grid-cols-4">
                          <label className="text-xs text-slate-700">
                            <span className="mb-1 flex items-center gap-1">
                              <span className="text-xs text-slate-700">{index + 1}.</span>
                              <span>Coupon Code</span>
                              <InfoTooltipButton
                                label="Coupon Code"
                                content="Promo code customers can copy and apply during booking."
                              />
                            </span>
                            <input
                              value={coupon.code}
                              onChange={(e) =>
                                updateCouponWidgetDraft((prev) => {
                                  const nextCoupons = prev.drawer.coupons.map((item, i) =>
                                    i === index
                                      ? {
                                          ...item,
                                          code: e.target.value,
                                        }
                                      : item
                                  );
                                  return {
                                    ...prev,
                                    drawer: {
                                      ...prev.drawer,
                                      coupons: nextCoupons,
                                    },
                                  };
                                })
                              }
                              className={`${SETTINGS_SMALL_FIELD_CLASS} border-slate-300 focus:border-slate-500 focus:ring-2 focus:ring-slate-200`}
                            />
                          </label>

                          <label className="text-xs text-slate-700">
                            <span className="mb-1 flex items-center gap-1">
                              <span>Badge</span>
                              <InfoTooltipButton
                                label="Badge"
                                content="Small highlight label such as 50% OFF, NEW USER, or WEEKDAY."
                              />
                            </span>
                            <input
                              value={coupon.badge}
                              onChange={(e) =>
                                updateCouponWidgetDraft((prev) => {
                                  const nextCoupons = prev.drawer.coupons.map((item, i) =>
                                    i === index
                                      ? {
                                          ...item,
                                          badge: e.target.value,
                                        }
                                      : item
                                  );
                                  return {
                                    ...prev,
                                    drawer: {
                                      ...prev.drawer,
                                      coupons: nextCoupons,
                                    },
                                  };
                                })
                              }
                              className={`${SETTINGS_SMALL_FIELD_CLASS} border-slate-300 focus:border-slate-500 focus:ring-2 focus:ring-slate-200`}
                            />
                          </label>

                          <label className="text-xs text-slate-700">
                            <span className="mb-1 flex items-center gap-1">
                              <span>Sort Order</span>
                              <InfoTooltipButton
                                label="Sort Order"
                                content="Lower numbers appear first in the coupon list."
                              />
                            </span>
                            <input
                              type="number"
                              value={coupon.sortOrder ?? index + 1}
                              onChange={(e) =>
                                updateCouponWidgetDraft((prev) => {
                                  const nextCoupons = prev.drawer.coupons.map((item, i) =>
                                    i === index
                                      ? {
                                          ...item,
                                          sortOrder: Number(e.target.value) || 0,
                                        }
                                      : item
                                  );
                                  return {
                                    ...prev,
                                    drawer: {
                                      ...prev.drawer,
                                      coupons: nextCoupons,
                                    },
                                  };
                                })
                              }
                              className={`${SETTINGS_SMALL_FIELD_CLASS} border-slate-300 focus:border-slate-500 focus:ring-2 focus:ring-slate-200`}
                            />
                          </label>

                          <div className="text-xs text-slate-700">
                            <span className="mb-1 flex items-center gap-1">
                              <span>{coupon.isActive !== false ? "Active" : "Hidden"}</span>
                              <InfoTooltipButton
                                label="Coupon Active"
                                content="Inactive coupons stay saved but are not shown to customers."
                              />
                            </span>
                            <div className={`${SETTINGS_TOGGLE_ROW_CLASS} h-9 px-2.5`}>
                              <span className="text-xs text-slate-500">
                                {coupon.isActive !== false ? "On" : "Off"}
                              </span>
                              <ToggleSwitch
                                checked={coupon.isActive !== false}
                                onChange={(checked) =>
                                  updateCouponWidgetDraft((prev) => {
                                    const nextCoupons = prev.drawer.coupons.map((item, i) =>
                                      i === index
                                        ? {
                                            ...item,
                                            isActive: checked,
                                          }
                                        : item
                                    );
                                    return {
                                      ...prev,
                                      drawer: {
                                        ...prev.drawer,
                                        coupons: nextCoupons,
                                      },
                                    };
                                  })
                                }
                              />
                            </div>
                          </div>

                          <label className="text-xs text-slate-700 md:col-span-2">
                            <span className="mb-1 flex items-center gap-1">
                              <span>Description</span>
                              <InfoTooltipButton
                                label="Description"
                                content="Short explanation shown below the coupon code."
                              />
                            </span>
                            <input
                              value={coupon.description}
                              onChange={(e) =>
                                updateCouponWidgetDraft((prev) => {
                                  const nextCoupons = prev.drawer.coupons.map((item, i) =>
                                    i === index
                                      ? {
                                          ...item,
                                          description: e.target.value,
                                        }
                                      : item
                                  );
                                  return {
                                    ...prev,
                                    drawer: {
                                      ...prev.drawer,
                                      coupons: nextCoupons,
                                    },
                                  };
                                })
                              }
                              className={`${SETTINGS_SMALL_FIELD_CLASS} border-slate-300 focus:border-slate-500 focus:ring-2 focus:ring-slate-200`}
                            />
                          </label>

                          <label className="text-xs text-slate-700 md:col-span-2">
                            <span className="mb-1 flex items-center gap-1">
                              <span>Terms</span>
                              <InfoTooltipButton
                                label="Terms"
                                content="Optional terms displayed to customers in the coupon card."
                              />
                            </span>
                            <input
                              value={coupon.terms ?? ""}
                              onChange={(e) =>
                                updateCouponWidgetDraft((prev) => {
                                  const nextCoupons = prev.drawer.coupons.map((item, i) =>
                                    i === index
                                      ? {
                                          ...item,
                                          terms: e.target.value,
                                        }
                                      : item
                                  );
                                  return {
                                    ...prev,
                                    drawer: {
                                      ...prev.drawer,
                                      coupons: nextCoupons,
                                    },
                                  };
                                })
                              }
                              className={`${SETTINGS_SMALL_FIELD_CLASS} border-slate-300 focus:border-slate-500 focus:ring-2 focus:ring-slate-200`}
                            />
                          </label>
                        </div>

                        <div className="flex justify-end">
                          <button
                            type="button"
                            onClick={() =>
                              updateCouponWidgetDraft((prev) => ({
                                ...prev,
                                drawer: {
                                  ...prev.drawer,
                                  coupons: prev.drawer.coupons.filter((_, i) => i !== index),
                                },
                              }))
                            }
                            className="rounded-md border border-red-200 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-50"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
              ) : null}

              {activeCouponWidgetTab === "strip" ? (
              <motion.div
                key="strip"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="rounded-xl border border-slate-300 bg-white p-4 shadow-sm"
              >
                <div className="mb-3 flex items-start justify-between gap-3">
                  <h3 className="min-w-0 text-sm font-semibold text-slate-900">Coupon Strip</h3>
                  <div className="flex shrink-0 items-center justify-end gap-2">
                    <span
                      className={`inline-flex text-xs font-medium ${
                        isStripVisible ? "text-emerald-700" : "text-slate-500"
                      }`}
                    >
                      {isStripVisible ? "Active" : "Disabled"}
                    </span>
                    <ToggleSwitch
                      checked={isStripVisible}
                      onChange={(checked) =>
                        updateCouponWidgetDraft((prev) => ({
                          ...prev,
                          strip: {
                            ...prev.strip,
                            status: checked ? "on" : "off",
                          },
                        }))
                      }
                    />
                    <InfoTooltipButton
                      label="Coupon Strip Visibility"
                      content="Turns the coupon strip on or off on the home page."
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
                  <label className="text-sm text-slate-700">
                    <span className="mb-1 flex items-center gap-1.5">
                      <span>Coupon Code</span>
                      <InfoTooltipButton
                        label="Coupon Code"
                        content="Coupon code highlighted in the strip message."
                      />
                    </span>
                    <input
                      value={couponWidgetDraft.strip.couponCode}
                      onChange={(e) =>
                        updateCouponWidgetDraft((prev) => ({
                          ...prev,
                          strip: {
                            ...prev.strip,
                            couponCode: e.target.value,
                          },
                        }))
                      }
                      className={`${SETTINGS_FIELD_CLASS} border-slate-300 focus:border-slate-500 focus:ring-2 focus:ring-slate-200`}
                    />
                  </label>

                  <label className="text-sm text-slate-700">
                    <span className="mb-1 flex items-center gap-1.5">
                      <span>Button Name</span>
                      <InfoTooltipButton
                        label="Button Name"
                        content="CTA text shown on the strip button."
                      />
                    </span>
                    <input
                      value={couponWidgetDraft.strip.ctaLabel}
                      onChange={(e) =>
                        updateCouponWidgetDraft((prev) => ({
                          ...prev,
                          strip: {
                            ...prev.strip,
                            ctaLabel: e.target.value,
                          },
                        }))
                      }
                      className={`${SETTINGS_FIELD_CLASS} border-slate-300 focus:border-slate-500 focus:ring-2 focus:ring-slate-200`}
                    />
                  </label>

                  <label className="text-sm text-slate-700">
                    <span className="mb-1 flex items-center gap-1.5">
                      <span>Button Link</span>
                      <InfoTooltipButton
                        label="Button Link"
                        content="Path or URL where users are sent after tapping the strip button."
                      />
                    </span>
                    <input
                      value={couponWidgetDraft.strip.ctaHref}
                      onChange={(e) =>
                        updateCouponWidgetDraft((prev) => ({
                          ...prev,
                          strip: {
                            ...prev.strip,
                            ctaHref: e.target.value,
                          },
                        }))
                      }
                      className={`${SETTINGS_FIELD_CLASS} border-slate-300 focus:border-slate-500 focus:ring-2 focus:ring-slate-200`}
                    />
                  </label>

                  <div className="text-sm text-slate-700">
                    <span className="mb-1 flex items-center gap-1.5">
                      <span>Force Show</span>
                      <InfoTooltipButton
                        label="Force Show"
                        content="When enabled, strip is shown even if user previously dismissed it."
                      />
                    </span>
                    <div className={`${SETTINGS_TOGGLE_ROW_CLASS} h-10 px-3`}>
                      <span
                        className={`text-xs font-medium ${
                          couponWidgetDraft.strip.forceShow
                            ? "text-emerald-700"
                            : "text-slate-500"
                        }`}
                      >
                        {couponWidgetDraft.strip.forceShow ? "Active" : "Disabled"}
                      </span>
                      <ToggleSwitch
                        checked={couponWidgetDraft.strip.forceShow}
                        onChange={(checked) =>
                          updateCouponWidgetDraft((prev) => ({
                            ...prev,
                            strip: {
                              ...prev.strip,
                              forceShow: checked,
                            },
                          }))
                        }
                      />
                    </div>
                  </div>

                  <label className="text-sm text-slate-700">
                    <span className="mb-1 flex items-center gap-1.5">
                      <span>Strip Position</span>
                      <InfoTooltipButton
                        label="Strip Position"
                        content="Bottom strip is fixed at the bottom of the screen."
                      />
                    </span>
                    <select
                      value={couponWidgetDraft.strip.position}
                      onChange={(e) =>
                        updateCouponWidgetDraft((prev) => ({
                          ...prev,
                          strip: {
                            ...prev.strip,
                            position: e.target.value as "bottom",
                          },
                        }))
                      }
                      className={`${SETTINGS_FIELD_CLASS} border-slate-300 focus:border-slate-500 focus:ring-2 focus:ring-slate-200`}
                    >
                      <option value="bottom">Bottom</option>
                    </select>
                  </label>

                  <label className="text-sm text-slate-700">
                    <span className="mb-1 flex items-center gap-1.5">
                      <span>Strip Message &amp; Button Position</span>
                      <InfoTooltipButton
                        label="Strip Message & Button Position"
                        content="left: both message and button on left. right: both on right. center: both centered. space-between: message left, button right."
                      />
                    </span>
                    <select
                      value={couponWidgetDraft.strip.ctaPosition}
                      onChange={(e) =>
                        updateCouponWidgetDraft((prev) => ({
                          ...prev,
                          strip: {
                            ...prev.strip,
                            ctaPosition: e.target.value as
                              | "left"
                              | "center"
                              | "right"
                              | "space-between",
                          },
                        }))
                      }
                      className={`${SETTINGS_FIELD_CLASS} border-slate-300 focus:border-slate-500 focus:ring-2 focus:ring-slate-200`}
                    >
                      <option value="space-between">Space Between</option>
                      <option value="right">Right</option>
                      <option value="center">Center</option>
                      <option value="left">Left</option>
                    </select>
                  </label>

                  <label className="text-sm text-slate-700">
                    <span className="mb-1 flex items-center gap-1.5">
                      <span>Appear Delay (ms)</span>
                      <InfoTooltipButton
                        label="Appear Delay"
                        content="Delay before the strip appears after page load, in milliseconds."
                      />
                    </span>
                    <input
                      type="number"
                      value={couponWidgetDraft.strip.appearDelayMs}
                      onChange={(e) =>
                        updateCouponWidgetDraft((prev) => ({
                          ...prev,
                          strip: {
                            ...prev.strip,
                            appearDelayMs: Number(e.target.value) || 0,
                          },
                        }))
                      }
                      className={`${SETTINGS_FIELD_CLASS} border-slate-300 focus:border-slate-500 focus:ring-2 focus:ring-slate-200`}
                    />
                  </label>

                  <label className="text-sm text-slate-700">
                    <span className="mb-1 flex items-center gap-1.5">
                      <span>Dismiss For Hours</span>
                      <InfoTooltipButton
                        label="Dismiss For Hours"
                        content="If a user closes the strip, keep it hidden for this many hours. Example: 24."
                      />
                    </span>
                    <input
                      type="number"
                      min={0}
                      step="0.25"
                      inputMode="decimal"
                      value={dismissForHoursInputValue}
                      onChange={(e) =>
                        updateCouponWidgetDraft((prev) => ({
                          ...prev,
                          strip: {
                            ...prev.strip,
                            dismissForHours: Math.max(0, Number(e.target.value) || 0),
                          },
                        }))
                      }
                      className={`${SETTINGS_FIELD_CLASS} border-slate-300 focus:border-slate-500 focus:ring-2 focus:ring-slate-200`}
                    />
                  </label>

                  <label className="text-sm text-slate-700 md:col-span-2 lg:col-span-4">
                    <span className="mb-1 flex items-center gap-1.5">
                      <span>Strip Message</span>
                      <InfoTooltipButton
                        label="Strip Message"
                        content="Main promotional line shown in the strip before the coupon code."
                      />
                    </span>
                    <input
                      value={couponWidgetDraft.strip.message}
                      onChange={(e) =>
                        updateCouponWidgetDraft((prev) => ({
                          ...prev,
                          strip: {
                            ...prev.strip,
                            message: e.target.value,
                          },
                        }))
                      }
                      className={`${SETTINGS_FIELD_CLASS} border-slate-300 focus:border-slate-500 focus:ring-2 focus:ring-slate-200`}
                    />
                  </label>
                </div>
              </motion.div>
              ) : null}
              </AnimatePresence>
            </div>

            <div className="mt-5 flex items-center justify-end border-t border-neutral-200 pt-4">
              <button
                type="button"
                onClick={() => void saveCouponWidgets()}
                disabled={!couponWidgetHasChanges || couponWidgetSaving}
                className="cursor-pointer rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {couponWidgetSaving ? "Saving..." : "Save Coupon Widgets"}
              </button>
            </div>
          </>
        )}
      </section>

      {showAdvanceConfirm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="advance-confirm-title"
            className="w-full max-w-md rounded-xl border border-neutral-200 bg-white p-5 shadow-2xl"
          >
            <h3
              id="advance-confirm-title"
              className="text-base font-semibold text-slate-900"
            >
              Confirm Advance Amount Change
            </h3>
            <p className="mt-2 text-sm text-slate-600">
              You are changing the Advance Payment Amount. This affects the
              complete booking system and all new bookings will pay this
              advance amount. Are you sure you want to continue?
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={cancelAdvanceConfirm}
                className="cursor-pointer rounded-md border border-neutral-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmAdvanceConfirm}
                className="cursor-pointer rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
              >
                Yes, Continue
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
