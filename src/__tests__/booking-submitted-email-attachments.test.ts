import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  prismaMock,
  sendEmailMock,
  buildBookingRequestPdfAttachmentMock,
  createStoredAgreementAttachmentMock,
} = vi.hoisted(() => ({
  prismaMock: {
    booking: { findUnique: vi.fn() },
  },
  sendEmailMock: vi.fn(),
  buildBookingRequestPdfAttachmentMock: vi.fn(),
  createStoredAgreementAttachmentMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/services/email.service", () => ({ sendEmail: sendEmailMock }));
vi.mock("@/lib/pdf/booking-request", () => ({
  buildBookingRequestPdfAttachment: buildBookingRequestPdfAttachmentMock,
}));
vi.mock("@/lib/pdf/stored-signed-agreement", () => ({
  createStoredAgreementAttachment: createStoredAgreementAttachmentMock,
}));
vi.mock("@/services/booking/booking-notification-recipients.service", () => ({
  resolveAdminBookingNotificationRecipients: () => ["admin@havenretreat.com"],
}));
vi.mock("@/services/booking/successToken.server", () => ({
  createSuccessToken: () => "success-token",
}));
vi.mock("@/emails/BookingReviewEmail", () => ({
  default: () => null,
}));

import { sendBookingSubmittedEmails } from "@/services/booking/booking-review-email.service";

const BOOKING = {
  id: "booking_1",
  bookingRef: "HR0712202600001",
  contactName: "Alex Rivera",
  contactPhone: "3055550123",
  contactEmail: "alex@example.com",
  packageSnapshot: { name: "Signature Package" },
  venue: { city: "Miami" },
  eventDate: new Date("2026-08-01T00:00:00Z"),
  eventStartTime: "18:00",
  eventEndTime: "23:00",
  startsAtUtc: new Date("2026-08-01T22:00:00Z"),
  endsAtUtc: new Date("2026-08-02T03:00:00Z"),
  timezone: "America/New_York",
  guestCount: 24,
  occasionLabel: "Birthday",
  decorationRequired: true,
  totalAmount: 2400,
  rejectionReason: null,
  signedAgreements: [
    { id: "agr_1", pdfFileName: "agreement.pdf", pdfContent: new Uint8Array([1]) },
  ],
};

const BOOKING_PDF = { filename: "booking.pdf", content: Buffer.from("b") };
const AGREEMENT_PDF = { filename: "agreement.pdf", content: Buffer.from("a") };

function attachmentsFor(recipient: string) {
  const call = sendEmailMock.mock.calls.find(
    ([params]) => params.to === recipient
  );
  return call?.[0].attachments ?? [];
}

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.booking.findUnique.mockResolvedValue(BOOKING);
  buildBookingRequestPdfAttachmentMock.mockResolvedValue(BOOKING_PDF);
  createStoredAgreementAttachmentMock.mockReturnValue(AGREEMENT_PDF);
  sendEmailMock.mockResolvedValue(undefined);
});

describe("sendBookingSubmittedEmails attachments", () => {
  it("sends the customer both the booking summary and the signed agreement", async () => {
    await sendBookingSubmittedEmails("booking_1");

    expect(attachmentsFor("alex@example.com")).toEqual([
      BOOKING_PDF,
      AGREEMENT_PDF,
    ]);
  });

  it("sends the admin the same pair for review", async () => {
    await sendBookingSubmittedEmails("booking_1");

    expect(attachmentsFor("admin@havenretreat.com")).toEqual([
      BOOKING_PDF,
      AGREEMENT_PDF,
    ]);
  });

  /**
   * The PDF is generated at send time and can fail on its own. Losing the
   * summary is a bad email; losing the email is a customer who never hears that
   * their request arrived.
   */
  it("still sends the email when the booking PDF cannot be drawn", async () => {
    buildBookingRequestPdfAttachmentMock.mockRejectedValue(new Error("boom"));

    await sendBookingSubmittedEmails("booking_1");

    expect(sendEmailMock).toHaveBeenCalled();
    expect(attachmentsFor("alex@example.com")).toEqual([AGREEMENT_PDF]);
  });
});
