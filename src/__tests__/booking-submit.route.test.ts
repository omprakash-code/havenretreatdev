import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  prismaMock,
  requireActiveRangeBookingSessionMock,
  createSuccessTokenMock,
  buildStoredSignedAgreementPdfMock,
} = vi.hoisted(() => ({
  prismaMock: {
    booking: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    agreementTemplate: {
      findFirst: vi.fn(),
    },
    signedAgreement: {
      deleteMany: vi.fn(),
      create: vi.fn(),
    },
    bookingItem: {
      findMany: vi.fn(),
    },
    productVariant: {
      findUnique: vi.fn(),
      updateMany: vi.fn(),
    },
    couponUsage: {
      updateMany: vi.fn(),
    },
    $queryRaw: vi.fn(),
    $transaction: vi.fn(),
  },
  requireActiveRangeBookingSessionMock: vi.fn(),
  createSuccessTokenMock: vi.fn(() => "success-token"),
  buildStoredSignedAgreementPdfMock: vi.fn(async () => ({
    filename: "agreement.pdf",
    content: Buffer.from("pdf"),
    sha256: "sha",
    generatedAt: new Date("2026-07-12T10:00:00.000Z"),
  })),
}));

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: vi.fn(() => ({ value: "session-token" })),
  })),
}));

vi.mock("@/services/booking/bookingSession.server", () => ({
  verifyBookingSessionToken: vi.fn(() => ({
    bookingId: "booking_1",
    lockOwner: "owner_1",
    lockVersion: 1,
  })),
}));

vi.mock("@/services/booking/range-booking-session.service", () => ({
  requireActiveRangeBookingSession: requireActiveRangeBookingSessionMock,
  RangeBookingSessionError: class RangeBookingSessionError extends Error {
    constructor(
      public readonly code: string,
      message: string
    ) {
      super(message);
    }
  },
}));

vi.mock("@/services/booking/successToken.server", () => ({
  createSuccessToken: createSuccessTokenMock,
}));

vi.mock("@/lib/pdf/stored-signed-agreement", () => ({
  buildStoredSignedAgreementPdf: buildStoredSignedAgreementPdfMock,
}));

import { POST } from "@/app/api/bookings/submit/route";

const SUBMITTABLE_BOOKING = {
  id: "booking_1",
  bookingRef: "HR0712202600001",
  bookingStatus: "INCOMPLETE",
  venueId: "venue_1",
  packageId: "package_1",
  eventDate: new Date("2026-08-01T00:00:00.000Z"),
  startsAtUtc: new Date("2026-08-01T18:00:00.000Z"),
  occupiedUntilUtc: new Date("2026-08-01T23:00:00.000Z"),
  contactName: "Alex Rivera",
  contactPhone: "+13055550123",
  contactEmail: "alex@example.com",
  termsAcceptedAt: null,
};

function buildRequest(overrides: Record<string, unknown> = {}) {
  return new Request("http://localhost/api/bookings/submit", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": "203.0.113.7",
    },
    body: JSON.stringify({
      bookingId: "booking_1",
      signerName: "Alex Rivera",
      signatureImage: "data:image/png;base64,abc",
      confirmationAccepted: true,
      acknowledgedClauses: Array.from({ length: 33 }, (_, i) => i + 1),
      agreementVersion: "v1",
      ...overrides,
    }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();

  prismaMock.$transaction.mockImplementation(
    async (fn: (tx: typeof prismaMock) => Promise<unknown>) => fn(prismaMock)
  );
  prismaMock.$queryRaw.mockResolvedValue([]);
  prismaMock.agreementTemplate.findFirst.mockResolvedValue({
    id: "template_1",
    title: "Haven Retreat Rental Agreement",
    version: "v1",
  });
  prismaMock.booking.findUnique.mockResolvedValue(SUBMITTABLE_BOOKING);
  prismaMock.booking.update.mockResolvedValue({
    id: "booking_1",
    bookingRef: "HR0712202600001",
  });
  prismaMock.booking.findFirst.mockResolvedValue(null);
  prismaMock.bookingItem.findMany.mockResolvedValue([]);
  prismaMock.signedAgreement.deleteMany.mockResolvedValue({ count: 0 });
  prismaMock.signedAgreement.create.mockResolvedValue({ id: "agreement_1" });
  requireActiveRangeBookingSessionMock.mockResolvedValue({
    booking: SUBMITTABLE_BOOKING,
  });
});

describe("POST /api/bookings/submit", () => {
  it("submits a signed booking for review without creating a payment", async () => {
    const res = await POST(buildRequest());
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.bookingStatus).toBe("PENDING_REVIEW");
    expect(json.paymentStatusLabel).toBe("Unpaid");
    expect(json.successToken).toBe("success-token");

    const update = prismaMock.booking.update.mock.calls[0]?.[0];
    expect(update.data.bookingStatus).toBe("PENDING_REVIEW");
    expect(update.data.reviewSubmittedAt).toBeInstanceOf(Date);
    // The range is now reserved by status, not by a countdown hold.
    expect(update.data.holdExpiresAt).toBeNull();
    // No payment attempt is created and no provider fields are set.
    expect(update.data.paymentProvider).toBeNull();
    expect(update.data.paymentCheckoutUrl).toBeNull();

    // Coupons stay reserved until an admin approves.
    expect(prismaMock.couponUsage.updateMany).not.toHaveBeenCalled();
    // Stock is only decremented on approval.
    expect(prismaMock.productVariant.updateMany).not.toHaveBeenCalled();
  });

  it("stores the signed agreement with the signer's request metadata", async () => {
    await POST(buildRequest());

    const created = prismaMock.signedAgreement.create.mock.calls[0]?.[0];
    expect(created.data.bookingId).toBe("booking_1");
    expect(created.data.signerName).toBe("Alex Rivera");
    expect(created.data.confirmationAccepted).toBe(true);
    expect(created.data.ipAddress).toBe("203.0.113.7");
    expect(created.data.pdfSha256).toBe("sha");
  });

  it("is idempotent when the booking was already submitted", async () => {
    prismaMock.booking.findUnique.mockResolvedValue({
      ...SUBMITTABLE_BOOKING,
      bookingStatus: "PENDING_REVIEW",
    });

    const res = await POST(buildRequest());
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.alreadySubmitted).toBe(true);
    expect(json.successToken).toBe("success-token");
    expect(prismaMock.booking.update).not.toHaveBeenCalled();
  });

  it("rejects a submission whose range was taken while the customer signed", async () => {
    prismaMock.booking.findFirst.mockResolvedValue({
      id: "booking_2",
      bookingRef: "HR0712202600002",
    });

    const res = await POST(buildRequest());
    const json = await res.json();

    expect(res.status).toBe(409);
    // Mapped to the code the booking client already knows how to recover from.
    expect(json.code).toBe("SLOT_ALREADY_BOOKED");
    expect(prismaMock.booking.update).not.toHaveBeenCalled();
  });

  it("rejects a submission when an add-on ran out of stock", async () => {
    prismaMock.bookingItem.findMany.mockResolvedValue([
      { variantId: "variant_1", quantity: 2 },
    ]);
    prismaMock.productVariant.findUnique.mockResolvedValue({ stock: 1 });

    const res = await POST(buildRequest());
    const json = await res.json();

    expect(res.status).toBe(409);
    expect(json.code).toBe("PRODUCT_OUT_OF_STOCK");
    expect(prismaMock.booking.update).not.toHaveBeenCalled();
  });

  it("surfaces an expired session instead of submitting", async () => {
    const { RangeBookingSessionError } = await import(
      "@/services/booking/range-booking-session.service"
    );
    requireActiveRangeBookingSessionMock.mockRejectedValue(
      new RangeBookingSessionError(
        "SESSION_EXPIRED",
        "The booking hold has expired."
      )
    );

    const res = await POST(buildRequest());
    const json = await res.json();

    expect(res.status).toBe(409);
    expect(json.code).toBe("SESSION_EXPIRED");
    expect(prismaMock.booking.update).not.toHaveBeenCalled();
  });

  it("requires the full agreement before submitting", async () => {
    const res = await POST(
      buildRequest({ acknowledgedClauses: [1, 2, 3] })
    );
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.code).toBe("INVALID_REQUEST");
    expect(prismaMock.booking.update).not.toHaveBeenCalled();
  });
});
