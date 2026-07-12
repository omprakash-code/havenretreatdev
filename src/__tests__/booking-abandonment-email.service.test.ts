import { describe, expect, it, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    booking: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
  },
}));

const { sendEmailMock } = vi.hoisted(() => ({
  sendEmailMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: prismaMock,
}));

vi.mock("@/services/email.service", () => ({
  sendEmail: sendEmailMock,
}));

vi.mock("@/services/booking/booking-notification-recipients.service", () => ({
  resolveAdminBookingNotificationRecipients: () => ["admin@example.com"],
}));

import { prisma } from "@/lib/db";
import { sendEmail } from "@/services/email.service";
import { notifyAbandonedBookingsByIds } from "@/services/booking/booking-abandonment-email.service";

describe("notifyAbandonedBookingsByIds", () => {
  it("does not send abandonment emails while recovery workflow is paused", async () => {
    const result = await notifyAbandonedBookingsByIds(["booking-1"]);

    expect(result).toEqual({ notifiedBookingIds: [] });
    expect(prisma.booking.findMany).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });
});
