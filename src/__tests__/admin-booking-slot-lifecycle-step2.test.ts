import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock, verifyAdminSessionTokenMock } = vi.hoisted(() => ({
  prismaMock: {
    $transaction: vi.fn(),
  },
  verifyAdminSessionTokenMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: prismaMock,
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: vi.fn((key: string) =>
      key === "ds_admin_session" ? { value: "admin-session-token" } : undefined
    ),
    set: vi.fn(),
  })),
}));

vi.mock("@/services/auth/adminSession.server", () => ({
  verifyAdminSessionToken: verifyAdminSessionTokenMock,
}));

vi.mock("@/services/auth/adminAuth.server", () => ({
  getAuthenticatedAdminIdFromCookies: vi.fn(async () => "admin_1"),
}));

vi.mock("razorpay", () => ({
  default: class RazorpayMock {
    orders = {
      create: vi.fn(),
    };
  },
}));

vi.mock("@/lib/slot-time", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/slot-time")>();
  return {
    ...actual,
    isSlotExpiredInIST: vi.fn(() => false),
  };
});

vi.mock("@/services/email.service", () => ({
  sendEmail: vi.fn(async () => undefined),
}));

vi.mock("@/services/whatsapp.service", () => ({
  sendBookingConfirmationWhatsApp: vi.fn(async () => undefined),
}));

vi.mock("@/emails/BookingConfirmationEmail", () => ({
  default: vi.fn(() => null),
}));

vi.mock("@/services/booking/bookingSession.server", () => ({
  createBookingSessionToken: vi.fn(() => "booking-session-token"),
}));

import { POST as adminCreateBookingPOST } from "@/app/api/admin/bookings/create/route";
import { PATCH as adminPatchBooking } from "@/app/api/admin/bookings/[id]/route";

function mockTransaction(tx: Record<string, unknown>) {
  prismaMock.$transaction.mockImplementation(
    async (cb: (arg: Record<string, unknown>) => Promise<unknown>) => cb(tx)
  );
}

describe("Step 2: Admin Booking Slot Lifecycle Safety", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    verifyAdminSessionTokenMock.mockReturnValue({
      userId: "admin_1",
      role: "ADMIN",
    });
  });

  it("POST /api/admin/bookings/create returns SLOT_UNAVAILABLE when selected slot is BOOKED in DB", async () => {
    mockTransaction({
      slot: {
        findUnique: vi.fn().mockResolvedValue({
          id: "slot_new",
          theatreId: "theatre_1",
          date: new Date("2026-03-05T18:30:00.000Z"), // IST => 2026-03-06
          startTime: "13:00",
          endTime: "16:00",
          status: "BOOKED",
          theatre: {
            id: "theatre_1",
            locationId: "loc_1",
            capacity: 6,
          },
        }),
      },
    });

    const req = new Request("http://localhost/api/admin/bookings/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: "CREATE",
        locationId: "loc_1",
        date: "2026-03-06",
        theatreId: "theatre_1",
        slotId: "slot_new",
        customer: {
          name: "Om",
          phone: "6201000000",
          email: "om@gmail.com",
        },
        guestCount: 2,
        decorationRequired: false,
        items: [],
        payment: {
          type: "OFFLINE",
          amountMode: "FULL",
          offlineMethod: "CASH",
          offlineReference: "",
        },
      }),
    });

    const res = await adminCreateBookingPOST(req);
    const json = await res.json();

    expect(res.status).toBe(409);
    expect(json).toMatchObject({
      success: false,
      code: "SLOT_UNAVAILABLE",
      message: "Selected slot is no longer available.",
    });
  });

  it("PATCH /api/admin/bookings/[id] returns SLOT_UNAVAILABLE when slot is changed to DB-BOOKED slot", async () => {
    mockTransaction({
      booking: {
        findUnique: vi.fn().mockResolvedValue({
          id: "booking_1",
          bookingStatus: "CONFIRMED",
          paymentStatus: "PAID",
          remainingPayable: 0,
          slotId: "slot_old",
          slot: {
            id: "slot_old",
            startTime: "09:30",
            endTime: "12:30",
            date: new Date("2026-03-05T18:30:00.000Z"),
            status: "BOOKED",
          },
          theatre: {
            id: "theatre_1",
            baseGuests: 4,
            extraPersonPrice: 300,
            decorationPrice: 750,
            advanceAmount: 750,
          },
          items: [],
          cancelledReason: null,
        }),
      },
      slot: {
        findUnique: vi.fn().mockResolvedValue({
          id: "slot_new",
          theatreId: "theatre_1",
          date: new Date("2026-03-05T18:30:00.000Z"), // IST => 2026-03-06
          startTime: "13:00",
          endTime: "16:00",
          status: "BOOKED",
          theatre: {
            id: "theatre_1",
            locationId: "loc_1",
            capacity: 6,
          },
        }),
      },
    });

    const req = new Request("http://localhost/api/admin/bookings/booking_1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        locationId: "loc_1",
        date: "2026-03-06",
        theatreId: "theatre_1",
        slotId: "slot_new",
        customer: {
          name: "Om",
          phone: "6201000000",
          email: "om@gmail.com",
        },
        guestCount: 2,
        decorationRequired: false,
        occasionKey: "BIRTHDAY",
        occasionData: {
          celebrant_name: "Om",
        },
        items: [],
        payment: {
          type: "OFFLINE",
          amountMode: "FULL",
          advanceAmount: 0,
          offlineMethod: "CASH",
          offlineReference: "",
          paymentStatus: "PAID",
        },
      }),
    });

    const res = await adminPatchBooking(req, {
      params: Promise.resolve({ id: "booking_1" }),
    });
    const json = await res.json();

    expect(res.status).toBe(409);
    expect(json).toMatchObject({
      success: false,
      code: "SLOT_UNAVAILABLE",
      message: "Selected slot is no longer available.",
    });
  });
});
