import { beforeEach, describe, expect, it, vi } from "vitest";

const { sendEmailMock, findManyMock, updateMock } = vi.hoisted(() => ({
  sendEmailMock: vi.fn(),
  findManyMock: vi.fn(),
  updateMock: vi.fn(),
}));

vi.mock("@/services/email.service", () => ({
  sendEmail: sendEmailMock,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    booking: {
      findMany: findManyMock,
      update: updateMock,
    },
  },
}));

import { notifyAbandonedBookingsByIds } from "@/services/booking/booking-abandonment-email.service";

describe("booking-abandonment-email.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.BOOKING_ADMIN_NOTIFICATION_EMAILS = "admin@example.com";
    process.env.NEXT_PUBLIC_APP_URL = "https://example.com";
    updateMock.mockResolvedValue({});
  });

  it("does not send when contact data is missing", async () => {
    findManyMock.mockResolvedValue([
      {
        id: "booking-1",
        bookingRef: "DS-BOOK-1",
        bookingStatus: "ABANDONED",
        contactName: null,
        contactPhone: null,
        contactEmail: null,
        guestCount: 2,
        occasionLabel: null,
        occasionData: null,
        cancelledReason: "SESSION_EXPIRED",
        cancelledAt: new Date("2026-03-02T10:00:00.000Z"),
        theatre: {
          name: "Theatre 1",
          location: { name: "Pitampura" },
        },
        items: [],
        slot: {
          date: new Date("2026-03-05T00:00:00.000Z"),
          startTime: "10:00",
          endTime: "11:00",
        },
      },
    ]);

    await notifyAbandonedBookingsByIds(["booking-1"]);

    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it("sends user and admin emails when contact data exists", async () => {
    findManyMock.mockResolvedValue([
      {
        id: "booking-2",
        bookingRef: "DS-BOOK-2",
        bookingStatus: "ABANDONED",
        contactName: "Demo User",
        contactPhone: "9999999999",
        contactEmail: "demo@example.com",
        guestCount: 2,
        occasionLabel: null,
        occasionData: null,
        cancelledReason: "SESSION_EXPIRED",
        cancelledAt: new Date("2026-03-02T10:00:00.000Z"),
        theatre: {
          name: "Theatre 2",
          location: { name: "Noida" },
        },
        items: [],
        slot: {
          date: new Date("2026-03-05T00:00:00.000Z"),
          startTime: "11:00",
          endTime: "12:00",
        },
      },
    ]);

    const result = await notifyAbandonedBookingsByIds(["booking-2"]);

    expect(result).toEqual({ notifiedBookingIds: ["booking-2"] });
    expect(sendEmailMock).toHaveBeenCalledTimes(2);
    expect(updateMock).toHaveBeenCalledTimes(1);
  });
});
