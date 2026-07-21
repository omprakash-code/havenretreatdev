import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { resendConstructorMock, resendSendMock, renderEmailMock } = vi.hoisted(
  () => ({
    resendConstructorMock: vi.fn(),
    resendSendMock: vi.fn(),
    renderEmailMock: vi.fn(),
  })
);

vi.mock("resend", () => ({
  Resend: class {
    emails = {
      send: resendSendMock,
    };

    constructor(apiKey: string) {
      resendConstructorMock(apiKey);
    }
  },
}));

vi.mock("@react-email/render", () => ({
  render: renderEmailMock,
}));

describe("email service", () => {
  const originalResendApiKey = process.env.RESEND_API_KEY;
  const originalFromEmail = process.env.FROM_EMAIL;
  const originalResendTimeoutMs = process.env.RESEND_TIMEOUT_MS;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    vi.useRealTimers();
    process.env.RESEND_API_KEY = "test_resend_key";
    process.env.FROM_EMAIL = "Haven Retreat <noreply@example.com>";
    delete process.env.RESEND_TIMEOUT_MS;
    renderEmailMock.mockResolvedValue("<p>Email</p>");
  });

  afterEach(() => {
    vi.useRealTimers();

    if (originalResendApiKey === undefined) {
      delete process.env.RESEND_API_KEY;
    } else {
      process.env.RESEND_API_KEY = originalResendApiKey;
    }

    if (originalFromEmail === undefined) {
      delete process.env.FROM_EMAIL;
    } else {
      process.env.FROM_EMAIL = originalFromEmail;
    }

    if (originalResendTimeoutMs === undefined) {
      delete process.env.RESEND_TIMEOUT_MS;
    } else {
      process.env.RESEND_TIMEOUT_MS = originalResendTimeoutMs;
    }
  });

  it("allows provider responses that take longer than the old development timeout", async () => {
    vi.useFakeTimers();
    resendSendMock.mockReturnValue(
      new Promise((resolve) => {
        setTimeout(() => resolve({ data: { id: "email_1" }, error: null }), 3100);
      })
    );

    const { sendEmail } = await import("@/services/email.service");
    const sendPromise = sendEmail({
      to: "customer@example.com",
      subject: "Booking confirmation",
      react: React.createElement("div"),
    });
    const expectation = expect(sendPromise).resolves.toBe(true);

    await vi.advanceTimersByTimeAsync(3100);

    await expectation;
  });

  it("uses RESEND_TIMEOUT_MS when an explicit timeout is configured", async () => {
    vi.useFakeTimers();
    process.env.RESEND_TIMEOUT_MS = "250";
    resendSendMock.mockReturnValue(new Promise(() => {}));

    const { sendEmail } = await import("@/services/email.service");
    const sendPromise = sendEmail({
      to: "customer@example.com",
      subject: "Booking confirmation",
      react: React.createElement("div"),
    });
    const expectation = expect(sendPromise).rejects.toThrow(
      'Resend send timed out for "Booking confirmation" after 250ms'
    );

    await vi.advanceTimersByTimeAsync(250);

    await expectation;
  });
});
