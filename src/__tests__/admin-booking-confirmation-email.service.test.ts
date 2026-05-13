import { beforeEach, describe, expect, it, vi } from "vitest";

const { sendEmailMock, findBookingMock } = vi.hoisted(() => ({
  sendEmailMock: vi.fn(),
  findBookingMock: vi.fn(),
}));

vi.mock("@/services/email.service", () => ({
  sendEmail: sendEmailMock,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    booking: {
      findUnique: findBookingMock,
    },
  },
}));

import {
  sendAdminBookingConfirmationEmail,
  sendAdminBookingConfirmationEmailByBookingId,
} from "@/services/booking/admin-booking-confirmation-email.service";

const baseEmailData = {
  bookingRef: "DS-BOOK-100",
  customerName: "Demo User",
  customerPhone: "9999999999",
  theatreName: "Theatre 1",
  locationName: "Pitampura",
  date: "Mon, 02 Mar 2026",
  timeSlot: "10:00 - 11:00",
  guestCount: 2,
  totalAmount: 2000,
  advancePaid: 750,
  remainingPayable: 1250,
  successUrl: "https://example.com/booking/success",
};

describe("admin-booking-confirmation-email.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.BOOKING_ADMIN_NOTIFICATION_EMAILS;
    delete process.env.ADMIN_NOTIFICATION_EMAILS;
    delete process.env.ADMIN_EMAILS;
  });

  it("sends admin confirmation email to configured recipients", async () => {
    process.env.BOOKING_ADMIN_NOTIFICATION_EMAILS = "admin1@example.com,admin2@example.com";

    const result = await sendAdminBookingConfirmationEmail({
      bookingRef: "DS-BOOK-100",
      emailData: baseEmailData,
      confirmationSource: "ONLINE_PAYMENT_VERIFY",
    });

    expect(result).toEqual({ sentCount: 2 });
    expect(sendEmailMock).toHaveBeenCalledTimes(2);
  });

  it("returns without sending when no admin recipients are configured", async () => {
    const result = await sendAdminBookingConfirmationEmail({
      bookingRef: "DS-BOOK-100",
      emailData: baseEmailData,
    });

    expect(result).toEqual({ sentCount: 0 });
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it("builds and sends from booking id when booking is confirmed", async () => {
    process.env.BOOKING_ADMIN_NOTIFICATION_EMAILS = "admin@example.com";
    process.env.NEXT_PUBLIC_APP_URL = "https://example.com";
    findBookingMock.mockResolvedValue({
      id: "booking-1",
      bookingRef: "DS-BOOK-200",
      bookingStatus: "CONFIRMED",
      contactName: "Demo User",
      contactPhone: "9999999999",
      contactEmail: "demo@example.com",
      guestCount: 2,
      paymentStatus: "PAID",
      razorpayPaymentId: "pay_123",
      totalAmount: 3000,
      advancePaid: 1000,
      remainingPayable: 2000,
      theatre: {
        name: "Theatre 2",
        location: { name: "Noida" },
      },
      occasionData: null,
      slot: {
        date: new Date("2026-03-02T00:00:00.000Z"),
        startTime: "12:00",
        endTime: "13:00",
      },
      items: [],
      payment: [
        {
          provider: "RAZORPAY",
          method: "ONLINE",
          status: "PAID",
          transactionId: "pay_123",
        },
      ],
    });

    const result = await sendAdminBookingConfirmationEmailByBookingId(
      "booking-1",
      "ADMIN_COLLECT_ONLINE_VERIFY"
    );

    expect(result).toEqual({ sentCount: 1 });
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
  });
});
