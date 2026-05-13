"use client";

import {
  META_CONSENT_ACCEPTED,
  META_CONSENT_REJECTED,
  META_DEFAULT_COOKIE_MAX_AGE_DAYS,
  sanitizeMetaPayload,
  type MetaAttributionSnapshot,
  type MetaConsentState,
} from "./shared";
import { getClientMetaSiteConfig, getMetaCookieNames } from "./config";

type MetaEventOptions = {
  eventId?: string;
};

type MetaCtaClickInput = {
  ctaName: string;
  ctaLocation: string;
  destination?: string;
};

type Fbq =
  | ((
      action: string,
      eventName?: string,
      params?: Record<string, unknown>,
      options?: Record<string, unknown>
    ) => void)
  | undefined;

function isBrowser() {
  return typeof window !== "undefined";
}

function getFbq(): Fbq {
  if (!isBrowser()) return undefined;
  return window.fbq as Fbq;
}

function setCookie(name: string, value: string, maxAgeDays = META_DEFAULT_COOKIE_MAX_AGE_DAYS) {
  if (!isBrowser()) return;
  const maxAgeSeconds = Math.max(Math.floor(maxAgeDays * 24 * 60 * 60), 0);
  document.cookie = `${name}=${encodeURIComponent(
    value
  )}; path=/; max-age=${maxAgeSeconds}; samesite=lax`;
}

function deleteCookie(name: string) {
  if (!isBrowser()) return;
  document.cookie = `${name}=; path=/; max-age=0; samesite=lax`;
}

export function getCookieValue(name: string) {
  if (!isBrowser()) return null;

  const target = `${name}=`;
  const cookies = document.cookie.split(";").map((entry) => entry.trim());
  for (const cookie of cookies) {
    if (!cookie.startsWith(target)) continue;
    return decodeURIComponent(cookie.slice(target.length));
  }

  return null;
}

function getStoredAttributionSnapshot(): MetaAttributionSnapshot | null {
  if (!isBrowser()) return null;
  const names = getMetaCookieNames(getClientMetaSiteConfig());

  const raw = window.localStorage.getItem(names.attributionStorage);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as MetaAttributionSnapshot;
  } catch {
    return null;
  }
}

function setStoredAttributionSnapshot(snapshot: MetaAttributionSnapshot) {
  if (!isBrowser()) return;
  const names = getMetaCookieNames(getClientMetaSiteConfig());
  window.localStorage.setItem(
    names.attributionStorage,
    JSON.stringify(snapshot)
  );
}

function randomDigits() {
  if (!isBrowser()) return `${Date.now()}${Math.floor(Math.random() * 100000)}`;

  if (window.crypto?.getRandomValues) {
    const bytes = new Uint32Array(2);
    window.crypto.getRandomValues(bytes);
    return `${bytes[0]}${bytes[1]}`;
  }

  return `${Date.now()}${Math.floor(Math.random() * 100000)}`;
}

export function getMetaPixelId() {
  return getClientMetaSiteConfig().pixelId;
}

export function getMetaConsentState(): MetaConsentState {
  if (!isBrowser()) return null;
  const names = getMetaCookieNames(getClientMetaSiteConfig());

  const stored =
    window.localStorage.getItem(names.consentStorage) ??
    getCookieValue(names.consent);

  if (stored === META_CONSENT_ACCEPTED || stored === META_CONSENT_REJECTED) {
    return stored;
  }

  return null;
}

export function hasMetaTrackingConsent() {
  return getMetaConsentState() === META_CONSENT_ACCEPTED;
}

export function clearMetaTrackingData() {
  if (!isBrowser()) return;
  const names = getMetaCookieNames(getClientMetaSiteConfig());

  window.localStorage.removeItem(names.attributionStorage);
  deleteCookie(names.fbc);
  deleteCookie(names.fbp);
  deleteCookie("_fbc");
  deleteCookie("_fbp");
}

export function setMetaConsentState(state: Exclude<MetaConsentState, null>) {
  if (!isBrowser()) return;
  const names = getMetaCookieNames(getClientMetaSiteConfig());

  window.localStorage.setItem(names.consentStorage, state);
  setCookie(names.consent, state);

  if (state === META_CONSENT_REJECTED) {
    clearMetaTrackingData();
    getFbq()?.("consent", "revoke");
  } else {
    getFbq()?.("consent", "grant");
  }

  window.dispatchEvent(
    new CustomEvent("meta-consent-change", {
      detail: state,
    })
  );
}

function buildFbp(nowMs = Date.now()) {
  return `fb.1.${nowMs}.${randomDigits()}`;
}

function buildFbc(fbclid: string, nowMs = Date.now()) {
  return `fb.1.${nowMs}.${fbclid}`;
}

export function ensureMetaAttributionFromLocation(locationObject = window.location) {
  if (!isBrowser() || !hasMetaTrackingConsent()) return null;
  const names = getMetaCookieNames(getClientMetaSiteConfig());

  const params = new URLSearchParams(locationObject.search);
  const nowIso = new Date().toISOString();
  const nowMs = Date.now();

  const currentFbp =
    getCookieValue(names.fbp) ?? getCookieValue("_fbp") ?? buildFbp(nowMs);
  setCookie(names.fbp, currentFbp);

  const fbclid = params.get("fbclid")?.trim() || undefined;
  const currentFbc = fbclid
    ? buildFbc(fbclid, nowMs)
    : getCookieValue(names.fbc) ?? getCookieValue("_fbc") ?? undefined;

  if (currentFbc) {
    setCookie(names.fbc, currentFbc);
  }

  const previous = getStoredAttributionSnapshot();
  const snapshot: MetaAttributionSnapshot = {
    fbclid: fbclid ?? previous?.fbclid,
    fbc: currentFbc ?? previous?.fbc,
    fbp: currentFbp,
    utmSource: params.get("utm_source")?.trim() || previous?.utmSource,
    utmMedium: params.get("utm_medium")?.trim() || previous?.utmMedium,
    utmCampaign: params.get("utm_campaign")?.trim() || previous?.utmCampaign,
    utmContent: params.get("utm_content")?.trim() || previous?.utmContent,
    utmTerm: params.get("utm_term")?.trim() || previous?.utmTerm,
    landingPath:
      previous?.landingPath ??
      `${locationObject.pathname}${locationObject.search}${locationObject.hash}`,
    referrer: previous?.referrer ?? (document.referrer || undefined),
    capturedAt: previous?.capturedAt ?? nowIso,
  };

  setStoredAttributionSnapshot(snapshot);
  return snapshot;
}

function trackMetaEvent(
  method: "track" | "trackCustom",
  eventName: string,
  params?: Record<string, unknown>,
  options?: MetaEventOptions
) {
  if (!hasMetaTrackingConsent()) return false;

  const fbq = getFbq();
  if (!fbq) return false;

  ensureMetaAttributionFromLocation();

  const cleanedParams = sanitizeMetaPayload(params);
  const cleanedOptions = sanitizeMetaPayload(
    options?.eventId ? { eventID: options.eventId } : undefined
  );

  if (Object.keys(cleanedParams).length === 0 && Object.keys(cleanedOptions).length === 0) {
    fbq(method, eventName);
    return true;
  }

  if (Object.keys(cleanedOptions).length === 0) {
    fbq(method, eventName, cleanedParams);
    return true;
  }

  fbq(method, eventName, cleanedParams, cleanedOptions);
  return true;
}

export function trackMetaStandardEvent(
  eventName: string,
  params?: Record<string, unknown>,
  options?: MetaEventOptions
) {
  return trackMetaEvent("track", eventName, params, options);
}

export function trackMetaCustomEvent(
  eventName: string,
  params?: Record<string, unknown>,
  options?: MetaEventOptions
) {
  return trackMetaEvent("trackCustom", eventName, params, options);
}

export function trackMetaCtaClick(input: MetaCtaClickInput) {
  return trackMetaCustomEvent("CTA_Click", {
    cta_name: input.ctaName,
    cta_location: input.ctaLocation,
    destination: input.destination,
    page_path: isBrowser() ? window.location.pathname : undefined,
  });
}
