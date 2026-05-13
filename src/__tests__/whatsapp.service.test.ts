import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("whatsapp service", () => {
  const originalFetch = globalThis.fetch;
  const originalPhoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const originalToken = process.env.WHATSAPP_TOKEN;
  const originalImageUrl = process.env.WHATSAPP_TEMPLATE_IMAGE_URL;
  const originalTestMode = process.env.WHATSAPP_TEST_MODE;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    process.env.WHATSAPP_PHONE_NUMBER_ID = "123456";
    process.env.WHATSAPP_TOKEN = "token";
    process.env.WHATSAPP_TEMPLATE_IMAGE_URL = "https://example.com/header.png";
    process.env.WHATSAPP_TEST_MODE = "false";
  });

  afterEach(() => {
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
      "[WHATSAPP] Access token expired.",
      expect.objectContaining({
        code: 190,
        errorSubcode: 463,
        action: "Refresh WHATSAPP_TOKEN in production environment.",
      })
    );
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
        (call) => call[0] === "[WHATSAPP] Access token expired."
      )
    ).toHaveLength(1);
  });
});
