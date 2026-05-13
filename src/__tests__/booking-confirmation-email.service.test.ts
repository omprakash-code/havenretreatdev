import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { sendEmailMock, renderEmailMock, buildPdfMock } = vi.hoisted(() => ({
  sendEmailMock: vi.fn(),
  renderEmailMock: vi.fn(() => null),
  buildPdfMock: vi.fn(),
}));

vi.mock("@/services/email.service", () => ({
  sendEmail: sendEmailMock,
}));

vi.mock("@/emails/renderBookingConfirmationEmail", () => ({
  renderBookingConfirmationEmail: renderEmailMock,
}));

vi.mock("@/lib/pdf/booking-confirmation", () => ({
  buildBookingConfirmationPdfAttachment: buildPdfMock,
}));

import { sendBookingConfirmationEmail } from "@/services/booking/booking-confirmation-email.service";

const baseEmailData = {
  bookingRef: "DS-BOOK-100",
  customerName: "Demo User",
  customerPhone: "9999999999",
  customerEmail: "demo@example.com",
  theatreName: "Silver Screen",
  locationName: "Delhi",
  date: "Mon, 02 Mar 2026",
  timeSlot: "10:00 - 11:00",
  guestCount: 2,
  totalAmount: 2000,
  advancePaid: 750,
  remainingPayable: 1250,
  successUrl: "https://example.com/booking/success?t=abc",
};

describe("sendBookingConfirmationEmail", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    buildPdfMock.mockResolvedValue({
      filename: "DS-BOOK-100.pdf",
      content: "cGRm",
      contentType: "application/pdf",
    });
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it("sends email with PDF attachment", async () => {
    await sendBookingConfirmationEmail({
      to: "demo@example.com",
      bookingRef: "DS-BOOK-100",
      emailData: baseEmailData,
      theme: "dark",
    });

    expect(buildPdfMock).toHaveBeenCalledWith("DS-BOOK-100", baseEmailData);
    expect(renderEmailMock).toHaveBeenCalledWith(baseEmailData, "dark");
    expect(sendEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "demo@example.com",
        subject: "Your Private Theatre is Booked – DS-BOOK-100",
        react: null,
        attachments: expect.arrayContaining([
          {
            filename: "DS-BOOK-100.pdf",
            content: "cGRm",
            contentType: "application/pdf",
          },
          expect.objectContaining({
            filename: "DS-BOOK-100.ics",
            contentType: "text/calendar; charset=utf-8; method=REQUEST",
            content: expect.any(String),
          }),
        ]),
      })
    );
  });

  it("still sends email when PDF generation fails", async () => {
    buildPdfMock.mockRejectedValueOnce(new Error("pdf-failed"));

    await sendBookingConfirmationEmail({
      to: "demo@example.com",
      bookingRef: "DS-BOOK-100",
      emailData: baseEmailData,
      theme: "light",
    });

    expect(sendEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "demo@example.com",
        subject: "Your Private Theatre is Booked – DS-BOOK-100",
        react: null,
        attachments: expect.arrayContaining([
          expect.objectContaining({
            filename: "DS-BOOK-100.ics",
            contentType: "text/calendar; charset=utf-8; method=REQUEST",
            content: expect.any(String),
          }),
        ]),
      })
    );
    const firstCallArg = sendEmailMock.mock.calls[0]?.[0] as {
      attachments?: Array<{ filename: string }>;
    };
    expect(firstCallArg.attachments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          filename: "DS-BOOK-100.ics",
        }),
      ])
    );
  });
});
