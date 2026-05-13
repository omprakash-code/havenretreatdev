import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    booking: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

const { getAuthenticatedAdminIdFromCookiesMock } = vi.hoisted(() => ({
  getAuthenticatedAdminIdFromCookiesMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: prismaMock,
}));

vi.mock("@/services/auth/adminAuth.server", () => ({
  getAuthenticatedAdminIdFromCookies: getAuthenticatedAdminIdFromCookiesMock,
}));

import { prisma } from "@/lib/db";
import { GET } from "@/app/api/admin/bookings/route";

describe("GET /api/admin/bookings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAuthenticatedAdminIdFromCookiesMock.mockResolvedValue("admin-1");
    (
      prisma.booking.count as unknown as ReturnType<typeof vi.fn>
    ).mockResolvedValue(1);
    (
      prisma.booking.findMany as unknown as ReturnType<typeof vi.fn>
    ).mockResolvedValue([
      {
        id: "booking-live-1",
        bookingRef: "DS090320260011",
        contactName: "Mansi Singh",
        contactPhone: "8076619794",
        contactEmail: null,
        guestCount: 2,
        baseAmount: 2896,
        extrasAmount: 0,
        productsAmount: 0,
        decorationAmount: 0,
        discountAmount: 0,
        totalAmount: 2896,
        advancePaid: 0,
        remainingPayable: 2896,
        paymentStatus: null,
        bookingStatus: "INCOMPLETE",
        cancelledReason: null,
        createdAt: new Date("2026-03-09T07:48:00.000Z"),
        theatre: {
          id: "theatre-1",
          name: "Theatre 1",
        },
        slot: {
          date: new Date("2026-03-21T00:00:00.000Z"),
          startTime: "14:30",
          endTime: "17:30",
          status: "LOCKED",
        },
      },
    ]);
    (
      prisma.$transaction as unknown as ReturnType<typeof vi.fn>
    ).mockImplementation(async (operations: unknown[]) => Promise.all(operations));
  });

  it("filters live bookings by active lock window", async () => {
    const res = await GET(
      new Request("http://localhost/api/admin/bookings?type=live")
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(1);
    expect(body.data[0]).toMatchObject({
      bookingRef: "DS090320260011",
      bookingStatus: "INCOMPLETE",
      slot: {
        status: "LOCKED",
      },
    });

    expect(prisma.booking.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([
            expect.objectContaining({
              AND: expect.arrayContaining([
                {
                  bookingStatus: {
                    in: ["INCOMPLETE", "AWAITING_PAYMENT", "PAYMENT_PROCESSING"],
                  },
                },
                {
                  slot: {
                    status: "LOCKED",
                    lockExpiresAt: {
                      gt: expect.any(Date),
                    },
                  },
                },
              ]),
            }),
          ]),
        }),
      })
    );
  });

  it("builds abandoned view as not-live and not-confirmed", async () => {
    await GET(
      new Request("http://localhost/api/admin/bookings?type=abandoned")
    );

    expect(prisma.booking.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([
            expect.objectContaining({
              AND: expect.arrayContaining([
                {
                  bookingStatus: {
                    notIn: ["CONFIRMED", "PAID_EXPIRED"],
                  },
                },
                expect.objectContaining({
                  NOT: expect.objectContaining({
                    AND: expect.arrayContaining([
                      {
                        bookingStatus: {
                          in: ["INCOMPLETE", "AWAITING_PAYMENT", "PAYMENT_PROCESSING"],
                        },
                      },
                      {
                        slot: {
                          status: "LOCKED",
                          lockExpiresAt: {
                            gt: expect.any(Date),
                          },
                        },
                      },
                    ]),
                  }),
                }),
              ]),
            }),
          ]),
        }),
      })
    );
  });

  it("returns 401 when admin is not authenticated", async () => {
    getAuthenticatedAdminIdFromCookiesMock.mockResolvedValue(null);

    const res = await GET(
      new Request("http://localhost/api/admin/bookings?type=live")
    );
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body).toMatchObject({
      success: false,
      message: "Unauthorized",
    });
    expect(prisma.booking.findMany).not.toHaveBeenCalled();
  });
});
