import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("whatsapp service", () => {
  const originalFetch = globalThis.fetch;
  const originalPhoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const originalToken = process.env.WHATSAPP_TOKEN;
  const originalAccessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const originalImageUrl = process.env.WHATSAPP_TEMPLATE_IMAGE_URL;
  const originalTestMode = process.env.WHATSAPP_TEST_MODE;
  const originalEnabled = process.env.WHATSAPP_ENABLED;

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    vi.resetModules();
    process.env.WHATSAPP_PHONE_NUMBER_ID = "123456";
    process.env.WHATSAPP_TOKEN = "token";
    delete process.env.WHATSAPP_ACCESS_TOKEN;
    process.env.WHATSAPP_TEMPLATE_IMAGE_URL = "https://example.com/header.png";
    process.env.WHATSAPP_TEST_MODE = "false";
    delete process.env.WHATSAPP_ENABLED;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    globalThis.fetch = originalFetch;

    if (originalPhoneNumberId === undefined) {
      delete process.env.WHATSAPP_PHONE_NUMBER_ID;
    } else {
      process.env.WHATSAPP_PHONE_NUMBER_ID = originalPhoneNumberId;
    }

    if (originalToken === undefined) {
      delete process.env.WHATSAPP_TOKEN;
    } else {
      process.env.WHATSAPP_TOKEN = originalToken;
    }

    if (originalAccessToken === undefined) {
      delete process.env.WHATSAPP_ACCESS_TOKEN;
    } else {
      process.env.WHATSAPP_ACCESS_TOKEN = originalAccessToken;
    }

    if (originalImageUrl === undefined) {
      delete process.env.WHATSAPP_TEMPLATE_IMAGE_URL;
    } else {
      process.env.WHATSAPP_TEMPLATE_IMAGE_URL = originalImageUrl;
    }

    if (originalTestMode === undefined) {
      delete process.env.WHATSAPP_TEST_MODE;
    } else {
      process.env.WHATSAPP_TEST_MODE = originalTestMode;
    }

    if (originalEnabled === undefined) {
      delete process.env.WHATSAPP_ENABLED;
    } else {
      process.env.WHATSAPP_ENABLED = originalEnabled;
    }
  });

  it("logs an actionable auth-expired message when WhatsApp token is expired", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: vi.fn().mockResolvedValue({
        error: {
          message: "Error validating access token: Session has expired.",
          type: "OAuthException",
          code: 190,
          error_subcode: 463,
          fbtrace_id: "trace_1",
        },
      }),
    }) as unknown as typeof fetch;

    const { sendBookingConfirmationWhatsApp } = await import("@/services/whatsapp.service");
    await sendBookingConfirmationWhatsApp({
      phone: "919999999999",
      customerName: "Test User",
      bookingRef: "BK-1",
      location: "Delhi",
      theatre: "Test Theatre",
      dateTime: "2026-03-25, 10:00 AM",
      guests: "2",
      totalAmount: "1000",
      advancePaid: "500",
      payAtTheatre: "500",
      bookingUrl: "https://example.com/booking/BK-1",
    });

    expect(errorSpy).toHaveBeenCalledWith(
      "WHATSAPP_AUTH_FAILED",
      expect.objectContaining({
        code: 190,
        errorSubcode: 463,
        action: "Refresh WHATSAPP_TOKEN in production environment.",
      })
    );
  });

  it("skips WhatsApp silently when required config is missing", async () => {
    delete process.env.WHATSAPP_PHONE_NUMBER_ID;
    delete process.env.WHATSAPP_TOKEN;
    delete process.env.WHATSAPP_ACCESS_TOKEN;
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    globalThis.fetch = vi.fn() as unknown as typeof fetch;

    const {
      isBookingConfirmationWhatsAppEnabled,
      sendBookingConfirmationWhatsApp,
    } = await import("@/services/whatsapp.service");
    const sent = await sendBookingConfirmationWhatsApp({
      phone: "919999999999",
      customerName: "Test User",
      bookingRef: "BK-1",
      location: "Delhi",
      theatre: "Test Theatre",
      dateTime: "2026-03-25, 10:00 AM",
      guests: "2",
      totalAmount: "1000",
      advancePaid: "500",
      payAtTheatre: "500",
      bookingUrl: "https://example.com/booking/BK-1",
    });

    expect(isBookingConfirmationWhatsAppEnabled()).toBe(false);
    expect(sent).toBe(false);
    expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
    expect(logSpy).not.toHaveBeenCalled();
  });

  it("skips WhatsApp silently when explicitly disabled", async () => {
    process.env.WHATSAPP_ENABLED = "false";
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    globalThis.fetch = vi.fn() as unknown as typeof fetch;

    const {
      isBookingConfirmationWhatsAppEnabled,
      sendBookingConfirmationWhatsApp,
    } = await import("@/services/whatsapp.service");
    const sent = await sendBookingConfirmationWhatsApp({
      phone: "919999999999",
      customerName: "Test User",
      bookingRef: "BK-1",
      location: "Delhi",
      theatre: "Test Theatre",
      dateTime: "2026-03-25, 10:00 AM",
      guests: "2",
      totalAmount: "1000",
      advancePaid: "500",
      payAtTheatre: "500",
      bookingUrl: "https://example.com/booking/BK-1",
    });

    expect(isBookingConfirmationWhatsAppEnabled()).toBe(false);
    expect(sent).toBe(false);
    expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
    expect(logSpy).not.toHaveBeenCalled();
  });

  it("reports WhatsApp as enabled only when booking confirmation config is complete", async () => {
    const { isBookingConfirmationWhatsAppEnabled } = await import("@/services/whatsapp.service");

    expect(isBookingConfirmationWhatsAppEnabled()).toBe(true);

    delete process.env.WHATSAPP_TEMPLATE_IMAGE_URL;
    expect(isBookingConfirmationWhatsAppEnabled()).toBe(false);

    process.env.WHATSAPP_TEST_MODE = "true";
    expect(isBookingConfirmationWhatsAppEnabled()).toBe(true);
  });

  it("suppresses repeated auth-expired logs inside the cooldown window", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: vi.fn().mockResolvedValue({
        error: {
          message: "Error validating access token: Session has expired.",
          type: "OAuthException",
          code: 190,
          error_subcode: 463,
          fbtrace_id: "trace_1",
        },
      }),
    }) as unknown as typeof fetch;

    const { sendBookingConfirmationWhatsApp } = await import("@/services/whatsapp.service");
    const payload = {
      phone: "919999999999",
      customerName: "Test User",
      bookingRef: "BK-1",
      location: "Delhi",
      theatre: "Test Theatre",
      dateTime: "2026-03-25, 10:00 AM",
      guests: "2",
      totalAmount: "1000",
      advancePaid: "500",
      payAtTheatre: "500",
      bookingUrl: "https://example.com/booking/BK-1",
    };

    await sendBookingConfirmationWhatsApp(payload);
    await sendBookingConfirmationWhatsApp(payload);

    expect(
      errorSpy.mock.calls.filter(
        (call) => call[0] === "WHATSAPP_AUTH_FAILED"
      )
    ).toHaveLength(1);
  });
});
