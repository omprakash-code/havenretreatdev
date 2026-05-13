import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import crypto from "crypto";

import { sendMetaCapiEvent } from "@/lib/meta/server";

function hashSha256(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

describe("meta server tracking", () => {
  const originalFetch = globalThis.fetch;
  const originalPixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID;
  const originalAccessToken = process.env.META_ACCESS_TOKEN;
  const originalTestCode = process.env.META_TEST_EVENT_CODE;
  const originalAllowProdTestCode =
    process.env.META_ALLOW_TEST_EVENT_CODE_IN_PRODUCTION;
  const originalAppUrl = process.env.NEXT_PUBLIC_APP_URL;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_META_PIXEL_ID = "1178551083674875";
    process.env.META_ACCESS_TOKEN = "meta-access-token";
    process.env.META_TEST_EVENT_CODE = "TEST123";
    process.env.NEXT_PUBLIC_APP_URL = "https://havenretreat.com";
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;

    if (originalPixelId === undefined) {
      delete process.env.NEXT_PUBLIC_META_PIXEL_ID;
    } else {
      process.env.NEXT_PUBLIC_META_PIXEL_ID = originalPixelId;
    }

    if (originalAccessToken === undefined) {
      delete process.env.META_ACCESS_TOKEN;
    } else {
      process.env.META_ACCESS_TOKEN = originalAccessToken;
    }

    if (originalTestCode === undefined) {
      delete process.env.META_TEST_EVENT_CODE;
    } else {
      process.env.META_TEST_EVENT_CODE = originalTestCode;
    }

    if (originalAllowProdTestCode === undefined) {
      delete process.env.META_ALLOW_TEST_EVENT_CODE_IN_PRODUCTION;
    } else {
      process.env.META_ALLOW_TEST_EVENT_CODE_IN_PRODUCTION =
        originalAllowProdTestCode;
    }

    if (originalAppUrl === undefined) {
      delete process.env.NEXT_PUBLIC_APP_URL;
    } else {
      process.env.NEXT_PUBLIC_APP_URL = originalAppUrl;
    }

    vi.unstubAllEnvs();
  });

  it("does not send events without marketing consent", async () => {
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await sendMetaCapiEvent({
      eventName: "Purchase",
      eventId: "purchase:test",
      eventSourceUrl: "/booking/success?t=abc",
      cookieHeader: "ds_cookie_consent=rejected",
      email: "test@example.com",
    });

    expect(result).toEqual({
      sent: false,
      reason: "no_consent",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends a consented purchase payload with hashed user data and attribution cookies", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: vi.fn().mockResolvedValue(""),
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await sendMetaCapiEvent({
      eventName: "Purchase",
      eventId: "purchase:DS-BOOK-1:pay_123",
      eventSourceUrl: "/booking/success?t=token123",
      customData: {
        currency: "INR",
        value: 750,
        order_id: "DS-BOOK-1",
      },
      cookieHeader:
        "ds_cookie_consent=accepted; ds_meta_fbc=fb.1.123.fbclid123; ds_meta_fbp=fb.1.123.browser123",
      clientIpAddress: "203.0.113.10",
      clientUserAgent: "Mozilla/5.0 test",
      email: "Test@Example.com",
      phone: "99999 99999",
      externalId: "DS-BOOK-1",
    });

    expect(result).toEqual({ sent: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [requestUrl, requestInit] = fetchMock.mock.calls[0] as [
      string,
      { body: string; method: string; headers: Record<string, string> }
    ];
    const payload = JSON.parse(requestInit.body);

    expect(requestUrl).toContain(
      "https://graph.facebook.com/v22.0/1178551083674875/events"
    );
    expect(requestUrl).toContain("access_token=meta-access-token");
    expect(requestInit.method).toBe("POST");
    expect(requestInit.headers["Content-Type"]).toBe("application/json");
    expect(payload.test_event_code).toBe("TEST123");
    expect(payload.data[0]).toMatchObject({
      event_name: "Purchase",
      event_id: "purchase:DS-BOOK-1:pay_123",
      action_source: "website",
      event_source_url: "https://havenretreat.com/booking/success?t=token123",
      custom_data: {
        currency: "INR",
        value: 750,
        order_id: "DS-BOOK-1",
      },
      user_data: {
        em: [hashSha256("test@example.com")],
        ph: [hashSha256("919999999999")],
        external_id: [hashSha256("DS-BOOK-1")],
        fbc: "fb.1.123.fbclid123",
        fbp: "fb.1.123.browser123",
        client_ip_address: "203.0.113.10",
        client_user_agent: "Mozilla/5.0 test",
      },
    });
    expect(typeof payload.data[0].event_time).toBe("number");
  });

  it("does not include test_event_code in production unless explicitly enabled", async () => {
    vi.stubEnv("NODE_ENV", "production");

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: vi.fn().mockResolvedValue(""),
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await sendMetaCapiEvent({
      eventName: "Purchase",
      eventId: "purchase:DS-BOOK-1:pay_123",
      eventSourceUrl: "/booking/success?t=token123",
      cookieHeader:
        "ds_cookie_consent=accepted; ds_meta_fbp=fb.1.123.browser123",
      email: "test@example.com",
    });

    expect(result).toEqual({ sent: true });

    const [, requestInit] = fetchMock.mock.calls[0] as [
      string,
      { body: string }
    ];
    const payload = JSON.parse(requestInit.body);
    expect(payload.test_event_code).toBeUndefined();
  });

  it("includes test_event_code in production when explicitly enabled", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("META_ALLOW_TEST_EVENT_CODE_IN_PRODUCTION", "true");

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: vi.fn().mockResolvedValue(""),
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await sendMetaCapiEvent({
      eventName: "Purchase",
      eventId: "purchase:DS-BOOK-1:pay_123",
      eventSourceUrl: "/booking/success?t=token123",
      cookieHeader:
        "ds_cookie_consent=accepted; ds_meta_fbp=fb.1.123.browser123",
      email: "test@example.com",
    });

    expect(result).toEqual({ sent: true });

    const [, requestInit] = fetchMock.mock.calls[0] as [
      string,
      { body: string }
    ];
    const payload = JSON.parse(requestInit.body);
    expect(payload.test_event_code).toBe("TEST123");
  });
});
