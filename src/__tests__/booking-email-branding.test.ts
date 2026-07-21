import { afterEach, describe, expect, it, vi } from "vitest";

describe("booking email branding", () => {
  const originalNextPublicAppUrl = process.env.NEXT_PUBLIC_APP_URL;
  const originalAppUrl = process.env.APP_URL;
  const originalVercelUrl = process.env.VERCEL_URL;

  afterEach(() => {
    vi.resetModules();

    if (originalNextPublicAppUrl === undefined) {
      delete process.env.NEXT_PUBLIC_APP_URL;
    } else {
      process.env.NEXT_PUBLIC_APP_URL = originalNextPublicAppUrl;
    }

    if (originalAppUrl === undefined) {
      delete process.env.APP_URL;
    } else {
      process.env.APP_URL = originalAppUrl;
    }

    if (originalVercelUrl === undefined) {
      delete process.env.VERCEL_URL;
    } else {
      process.env.VERCEL_URL = originalVercelUrl;
    }
  });

  it("uses the live booking domain for email logo assets when no app URL is configured", async () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    delete process.env.APP_URL;
    delete process.env.VERCEL_URL;
    vi.resetModules();

    const { BOOKING_EMAIL_BRAND_LOGO_URL } = await import(
      "@/emails/theme/booking-email-branding"
    );

    expect(BOOKING_EMAIL_BRAND_LOGO_URL).toBe(
      "https://book.havenretreatmiami.com/assets/email-ds-logo.png"
    );
  });

  it("uses the live booking domain instead of localhost for email logo assets", async () => {
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
    delete process.env.APP_URL;
    delete process.env.VERCEL_URL;
    vi.resetModules();

    const { BOOKING_EMAIL_BRAND_LOGO_URL } = await import(
      "@/emails/theme/booking-email-branding"
    );

    expect(BOOKING_EMAIL_BRAND_LOGO_URL).toBe(
      "https://book.havenretreatmiami.com/assets/email-ds-logo.png"
    );
  });
});
