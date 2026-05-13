import crypto from "crypto";
import { normalizePhone } from "@/lib/phone";
import {
  META_CONSENT_ACCEPTED,
  sanitizeMetaPayload,
} from "./shared";
import { getMetaCookieNames, resolveMetaSiteConfig, type MetaSiteConfig } from "./config";

type MetaCapiInput = {
  eventName: string;
  eventId: string;
  eventSourceUrl: string;
  customData?: Record<string, unknown>;
  cookieHeader?: string | null;
  clientIpAddress?: string | null;
  clientUserAgent?: string | null;
  email?: string | null;
  phone?: string | null;
  externalId?: string | null;
};

function hashSha256(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function normalizeEmail(email: string | null | undefined) {
  const trimmed = String(email ?? "").trim().toLowerCase();
  return trimmed || null;
}

function normalizeMetaPhone(phone: string | null | undefined) {
  const digits = String(phone ?? "").replace(/\D/g, "");
  if (!digits) return null;

  if (digits.startsWith("91") && digits.length === 12) {
    return digits;
  }

  const local = normalizePhone(digits);
  if (!local) return null;
  return `91${local}`;
}

function getCookieValueFromHeader(name: string, cookieHeader: string | null | undefined) {
  if (!cookieHeader) return null;

  const target = `${name}=`;
  const cookies = cookieHeader.split(";").map((entry) => entry.trim());
  for (const cookie of cookies) {
    if (!cookie.startsWith(target)) continue;
    return decodeURIComponent(cookie.slice(target.length));
  }

  return null;
}

function hasMarketingConsent(cookieHeader: string | null | undefined) {
  const config = resolveMetaSiteConfig();
  const names = getMetaCookieNames(config);
  return (
    getCookieValueFromHeader(names.consent, cookieHeader) ===
    META_CONSENT_ACCEPTED
  );
}

function buildUserData(
  input: Omit<MetaCapiInput, "eventName" | "eventId" | "eventSourceUrl" | "customData">,
  config: MetaSiteConfig
) {
  const email = normalizeEmail(input.email);
  const phone = normalizeMetaPhone(input.phone);
  const externalId = String(input.externalId ?? "").trim();
  const names = getMetaCookieNames(config);
  const fbc =
    getCookieValueFromHeader(names.fbc, input.cookieHeader) ??
    getCookieValueFromHeader("_fbc", input.cookieHeader);
  const fbp =
    getCookieValueFromHeader(names.fbp, input.cookieHeader) ??
    getCookieValueFromHeader("_fbp", input.cookieHeader);

  return sanitizeMetaPayload({
    em: email ? [hashSha256(email)] : undefined,
    ph: phone ? [hashSha256(phone)] : undefined,
    external_id: externalId ? [hashSha256(externalId)] : undefined,
    fbc,
    fbp,
    client_ip_address: input.clientIpAddress,
    client_user_agent: input.clientUserAgent,
  });
}

function resolveTestEventCode(config: MetaSiteConfig) {
  const allowInProduction =
    String(process.env.META_ALLOW_TEST_EVENT_CODE_IN_PRODUCTION ?? "")
      .trim()
      .toLowerCase() === "true";

  if (process.env.NODE_ENV === "production" && !allowInProduction) {
    return undefined;
  }

  return config.testEventCode || undefined;
}

function resolveMetaApiVersion(config: MetaSiteConfig) {
  return config.graphApiVersion;
}

function normalizeMetaEventSourceUrl(
  url: string | null | undefined,
  config: MetaSiteConfig
) {
  const trimmed = String(url ?? "").trim();
  if (!trimmed) return `${config.appUrl}/booking`;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `${config.appUrl}${trimmed.startsWith("/") ? trimmed : `/${trimmed}`}`;
}

export function getClientIpAddress(headers: Headers) {
  const forwardedFor = headers.get("x-forwarded-for");
  if (forwardedFor) {
    const firstIp = forwardedFor.split(",")[0]?.trim();
    if (firstIp) return firstIp;
  }

  const realIp = headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;

  return null;
}

export async function sendMetaCapiEvent(input: MetaCapiInput) {
  const config = resolveMetaSiteConfig();
  const pixelId = config.pixelId;
  const accessToken = config.accessToken;

  if (!pixelId || !accessToken) {
    return { sent: false, reason: "missing_credentials" as const };
  }

  if (!hasMarketingConsent(input.cookieHeader)) {
    return { sent: false, reason: "no_consent" as const };
  }

  const userData = buildUserData(input, config);
  if (Object.keys(userData).length === 0) {
    return { sent: false, reason: "missing_user_data" as const };
  }

  const body = {
    data: [
      {
        event_name: input.eventName,
        event_time: Math.floor(Date.now() / 1000),
        event_id: input.eventId,
        action_source: "website",
        event_source_url: normalizeMetaEventSourceUrl(input.eventSourceUrl, config),
        user_data: userData,
        custom_data: sanitizeMetaPayload(input.customData),
      },
    ],
    test_event_code: resolveTestEventCode(config),
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    const url = new URL(
      `https://graph.facebook.com/${resolveMetaApiVersion(config)}/${pixelId}/events`
    );
    url.searchParams.set("access_token", accessToken);

    const response = await fetch(url.toString(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      console.error("META_CAPI_EVENT_FAILED", {
        status: response.status,
        body: errorText.slice(0, 1000),
      });
      return { sent: false, reason: "request_failed" as const };
    }

    return { sent: true as const };
  } catch (error) {
    console.error("META_CAPI_EVENT_ERROR", error);
    return { sent: false, reason: "request_error" as const };
  } finally {
    clearTimeout(timeoutId);
  }
}

export function resolveMetaAppUrl(pathname: string, hostname?: string | null) {
  const config = resolveMetaSiteConfig(hostname);
  return `${config.appUrl.replace(/\/+$/, "")}${pathname.startsWith("/") ? pathname : `/${pathname}`}`;
}
