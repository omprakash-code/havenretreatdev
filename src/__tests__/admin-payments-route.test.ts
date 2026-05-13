import { beforeEach, describe, expect, it, vi } from "vitest";

const { authMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    payment: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@/services/auth/adminAuth.server", () => ({
  getAuthenticatedAdminIdFromCookies: authMock,
}));

import { prisma } from "@/lib/db";
import { GET } from "@/app/api/admin/payments/route";

describe("GET /api/admin/payments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue("admin-1");
  });

  it("returns paginated payment records", async () => {
    (
      prisma.payment.count as unknown as ReturnType<typeof vi.fn>
    ).mockResolvedValue(1);
    (
      prisma.payment.findMany as unknown as ReturnType<typeof vi.fn>
    ).mockResolvedValue([
      {
        id: "pay-1",
        provider: "RAZORPAY",
        transactionId: "txn-1",
        amount: 750,
        status: "PAID",
        createdAt: new Date("2026-01-01T12:00:00.000Z"),
        booking: {
          bookingRef: "DS-BOOK-1",
          contactName: "Rahul",
          contactPhone: "9999999999",
          theatre: {
            name: "Theatre 1",
            location: { name: "Pitampura" },
          },
          slot: {
            date: new Date("2026-01-05T00:00:00.000Z"),
            startTime: "10:00",
            endTime: "11:00",
          },
        },
      },
    ]);

    const req = new Request(
      "http://localhost/api/admin/payments?page=1&pageSize=20"
    );
    const res = await GET(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data).toHaveLength(1);
    expect(json.data[0]).toMatchObject({
      id: "pay-1",
      bookingRef: "DS-BOOK-1",
      provider: "RAZORPAY",
      transactionId: "txn-1",
      status: "PAID",
    });
    expect(json.pagination).toMatchObject({
      page: 1,
      pageSize: 20,
      total: 1,
      totalPages: 1,
    });
  });
});
