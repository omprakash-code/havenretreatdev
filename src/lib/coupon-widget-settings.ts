import {
  HOME_AVAILABLE_COUPONS_WIDGET_CONFIG,
  HOME_COUPON_STRIP_CONFIG,
} from "@/components/widgets/config";
import type {
  AvailableCouponsWidgetProps,
  DrawerDesktopPosition,
  DrawerMobilePosition,
  HomeCoupon,
  HomeCouponStripProps,
  StripCtaPosition,
  StripPosition,
  WidgetStatus,
} from "@/components/widgets/types";

export const HOME_COUPON_DRAWER_CONFIG_KEY = "HOME_COUPON_DRAWER_CONFIG_JSON";
export const HOME_COUPON_STRIP_CONFIG_KEY = "HOME_COUPON_STRIP_CONFIG_JSON";

export type HomeCouponWidgetSettingsPayload = {
  drawer: Required<
    Pick<
      AvailableCouponsWidgetProps,
      | "status"
      | "triggerLabel"
      | "title"
      | "subtitle"
      | "desktopPosition"
      | "mobilePosition"
      | "isLoading"
    >
  > & {
    coupons: HomeCoupon[];
  };
  strip: Required<
    Pick<
      HomeCouponStripProps,
      | "status"
      | "message"
      | "couponCode"
      | "dismissForHours"
      | "forceShow"
      | "appearDelayMs"
      | "ctaLabel"
      | "ctaHref"
      | "position"
      | "ctaPosition"
    >
  >;
};

type SettingRow = {
  key: string;
  value: string;
};

function asString(value: unknown, fallback: string, maxLength = 200) {
  const next = String(value ?? "").trim();
  if (!next) return fallback;
  return next.slice(0, maxLength);
}

function asStatus(value: unknown, fallback: WidgetStatus): WidgetStatus {
  return value === "on" || value === "off" ? value : fallback;
}

function asDrawerDesktopPosition(
  value: unknown,
  fallback: DrawerDesktopPosition
): DrawerDesktopPosition {
  return value === "left" || value === "right" ? value : fallback;
}

function asDrawerMobilePosition(
  value: unknown,
  fallback: DrawerMobilePosition
): DrawerMobilePosition {
  return value === "bottom-left" || value === "bottom-right" ? value : fallback;
}

function asStripPosition(value: unknown, fallback: StripPosition): StripPosition {
  return value === "bottom" ? "bottom" : fallback;
}

function asStripCtaPosition(
  value: unknown,
  fallback: StripCtaPosition
): StripCtaPosition {
  return (
    value === "left" ||
    value === "center" ||
    value === "right" ||
    value === "space-between"
  )
    ? value
    : fallback;
}

function asBoolean(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

function asNumber(
  value: unknown,
  fallback: number,
  min: number,
  max: number
) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

function sanitizeCoupon(input: unknown, index: number): HomeCoupon | null {
  if (!input || typeof input !== "object") return null;
  const obj = input as Record<string, unknown>;
  const code = asString(obj.code, "").toUpperCase();
  if (!code) return null;
  const id = asString(obj.id, `coupon_${index + 1}`, 80);
  return {
    id,
    code: code.slice(0, 40),
    description: asString(obj.description, "", 200),
    badge: asString(obj.badge, "", 60),
    terms: asString(obj.terms, "", 240),
    isActive: asBoolean(obj.isActive, true),
    sortOrder: Math.trunc(asNumber(obj.sortOrder, index + 1, 0, 9999)),
  };
}

function sanitizeCoupons(input: unknown, fallback: HomeCoupon[]) {
  if (!Array.isArray(input)) {
    return fallback.map((coupon) => ({ ...coupon }));
  }

  return input
    .map((item, index) => sanitizeCoupon(item, index))
    .filter((item): item is HomeCoupon => Boolean(item))
    .slice(0, 100);
}

function sanitizeDrawerConfig(
  input: unknown,
  fallback: HomeCouponWidgetSettingsPayload["drawer"]
): HomeCouponWidgetSettingsPayload["drawer"] {
  const obj = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  return {
    status: asStatus(obj.status, fallback.status),
    triggerLabel: asString(obj.triggerLabel, fallback.triggerLabel, 50),
    title: asString(obj.title, fallback.title, 80),
    subtitle: asString(obj.subtitle, fallback.subtitle, 120),
    desktopPosition: asDrawerDesktopPosition(
      obj.desktopPosition,
      fallback.desktopPosition
    ),
    mobilePosition: asDrawerMobilePosition(
      obj.mobilePosition,
      fallback.mobilePosition
    ),
    isLoading: false,
    coupons: sanitizeCoupons(obj.coupons, fallback.coupons),
  };
}

function sanitizeStripConfig(
  input: unknown,
  fallback: HomeCouponWidgetSettingsPayload["strip"]
): HomeCouponWidgetSettingsPayload["strip"] {
  const obj = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  const dismissForHoursRaw = asNumber(
    obj.dismissForHours,
    fallback.dismissForHours,
    0,
    720
  );
  return {
    status: asStatus(obj.status, fallback.status),
    message: asString(obj.message, fallback.message, 160),
    couponCode: asString(obj.couponCode, fallback.couponCode, 40).toUpperCase(),
    dismissForHours: Number(dismissForHoursRaw.toFixed(2)),
    forceShow: asBoolean(obj.forceShow, fallback.forceShow),
    appearDelayMs: Math.trunc(
      asNumber(obj.appearDelayMs, fallback.appearDelayMs, 0, 30000)
    ),
    ctaLabel: asString(obj.ctaLabel, fallback.ctaLabel, 40),
    ctaHref: asString(obj.ctaHref, fallback.ctaHref, 300),
    position: asStripPosition(obj.position, fallback.position),
    ctaPosition: asStripCtaPosition(obj.ctaPosition, fallback.ctaPosition),
  };
}

export function getDefaultHomeCouponWidgetSettings(): HomeCouponWidgetSettingsPayload {
  return {
    drawer: {
      status: HOME_AVAILABLE_COUPONS_WIDGET_CONFIG.status ?? "off",
      triggerLabel: HOME_AVAILABLE_COUPONS_WIDGET_CONFIG.triggerLabel ?? "View Coupons",
      title: HOME_AVAILABLE_COUPONS_WIDGET_CONFIG.title ?? "Available Coupons",
      subtitle: HOME_AVAILABLE_COUPONS_WIDGET_CONFIG.subtitle ?? "Copy and save instantly",
      desktopPosition: HOME_AVAILABLE_COUPONS_WIDGET_CONFIG.desktopPosition ?? "right",
      mobilePosition: HOME_AVAILABLE_COUPONS_WIDGET_CONFIG.mobilePosition ?? "bottom-right",
      isLoading: false,
      coupons: (HOME_AVAILABLE_COUPONS_WIDGET_CONFIG.coupons ?? []).map((coupon) => ({
        ...coupon,
      })),
    },
    strip: {
      status: HOME_COUPON_STRIP_CONFIG.status ?? "off",
      message: HOME_COUPON_STRIP_CONFIG.message ?? "",
      couponCode: HOME_COUPON_STRIP_CONFIG.couponCode ?? "",
      dismissForHours: HOME_COUPON_STRIP_CONFIG.dismissForHours ?? 24,
      forceShow: HOME_COUPON_STRIP_CONFIG.forceShow ?? false,
      appearDelayMs: HOME_COUPON_STRIP_CONFIG.appearDelayMs ?? 0,
      ctaLabel: HOME_COUPON_STRIP_CONFIG.ctaLabel ?? "Book Now",
      ctaHref: HOME_COUPON_STRIP_CONFIG.ctaHref ?? "/booking",
      position: HOME_COUPON_STRIP_CONFIG.position ?? "bottom",
      ctaPosition: HOME_COUPON_STRIP_CONFIG.ctaPosition ?? "right",
    },
  };
}

export function sanitizeHomeCouponWidgetSettings(
  input: unknown
): HomeCouponWidgetSettingsPayload {
  const fallback = getDefaultHomeCouponWidgetSettings();
  const obj = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  return {
    drawer: sanitizeDrawerConfig(obj.drawer, fallback.drawer),
    strip: sanitizeStripConfig(obj.strip, fallback.strip),
  };
}

function parseJson(value: string | undefined) {
  if (!value) return null;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

export function resolveHomeCouponWidgetSettingsFromMap(
  map: Record<string, string | undefined>
) {
  const fallback = getDefaultHomeCouponWidgetSettings();
  return {
    drawer: sanitizeDrawerConfig(
      parseJson(map[HOME_COUPON_DRAWER_CONFIG_KEY]),
      fallback.drawer
    ),
    strip: sanitizeStripConfig(
      parseJson(map[HOME_COUPON_STRIP_CONFIG_KEY]),
      fallback.strip
    ),
  };
}

export function resolveHomeCouponWidgetSettingsFromRows(rows: SettingRow[]) {
  const map: Record<string, string | undefined> = {};
  for (const row of rows) {
    map[row.key] = row.value;
  }
  return resolveHomeCouponWidgetSettingsFromMap(map);
}

export function serializeHomeCouponWidgetSettings(
  payload: HomeCouponWidgetSettingsPayload
) {
  const safePayload = sanitizeHomeCouponWidgetSettings(payload);
  return [
    {
      key: HOME_COUPON_DRAWER_CONFIG_KEY,
      value: JSON.stringify(safePayload.drawer),
    },
    {
      key: HOME_COUPON_STRIP_CONFIG_KEY,
      value: JSON.stringify(safePayload.strip),
    },
  ];
}
