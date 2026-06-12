import { beforeEach, describe, expect, it, vi } from "vitest";

const { findFirstMock, authMock } = vi.hoisted(() => ({
  findFirstMock: vi.fn(),
  authMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    signedAgreement: {
      findFirst: findFirstMock,
    },
  },
}));

vi.mock("@/services/auth/adminAuth.server", () => ({
  getAuthenticatedAdminIdFromCookies: authMock,
}));

import { GET } from "@/app/api/admin/bookings/[id]/agreement/download/route";

function callRoute(bookingId = "booking-1") {
  return GET(new Request("http://localhost/api/admin/bookings/download"), {
    params: Promise.resolve({ id: bookingId }),
  });
}

describe("GET admin signed agreement download", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue("admin-1");
  });

  it("requires an authenticated admin", async () => {
    authMock.mockResolvedValue(null);

    const response = await callRoute();

    expect(response.status).toBe(401);
    expect(findFirstMock).not.toHaveBeenCalled();
  });

  it("downloads the stored immutable PDF", async () => {
    const pdf = Buffer.from("%PDF-test-agreement");
    findFirstMock.mockResolvedValue({
      agreementRef: "HRA0612202600025",
      pdfFileName: "HRA0612202600025-signed-agreement.pdf",
      pdfContent: pdf,
    });

    const response = await callRoute();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(response.headers.get("content-disposition")).toBe(
      'attachment; filename="HRA0612202600025-signed-agreement.pdf"'
    );
    expect(Buffer.from(await response.arrayBuffer())).toEqual(pdf);
    expect(findFirstMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { bookingId: "booking-1" },
        select: {
          agreementRef: true,
          pdfFileName: true,
          pdfContent: true,
        },
      })
    );
  });

  it("returns not found when no stored PDF exists", async () => {
    findFirstMock.mockResolvedValue({
      agreementRef: "HRA0612202600025",
      pdfFileName: null,
      pdfContent: null,
    });

    const response = await callRoute();

    expect(response.status).toBe(404);
  });
});
