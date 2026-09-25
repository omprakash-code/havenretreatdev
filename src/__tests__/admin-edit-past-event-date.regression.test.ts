// Regression coverage for editing a booking whose event date has passed.
//
// The Edit Booking date picker used the new-booking rule `min = today`, so the
// browser refused to submit an existing APPROVED booking once its event was
// over ("Value must be 25/09/2026 or later.") — the admin could not record the
// balance payment without moving the booking to a future date.
//
// The date rule is now: a new booking starts today; an existing booking may
// keep the date it already holds; any other past date is still rejected. The
// server never had a past-date rule, so these tests also pin that an unchanged
// past date round-trips through the real range validation, and that changing
// the date still runs the conflict and business-hours checks.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  ADMIN_BOOKING_PAST_DATE_MESSAGE,
  getAdminBookingDateError,
  getAdminBookingMinDate,
} from "@/components/admin/bookings/add/shared";
import { getSubmitBlockerMessage } from "@/components/admin/bookings/add/sections/bookingSummary.helpers";
import { localBookingTimeToUtc, toBookingDate } from "@/lib/booking-range";

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

// validateAdminRangeBooking stays REAL: it is the server-side date/slot rule
// set, and these tests exist to prove what it does and does not reject.

vi.mock("@/app/api/admin/bookings/_coupon", () => ({
  evaluateAdminCoupons: evaluateAdminCouponsMock,
  persistAdminBookingCoupons: persistAdminBookingCouponsMock,
}));

vi.mock("@/services/booking/successToken.server", () => ({
  createSuccessToken: vi.fn().mockReturnValue("success-token"),
}));

vi.mock("@/lib/square/server", () => ({
  createSquarePaymentLink: vi.fn(),
  getSquareCurrency: vi.fn().mockReturnValue("USD"),
  SquareServerError: class SquareServerError extends Error {
    status = 500;
  },
}));

vi.mock("@/services/booking/booking-payment-link-email.service", () => ({
  sendBookingPaymentLinkEmail: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/services/booking/booking-abandonment-email.service", () => ({
  notifyAbandonedBookingsByIds: vi.fn().mockResolvedValue(undefined),
}));

import { PATCH } from "@/app/api/admin/bookings/[id]/route";

// ─── Fixtures: the reported booking, after its event ────────────────────────

const TIMEZONE = "America/New_York";
const TODAY = "2026-09-25";
// Mid-afternoon in the venue timezone on TODAY.
const NOW = new Date("2026-09-25T18:00:00.000Z");

const PAST_DATE = "2026-08-20";
const OTHER_PAST_DATE = "2026-09-01";
const FUTURE_DATE = "2026-10-10";
const START_TIME = "09:00";
const END_TIME = "13:00";

const PACKAGE_AMOUNT = 841;
const ADVANCE_PAID = 200;

const VARIANT = {
  id: "variant-balloons",
  productId: "product-balloons",
  label: "Standard",
  salePrice: null,
  regularPrice: 25,
  isActive: true,
  stock: 10,
  product: {
    id: "product-balloons",
    name: "Balloon Arch",
    slug: "balloon-arch",
    category: "DECORATION",
    isActive: true,
    locationId: null,
  },
};
const ITEM_QTY = 2;
const ITEMS_AMOUNT = VARIANT.regularPrice * ITEM_QTY; // 50
const TOTAL = PACKAGE_AMOUNT + ITEMS_AMOUNT; // 891

function range(date: string, start = START_TIME, end = END_TIME) {
  const startsAtUtc = localBookingTimeToUtc(date, start, TIMEZONE);
  const endsAtUtc = localBookingTimeToUtc(date, end, TIMEZONE);
  return {
    eventDate: toBookingDate(date, TIMEZONE),
    startsAtUtc,
    endsAtUtc,
    occupiedUntilUtc: new Date(endsAtUtc.getTime() + 30 * 60_000),
  };
}

function pastApprovedBooking(overrides: Record<string, unknown> = {}) {
  return {
    id: "booking-1",
    bookingRef: "HR0814202600056",
    venueId: "venue-1",
    packageId: "pkg-premium",
    userId: null,
    contactName: "Past Event Customer",
    contactPhone: "8285815666",
    contactEmail: "past@example.com",
    bookingStatus: "APPROVED",
    paymentStatus: "PAID",
    createdByRole: "ADMIN",
    createdByAdminId: "admin-1",
    cancelledReason: null,
    ...range(PAST_DATE),
    eventStartTime: START_TIME,
    eventEndTime: END_TIME,
    timezone: TIMEZONE,
    guestCount: 40,
    decorationRequired: false,
    baseAmount: PACKAGE_AMOUNT,
    extrasAmount: 0,
    productsAmount: ITEMS_AMOUNT,
    additionalChargeAmount: 0,
    additionalChargeReason: null,
    decorationAmount: 0,
    discountAmount: 0,
    totalAmount: TOTAL,
    advancePaid: ADVANCE_PAID,
    remainingPayable: TOTAL - ADVANCE_PAID,
    eventPackage: {
      name: "Premium Package",
      eventDurationHours: 4,
      hourlyRate: 150,
      guestLimit: 40,
      venueId: "venue-1",
      venue: { maxGuests: 60 },
    },
    packageSnapshot: {
      id: "pkg-premium",
      guestLimit: 40,
      eventDurationHours: 4,
      subtotalAmount: PACKAGE_AMOUNT,
      decorationAddonPrice: 100,
      extraPersonPrice: 0,
    },
    pricingSnapshot: {
      packageAmount: PACKAGE_AMOUNT,
      includedDurationHours: 4,
      bookedDurationHours: 4,
      extraHourlyRate: 150,
      totalAmount: TOTAL,
      advancePaid: ADVANCE_PAID,
      remainingPayable: TOTAL - ADVANCE_PAID,
    },
    items: [
      {
        productId: VARIANT.productId,
        variantId: VARIANT.id,
        productName: VARIANT.product.name,
        variantLabel: VARIANT.label,
        category: VARIANT.product.category,
        unitPrice: VARIANT.regularPrice,
        quantity: ITEM_QTY,
        includedQuantity: 0,
        includedUnitPrice: 0,
      },
    ],
    occasionData: null,
    occasionKey: null,
    occasionLabel: null,
    specialInstructions: null,
    lockVersion: 1,
    ...overrides,
  };
}

type RangeConflictArgs = { where?: { OR?: unknown } };

function makeTx(
  booking: Record<string, unknown>,
  options: { conflict?: boolean } = {}
) {
  return {
    booking: {
      findUnique: vi.fn().mockResolvedValue(booking),
      // The range-conflict lookup is the only findFirst carrying an OR filter.
      findFirst: vi.fn(async (args: RangeConflictArgs) =>
        options.conflict && args?.where?.OR ? { id: "booking-other" } : null
      ),
      findMany: vi.fn().mockResolvedValue([]),
      update: vi
        .fn()
        .mockResolvedValue({ id: "booking-1", bookingRef: "HR0814202600056" }),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    bookingItem: {
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      createMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    product: { findMany: vi.fn().mockResolvedValue([]) },
    productVariant: {
      findMany: vi.fn().mockResolvedValue([VARIANT]),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    payment: {
      create: vi.fn().mockResolvedValue({}),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    user: { findUnique: vi.fn().mockResolvedValue(null) },
    occasion: { findFirst: vi.fn().mockResolvedValue(null) },
    couponUsage: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
    appSetting: {
      findUnique: vi.fn().mockResolvedValue({ value: "150" }),
      findMany: vi.fn().mockResolvedValue([]),
    },
    $queryRaw: vi.fn().mockResolvedValue([{ lock: "" }]),
  };
}

function withTx(tx: ReturnType<typeof makeTx>) {
  prismaMock.$transaction.mockImplementation(
    (cb: (t: typeof tx) => Promise<unknown>) => cb(tx)
  );
  return tx;
}

// Mirrors the Edit Booking form's payload: `advanceAmount` is the cumulative
// amount collected after this edit, not the increment.
function editPayload(overrides: Record<string, unknown> = {}) {
  return {
    locationId: "loc-1",
    packageId: "pkg-premium",
    date: PAST_DATE,
    startTime: START_TIME,
    endTime: END_TIME,
    customer: {
      name: "Past Event Customer",
      phone: "8285815666",
      email: "past@example.com",
    },
    guestCount: 40,
    decorationRequired: false,
    items: [
      {
        productId: VARIANT.productId,
        variantId: VARIANT.id,
        quantity: ITEM_QTY,
      },
    ],
    couponCodes: [],
    additionalChargeAmount: 0,
    payment: {
      type: "OFFLINE",
      amountMode: "ADVANCE",
      advanceAmount: ADVANCE_PAID,
      offlineMethod: "CASH",
      paymentStatus: "PAID",
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

function updateData(tx: ReturnType<typeof makeTx>) {
  return tx.booking.update.mock.calls[0][0].data as Record<string, unknown>;
}

// ─── Form date rule ─────────────────────────────────────────────────────────

describe("booking form date rule", () => {
  it("new booking: a past date is still rejected", () => {
    expect(getAdminBookingDateError(PAST_DATE, TODAY, null)).toBe(
      "Date cannot be in the past."
    );
    expect(getAdminBookingMinDate(TODAY, null)).toBe(TODAY);
  });

  it("new booking: today and future dates are accepted", () => {
    expect(getAdminBookingDateError(TODAY, TODAY, null)).toBeNull();
    expect(getAdminBookingDateError(FUTURE_DATE, TODAY, null)).toBeNull();
  });

  it("edit: the booking's own past date stays valid and selectable", () => {
    expect(getAdminBookingDateError(PAST_DATE, TODAY, PAST_DATE)).toBeNull();
    expect(getAdminBookingMinDate(TODAY, PAST_DATE)).toBe(PAST_DATE);
  });

  it("edit: moving the booking to a different past date is rejected", () => {
    expect(getAdminBookingDateError(OTHER_PAST_DATE, TODAY, PAST_DATE)).toBe(
      "Date cannot be in the past."
    );
    // Earlier than the retained date as well.
    expect(getAdminBookingDateError("2026-08-01", TODAY, PAST_DATE)).toBe(
      "Date cannot be in the past."
    );
  });

  it("edit: moving a past booking to today or later is accepted", () => {
    expect(getAdminBookingDateError(TODAY, TODAY, PAST_DATE)).toBeNull();
    expect(getAdminBookingDateError(FUTURE_DATE, TODAY, PAST_DATE)).toBeNull();
  });

  it("edit: a future booking keeps the today minimum", () => {
    expect(getAdminBookingMinDate(TODAY, FUTURE_DATE)).toBe(TODAY);
    expect(getAdminBookingDateError(FUTURE_DATE, TODAY, FUTURE_DATE)).toBeNull();
    expect(getAdminBookingDateError(PAST_DATE, TODAY, FUTURE_DATE)).toBe(
      "Date cannot be in the past."
    );
  });

  it("an empty date is left to the required-field check", () => {
    expect(getAdminBookingDateError("", TODAY, null)).toBeNull();
  });
});

// ─── Form feedback for a chosen past date ───────────────────────────────────
//
// Reported: changing an edited booking from 23 Aug to 02 Sep (both past) kept
// "02 Sep 2026" in the field but the form only said "Select a date." — the
// summary guidance mapped every date error to that text, and the field's own
// error was never rendered because the submit button stays disabled.

describe("past-date feedback in the booking form", () => {
  const ORIGINAL = "2026-08-23";
  const CHANGED_PAST = "2026-09-02";

  // What the form computes each render: the live date error and the summary
  // guidance built from the readiness errors.
  function formFeedback(date: string, retainedDate: string | null) {
    const dateError = getAdminBookingDateError(date, TODAY, retainedDate);
    const readinessErrors: Record<string, string> = {};
    if (!date) readinessErrors.date = "Date is required.";
    if (dateError) readinessErrors.date = dateError;
    return {
      dateError,
      guidance: getSubmitBlockerMessage(readinessErrors),
    };
  }

  it("new booking + past date explains the problem", () => {
    const { dateError, guidance } = formFeedback(PAST_DATE, null);
    expect(dateError).toBe(ADMIN_BOOKING_PAST_DATE_MESSAGE);
    expect(guidance).toBe("Date cannot be in the past.");
  });

  it("edit + original past date retained is accepted", () => {
    const { dateError, guidance } = formFeedback(ORIGINAL, ORIGINAL);
    expect(dateError).toBeNull();
    expect(guidance).toBeNull();
  });

  it("edit + different past date says the date is in the past, not 'Select a date.'", () => {
    const { dateError, guidance } = formFeedback(CHANGED_PAST, ORIGINAL);
    expect(dateError).toBe("Date cannot be in the past.");
    expect(guidance).toBe("Date cannot be in the past.");
    expect(guidance).not.toBe("Select a date.");
  });

  it("edit + today or a future date carries no date error", () => {
    expect(formFeedback(TODAY, ORIGINAL)).toEqual({ dateError: null, guidance: null });
    expect(formFeedback(FUTURE_DATE, ORIGINAL)).toEqual({
      dateError: null,
      guidance: null,
    });
  });

  it("an empty date still asks the admin to select one", () => {
    const { dateError, guidance } = formFeedback("", ORIGINAL);
    expect(dateError).toBeNull();
    expect(guidance).toBe("Select a date.");
  });

  it("picking an invalid date does not lose the booking's original date", () => {
    // The retained date comes from the loaded booking, not the field, so a bad
    // pick followed by picking the original date again is accepted.
    expect(formFeedback(CHANGED_PAST, ORIGINAL).dateError).toBe(
      ADMIN_BOOKING_PAST_DATE_MESSAGE
    );
    expect(getAdminBookingMinDate(TODAY, ORIGINAL)).toBe(ORIGINAL);
    expect(formFeedback(ORIGINAL, ORIGINAL).dateError).toBeNull();
  });

  it("other blockers keep their existing guidance", () => {
    expect(getSubmitBlockerMessage({ locationId: "Location is required." })).toBe(
      "Select a location."
    );
    expect(getSubmitBlockerMessage({ theatreId: "Package is required." })).toBe(
      "Select a package."
    );
    expect(getSubmitBlockerMessage({ timeRange: "Event time is required." })).toBe(
      "Select a time range."
    );
  });
});

// ─── Server: editing an APPROVED booking after its event ────────────────────

describe("PATCH /api/admin/bookings/[id] on a past-date booking", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
    evaluateAdminCouponsMock.mockResolvedValue({ totalDiscount: 0, coupons: [] });
    persistAdminBookingCouponsMock.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("saves an unrelated edit and keeps the original past date and times", async () => {
    const tx = withTx(makeTx(pastApprovedBooking()));

    const res = await patchBooking(
      editPayload({ specialInstructions: "Guest left a gift behind." })
    );
    expect(res.status).toBe(200);

    const data = updateData(tx);
    const original = range(PAST_DATE);
    // No date or timezone shift on the round trip.
    expect(data.eventDate).toEqual(original.eventDate);
    expect(data.startsAtUtc).toEqual(original.startsAtUtc);
    expect(data.endsAtUtc).toEqual(original.endsAtUtc);
    expect(data.occupiedUntilUtc).toEqual(original.occupiedUntilUtc);
    expect(data.eventStartTime).toBe(START_TIME);
    expect(data.eventEndTime).toBe(END_TIME);
    expect(data.timezone).toBe(TIMEZONE);
    expect(data.specialInstructions).toBe("Guest left a gift behind.");
  });

  it("records a partial balance payment after the event", async () => {
    const tx = withTx(makeTx(pastApprovedBooking()));

    const res = await patchBooking(
      editPayload({
        payment: {
          type: "OFFLINE",
          amountMode: "ADVANCE",
          advanceAmount: 400,
          offlineMethod: "CASH",
          paymentStatus: "PAID",
        },
      })
    );
    expect(res.status).toBe(200);

    const data = updateData(tx);
    expect(Number(data.totalAmount)).toBe(TOTAL);
    expect(Number(data.advancePaid)).toBe(400);
    expect(Number(data.remainingPayable)).toBe(TOTAL - 400);
    expect(data.paymentStatus).toBe("PAID");
    expect(data.bookingStatus).toBe("APPROVED");

    const snapshot = data.pricingSnapshot as Record<string, number>;
    expect(snapshot.advancePaid).toBe(400);
    expect(snapshot.remainingPayable).toBe(TOTAL - 400);

    // Only the increment is recorded as a new payment.
    expect(tx.payment.create).toHaveBeenCalledTimes(1);
    expect(tx.payment.create.mock.calls[0][0].data).toMatchObject({
      bookingId: "booking-1",
      provider: "OFFLINE",
      method: "CASH",
      amount: 200,
      status: "PAID",
      recordedByAdminId: "admin-1",
    });
  });

  it("settles the full balance with a bank reference after the event", async () => {
    const tx = withTx(makeTx(pastApprovedBooking()));

    const res = await patchBooking(
      editPayload({
        payment: {
          type: "OFFLINE",
          amountMode: "FULL",
          advanceAmount: TOTAL,
          offlineMethod: "BANK",
          offlineReference: "BANK-REF-77",
          paymentStatus: "PAID",
        },
      })
    );
    expect(res.status).toBe(200);

    const data = updateData(tx);
    expect(Number(data.advancePaid)).toBe(TOTAL);
    expect(Number(data.remainingPayable)).toBe(0);
    expect(data.paymentStatus).toBe("PAID");
    expect(data.bookingStatus).toBe("APPROVED");
    expect(tx.payment.create.mock.calls[0][0].data).toMatchObject({
      method: "BANK",
      transactionId: "BANK-REF-77",
      amount: TOTAL - ADVANCE_PAID,
    });
  });

  it("does not record a payment when nothing new is collected", async () => {
    const tx = withTx(makeTx(pastApprovedBooking()));

    const res = await patchBooking(editPayload());
    expect(res.status).toBe(200);

    const data = updateData(tx);
    expect(Number(data.advancePaid)).toBe(ADVANCE_PAID);
    expect(Number(data.remainingPayable)).toBe(TOTAL - ADVANCE_PAID);
    expect(tx.payment.create).not.toHaveBeenCalled();
  });

  it("does not move stock or pricing when only a payment is recorded", async () => {
    const tx = withTx(makeTx(pastApprovedBooking()));

    await patchBooking(
      editPayload({
        payment: {
          type: "OFFLINE",
          amountMode: "ADVANCE",
          advanceAmount: 500,
          offlineMethod: "CASH",
          paymentStatus: "PAID",
        },
      })
    );

    // APPROVED already holds its stock; an unchanged quantity is a zero delta.
    expect(tx.productVariant.updateMany).not.toHaveBeenCalled();

    const data = updateData(tx);
    expect(Number(data.baseAmount)).toBe(PACKAGE_AMOUNT);
    expect(Number(data.productsAmount)).toBe(ITEMS_AMOUNT);
    expect(Number(data.extrasAmount)).toBe(0);
    expect(Number(data.discountAmount)).toBe(0);
    expect(Number(data.totalAmount)).toBe(TOTAL);
    const snapshot = data.pricingSnapshot as Record<string, number>;
    expect(snapshot.extraDurationHours).toBe(0);
    expect(snapshot.bookedDurationHours).toBe(4);
  });

  it("still edits a future-date booking as before", async () => {
    const tx = withTx(makeTx(pastApprovedBooking(range(FUTURE_DATE))));

    const res = await patchBooking(editPayload({ date: FUTURE_DATE }));
    expect(res.status).toBe(200);
    expect(updateData(tx).eventDate).toEqual(range(FUTURE_DATE).eventDate);
  });

  it("still rejects a changed date whose slot conflicts with another booking", async () => {
    const tx = withTx(makeTx(pastApprovedBooking(), { conflict: true }));

    const res = await patchBooking(editPayload({ date: FUTURE_DATE }));
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe("BOOKING_CONFLICT");
    expect(tx.booking.update).not.toHaveBeenCalled();
  });

  it("still rejects a changed time outside business hours", async () => {
    const tx = withTx(makeTx(pastApprovedBooking()));

    const res = await patchBooking(
      editPayload({ date: FUTURE_DATE, startTime: "19:00", endTime: "23:00" })
    );
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe("OUTSIDE_BUSINESS_HOURS");
    expect(tx.booking.update).not.toHaveBeenCalled();
  });

  it("still refuses to edit a COMPLETED booking", async () => {
    const tx = withTx(
      makeTx(pastApprovedBooking({ bookingStatus: "COMPLETED" }))
    );

    const res = await patchBooking(
      editPayload({
        payment: {
          type: "OFFLINE",
          amountMode: "ADVANCE",
          advanceAmount: 400,
          offlineMethod: "CASH",
          paymentStatus: "PAID",
        },
      })
    );
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe("BOOKING_FINALIZED");
    expect(tx.booking.update).not.toHaveBeenCalled();
    expect(tx.payment.create).not.toHaveBeenCalled();
  });
});
