// Regression coverage for extra-hour pricing being dropped on admin edit.
//
// A 6h booking on a 4h package bills 2 extra hours. The admin edit route used
// to call calculateBookingPricing() without durationHours / includedDurationHours
// / extraHourlyRate, so those defaulted to 0 and the recalculated total silently
// collapsed to the bare package price — while the merged-over pricing snapshot
// kept advertising the extra hours as a line item.
//
// These tests drive the real route handlers and the real pricing module: only
// I/O and notification boundaries are mocked, so the pricing inputs each flow
// passes are genuinely exercised.

import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock, evaluateAdminCouponsMock, persistAdminBookingCouponsMock } =
  vi.hoisted(() => ({
    prismaMock: { $transaction: vi.fn() },
    evaluateAdminCouponsMock: vi.fn(),
    persistAdminBookingCouponsMock: vi.fn(),
  }));

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  after: vi.fn(),
}));

vi.mock("@/services/auth/adminAuth.server", () => ({
  getAuthenticatedAdminIdFromCookies: vi.fn().mockResolvedValue("admin-1"),
}));

// Keep the real range normalization (it derives the booked duration from the
// requested times, which is exactly what the pricing inputs depend on) and stub
// only the availability lookup.
vi.mock("@/services/booking/admin-range-booking.service", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/services/booking/admin-range-booking.service")>();
  return {
    ...actual,
    validateAdminRangeBooking: vi.fn(
      async (
        _tx: unknown,
        input: Parameters<typeof actual.normalizeAdminRange>[0]
      ) => ({ range: actual.normalizeAdminRange(input) })
    ),
    acquireAdminRangeTransactionLock: vi.fn().mockResolvedValue(undefined),
  };
});

vi.mock("@/app/api/admin/bookings/_coupon", () => ({
  evaluateAdminCoupons: evaluateAdminCouponsMock,
  persistAdminBookingCoupons: persistAdminBookingCouponsMock,
}));

vi.mock("@/services/booking/bookingId.service", () => ({
  allocateBookingRef: vi.fn().mockResolvedValue("HR-TEST-0001"),
}));

vi.mock("@/services/booking/successToken.server", () => ({
  createSuccessToken: vi.fn().mockReturnValue("success-token"),
}));

vi.mock("@/services/booking/bookingSession.server", () => ({
  createBookingSessionToken: vi.fn().mockReturnValue("session-token"),
}));

vi.mock("@/lib/square/server", () => ({
  createSquarePaymentLink: vi.fn(),
  getSquareCurrency: vi.fn().mockReturnValue("USD"),
  SquareServerError: class SquareServerError extends Error {
    status = 500;
  },
}));

// Notification boundaries — irrelevant to pricing, noisy if left live.
vi.mock("@/services/booking/booking-confirmation-email.service", () => ({
  sendBookingConfirmationEmail: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/services/booking/booking-review-email.service", () => ({
  sendBookingApprovedEmail: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/services/booking/admin-booking-confirmation-email.service", () => ({
  sendAdminBookingConfirmationEmail: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/services/booking/booking-payment-link-email.service", () => ({
  sendBookingPaymentLinkEmail: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/services/booking/booking-abandonment-email.service", () => ({
  notifyAbandonedBookingsByIds: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/services/whatsapp.service", () => ({
  buildCustomerBookingWhatsAppMessage: vi.fn().mockReturnValue(""),
  isBookingConfirmationWhatsAppEnabled: vi.fn().mockReturnValue(false),
  sendBookingConfirmationWhatsApp: vi.fn().mockResolvedValue(undefined),
  sendWhatsAppMessage: vi.fn().mockResolvedValue(undefined),
}));

import { PATCH } from "@/app/api/admin/bookings/[id]/route";
import { POST as CREATE } from "@/app/api/admin/bookings/create/route";
import { createOrReplaceVenueBookingSession } from "@/services/booking/venue-booking-session.service";
import { after } from "next/server";
import { sendAdminBookingConfirmationEmail } from "@/services/booking/admin-booking-confirmation-email.service";
import { sendBookingConfirmationEmail } from "@/services/booking/booking-confirmation-email.service";
import { sendBookingApprovedEmail } from "@/services/booking/booking-review-email.service";

// ─── Fixtures: the Premium package from the reported booking ────────────────

const PACKAGE = {
  id: "pkg-premium",
  venueId: "venue-1",
  locationId: "loc-1",
  name: "Premium Package",
  slug: "premium",
  shortDescription: "Premium event",
  isActive: true,
  guestLimit: 40,
  eventDurationHours: 4,
  complimentarySetupHours: 1,
  rentalAmount: 600,
  decorationAmount: 141,
  decorationAddonPrice: 100,
  decorationDefault: false,
  cleaningAmount: 100,
  subtotalAmount: 841,
  hourlyRate: 150,
  features: [],
  venue: { id: "venue-1", name: "Haven Retreat", slug: "haven", maxGuests: 60 },
};

const PACKAGE_AMOUNT = 841;
const EXTRA_HOURLY_RATE = 150;
const EXTRA_HOURS = 2;
const EXTRA_HOURS_AMOUNT = EXTRA_HOURLY_RATE * EXTRA_HOURS; // 300
const EXPECTED_TOTAL = PACKAGE_AMOUNT + EXTRA_HOURS_AMOUNT; // 1141

const EVENT_DATE = "2030-07-15";
const START_TIME = "09:00";
const END_TIME_6H = "15:00";
const END_TIME_5H = "14:00";

// A booking already priced correctly at 6 hours, as both create flows leave it.
function existingSixHourBooking() {
  return {
    id: "booking-1",
    bookingRef: "HR-TEST-0001",
    venueId: PACKAGE.venueId,
    packageId: PACKAGE.id,
    userId: null,
    contactName: "Regression Customer",
    contactPhone: "9998887777",
    contactEmail: "regression@example.com",
    bookingStatus: "APPROVED",
    paymentStatus: "INITIALIZED",
    createdByRole: "ADMIN",
    createdByAdminId: "admin-1",
    cancelledReason: null,
    eventDate: new Date(`${EVENT_DATE}T00:00:00.000Z`),
    eventStartTime: START_TIME,
    eventEndTime: END_TIME_6H,
    timezone: "America/New_York",
    guestCount: PACKAGE.guestLimit,
    decorationRequired: false,
    baseAmount: EXPECTED_TOTAL,
    extrasAmount: 0,
    productsAmount: 0,
    additionalChargeAmount: 0,
    additionalChargeReason: null,
    decorationAmount: 0,
    discountAmount: 0,
    totalAmount: EXPECTED_TOTAL,
    advancePaid: 150,
    remainingPayable: EXPECTED_TOTAL - 150,
    eventPackage: {
      name: PACKAGE.name,
      eventDurationHours: PACKAGE.eventDurationHours,
      hourlyRate: PACKAGE.hourlyRate,
      guestLimit: PACKAGE.guestLimit,
      venueId: PACKAGE.venueId,
      venue: { maxGuests: PACKAGE.venue.maxGuests },
    },
    packageSnapshot: {
      id: PACKAGE.id,
      guestLimit: PACKAGE.guestLimit,
      eventDurationHours: PACKAGE.eventDurationHours,
      subtotalAmount: PACKAGE_AMOUNT,
      decorationAddonPrice: PACKAGE.decorationAddonPrice,
      extraPersonPrice: 0,
    },
    pricingSnapshot: {
      packageAmount: PACKAGE_AMOUNT,
      packageGuestLimit: PACKAGE.guestLimit,
      includedDurationHours: PACKAGE.eventDurationHours,
      bookedDurationHours: 6,
      extraDurationHours: EXTRA_HOURS,
      extraHourlyRate: EXTRA_HOURLY_RATE,
      extraDurationAmount: EXTRA_HOURS_AMOUNT,
      extraGuestPrice: 0,
      extraGuestAmount: 0,
      productsAmount: 0,
      additionalChargeAmount: 0,
      decorationAmount: 0,
      discountAmount: 0,
      totalAmount: EXPECTED_TOTAL,
      advancePaid: 150,
      remainingPayable: EXPECTED_TOTAL - 150,
    },
    items: [],
    occasionData: null,
    occasionKey: null,
    occasionLabel: null,
    specialInstructions: null,
    lockVersion: 1,
  };
}

function makeTx(overrides: Record<string, unknown> = {}) {
  return {
    booking: {
      findUnique: vi.fn().mockResolvedValue(existingSixHourBooking()),
      findFirst: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn().mockResolvedValue({ id: "booking-1", bookingRef: "HR-TEST-0001" }),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      create: vi.fn().mockResolvedValue({ id: "booking-1", bookingRef: "HR-TEST-0001" }),
    },
    bookingItem: {
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      createMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    eventPackage: {
      findFirst: vi.fn().mockResolvedValue(PACKAGE),
      findUnique: vi.fn().mockResolvedValue(PACKAGE),
    },
    product: { findMany: vi.fn().mockResolvedValue([]) },
    productVariant: {
      findMany: vi.fn().mockResolvedValue([]),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    payment: {
      create: vi.fn().mockResolvedValue({}),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    user: { findUnique: vi.fn().mockResolvedValue(null) },
    occasion: { findFirst: vi.fn().mockResolvedValue(null) },
    couponUsage: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
    // Advance-payment config; everything else falls back to defaults.
    appSetting: {
      findUnique: vi.fn().mockResolvedValue({ value: "150" }),
      findMany: vi.fn().mockResolvedValue([]),
    },
    $queryRaw: vi.fn().mockResolvedValue([{ id: "booking-1" }]),
    ...overrides,
  };
}

function withTx(tx: ReturnType<typeof makeTx>) {
  prismaMock.$transaction.mockImplementation((cb: (t: typeof tx) => Promise<unknown>) =>
    cb(tx)
  );
  return tx;
}

function adminBookingPayload(overrides: Record<string, unknown> = {}) {
  return {
    locationId: PACKAGE.locationId,
    venueId: PACKAGE.venueId,
    packageId: PACKAGE.id,
    date: EVENT_DATE,
    startTime: START_TIME,
    endTime: END_TIME_6H,
    customer: {
      name: "Regression Customer",
      phone: "9998887777",
      email: "regression@example.com",
    },
    guestCount: PACKAGE.guestLimit,
    decorationRequired: false,
    items: [],
    couponCodes: [],
    additionalChargeAmount: 0,
    payment: {
      type: "OFFLINE",
      amountMode: "ADVANCE",
      advanceAmount: 150,
      offlineMethod: "CASH",
    },
    ...overrides,
  };
}

async function patchBooking(body: Record<string, unknown>) {
  return PATCH(
    new Request("http://localhost/api/admin/bookings/booking-1", {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id: "booking-1" }) }
  );
}

// The persisted pricing of the booking.update / booking.create call.
function persistedPricing(call: { data: Record<string, unknown> }) {
  const data = call.data;
  return {
    baseAmount: Number(data.baseAmount),
    totalAmount: Number(data.totalAmount),
    snapshot: data.pricingSnapshot as Record<string, number>,
  };
}

describe("extra-hour pricing survives every booking flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    evaluateAdminCouponsMock.mockResolvedValue({ totalDiscount: 0, coupons: [] });
    persistAdminBookingCouponsMock.mockResolvedValue(undefined);
  });

  it("customer create: a 6h booking bills 2 extra hours at $300", async () => {
    const tx = withTx(makeTx({ booking: { ...makeTx().booking, findUnique: vi.fn().mockResolvedValue(null) } }));

    await createOrReplaceVenueBookingSession(
      {
        packageId: PACKAGE.id,
        eventDate: EVENT_DATE,
        startTime: START_TIME,
        endTime: END_TIME_6H,
      },
      "guest-1",
      null
    );

    const created = tx.booking.create.mock.calls[0][0];
    const snapshot = created.data.pricingSnapshot;

    expect(snapshot.extraDurationHours).toBe(EXTRA_HOURS);
    expect(snapshot.extraDurationAmount).toBe(EXTRA_HOURS_AMOUNT);
    expect(Number(created.data.baseAmount)).toBe(EXPECTED_TOTAL);
    expect(Number(created.data.totalAmount)).toBe(EXPECTED_TOTAL);
  });

  it("admin create: a 6h booking bills 2 extra hours at $300", async () => {
    const tx = withTx(makeTx());

    const res = await CREATE(
      new Request("http://localhost/api/admin/bookings/create", {
        method: "POST",
        body: JSON.stringify({ mode: "CREATE", ...adminBookingPayload() }),
      })
    );
    expect(res.status).toBe(200);

    const { baseAmount, totalAmount, snapshot } = persistedPricing(
      tx.booking.create.mock.calls[0][0]
    );

    expect(snapshot.extraDurationHours).toBe(EXTRA_HOURS);
    expect(snapshot.extraDurationAmount).toBe(EXTRA_HOURS_AMOUNT);
    expect(baseAmount).toBe(EXPECTED_TOTAL);
    expect(totalAmount).toBe(EXPECTED_TOTAL);
  });

  it("admin create pay-later sends confirmation emails, not the review approval email", async () => {
    const tx = withTx(makeTx());
    vi.mocked(sendBookingConfirmationEmail).mockResolvedValueOnce(true);
    const notificationBooking = {
      ...existingSixHourBooking(),
      venue: { city: "Miami", name: "Haven Retreat" },
      items: [],
      payment: [],
    };
    const notificationBookingUpdate = vi.fn().mockResolvedValue(notificationBooking);
    Object.assign(prismaMock, {
      booking: {
        findUnique: vi.fn().mockResolvedValue(notificationBooking),
        update: notificationBookingUpdate,
      },
    });

    const res = await CREATE(
      new Request("http://localhost/api/admin/bookings/create", {
        method: "POST",
        body: JSON.stringify({
          mode: "CREATE",
          ...adminBookingPayload({
            payment: {
              type: "OFFLINE",
              collectNow: false,
              amountMode: "ADVANCE",
              advanceAmount: 0,
            },
          }),
        }),
      })
    );
    expect(res.status).toBe(200);

    const afterCallback = vi.mocked(after).mock.calls.at(-1)?.[0];
    expect(afterCallback).toBeTypeOf("function");
    await (afterCallback as () => Promise<void>)();

    expect(tx.payment.create).not.toHaveBeenCalled();
    expect(sendBookingApprovedEmail).not.toHaveBeenCalled();
    expect(sendBookingConfirmationEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "regression@example.com",
        bookingRef: "HR-TEST-0001",
        subject: "Your Haven Retreat booking has been booked – HR-TEST-0001",
      })
    );
    expect(sendAdminBookingConfirmationEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        bookingRef: "HR-TEST-0001",
        confirmationSource: "ADMIN_OFFLINE_CREATE",
      })
    );
    expect(notificationBookingUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "booking-1" },
        data: { confirmationEmailSent: true },
      })
    );
  });

  it("admin edit: editing unrelated fields keeps the extra hours in the total", async () => {
    const tx = withTx(makeTx());

    const res = await patchBooking(
      adminBookingPayload({
        customer: {
          name: "Renamed Customer",
          phone: "9998887766",
          email: "renamed@example.com",
        },
        specialInstructions: "Set the projector up early.",
        payment: {
          type: "OFFLINE",
          amountMode: "ADVANCE",
          advanceAmount: 150,
          offlineMethod: "CASH",
          paymentStatus: "PAID",
        },
      })
    );
    expect(res.status).toBe(200);

    const { baseAmount, totalAmount, snapshot } = persistedPricing(
      tx.booking.update.mock.calls[0][0]
    );

    // The regression: these were 841 / 841 with a snapshot still advertising
    // $300 of extra hours.
    expect(snapshot.extraDurationHours).toBe(EXTRA_HOURS);
    expect(snapshot.extraDurationAmount).toBe(EXTRA_HOURS_AMOUNT);
    expect(snapshot.extraHourlyRate).toBe(EXTRA_HOURLY_RATE);
    expect(baseAmount).toBe(EXPECTED_TOTAL);
    expect(totalAmount).toBe(EXPECTED_TOTAL);

    // The unrelated edit still applied.
    const data = tx.booking.update.mock.calls[0][0].data;
    expect(data.contactName).toBe("Renamed Customer");
    expect(data.specialInstructions).toBe("Set the projector up early.");
  });

  it("admin edit: the persisted snapshot stays internally consistent", async () => {
    const tx = withTx(makeTx());

    await patchBooking(adminBookingPayload());
    const { baseAmount, totalAmount, snapshot } = persistedPricing(
      tx.booking.update.mock.calls[0][0]
    );

    // Package + extra hours is what the drawer renders as the total; a merged
    // snapshot used to leave these disagreeing.
    expect(snapshot.packageAmount + snapshot.extraDurationAmount).toBe(baseAmount);
    expect(snapshot.totalAmount).toBe(totalAmount);
    expect(snapshot.extraDurationAmount).toBe(
      snapshot.extraHourlyRate * snapshot.extraDurationHours
    );
    expect(snapshot.bookedDurationHours).toBe(6);
    expect(snapshot.includedDurationHours).toBe(PACKAGE.eventDurationHours);
  });

  it("admin edit: shortening 6h to 5h reprices down to a single extra hour", async () => {
    const tx = withTx(makeTx());

    const res = await patchBooking(adminBookingPayload({ endTime: END_TIME_5H }));
    expect(res.status).toBe(200);

    const { baseAmount, totalAmount, snapshot } = persistedPricing(
      tx.booking.update.mock.calls[0][0]
    );

    expect(snapshot.extraDurationHours).toBe(1);
    expect(snapshot.extraDurationAmount).toBe(EXTRA_HOURLY_RATE);
    expect(baseAmount).toBe(PACKAGE_AMOUNT + EXTRA_HOURLY_RATE);
    expect(totalAmount).toBe(PACKAGE_AMOUNT + EXTRA_HOURLY_RATE);
  });
});
