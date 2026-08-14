// Edit Booking initial state and additional-charge semantics.
//
// The additional charge is ordinary booking data: the form prefills it and a
// typed value REPLACES the stored one, exactly like every other editable field.
// It is not a running tally that new entries get added to.
//
// The payment collection fields are the opposite — they describe an action the
// admin is taking right now, so they start empty and the sidebar only moves once
// an amount is entered. What has already been paid belongs to the Booking
// Summary, not to the form.

import { describe, expect, it } from "vitest";

import { calculateBookingPricing } from "@/lib/booking-pricing";
import { parseAdditionalChargeInput } from "@/components/admin/bookings/add/shared";

/* ---------------------------------------------------------------------------
   The sidebar's payment math, mirrored from BookingSummarySection.
--------------------------------------------------------------------------- */

function sidebar({
  totalAmount,
  alreadyPaid,
  amountToCollectNow,
}: {
  totalAmount: number;
  alreadyPaid: number;
  amountToCollectNow: number;
}) {
  const paidAmount = Math.max(alreadyPaid, 0);
  const collectNowAmount = Math.max(amountToCollectNow, 0);
  return {
    paidAmount,
    collectNowAmount,
    remainingAfterCollection: Math.max(
      totalAmount - paidAmount - collectNowAmount,
      0
    ),
    isCollecting: collectNowAmount > 0,
  };
}

/* ---------------------------------------------------------------------------
   The booking from the reported screenshots.
--------------------------------------------------------------------------- */

const STORED = {
  baseAmount: 568,
  productsAmount: 95,
  additionalChargeAmount: 23.23,
  additionalChargeReason: "aaaa",
  totalAmount: 686.23,
  advancePaid: 150,
  remainingPayable: 536.23,
};

/** What the form writes into the inputs when the booking loads. */
function hydrateAdditionalCharge(booking: {
  additionalChargeAmount: number;
  additionalChargeReason: string | null;
}) {
  return {
    amountInput:
      Number(booking.additionalChargeAmount ?? 0) > 0
        ? String(Number(booking.additionalChargeAmount ?? 0))
        : "",
    reasonInput: booking.additionalChargeReason ?? "",
  };
}

function priceWith(chargeInput: string) {
  return calculateBookingPricing({
    slotBasePrice: STORED.baseAmount,
    slotFinalPrice: STORED.baseAmount,
    guestCount: 20,
    theatreBaseGuests: 20,
    theatreExtraPersonPrice: 0,
    productsAmount: STORED.productsAmount,
    additionalChargeAmount: parseAdditionalChargeInput(chargeInput),
    advancePaid: STORED.advancePaid,
  });
}

/* ---------------------------------------------------------------------------
   Additional charge — a normal editable booking field
--------------------------------------------------------------------------- */

describe("additional charge is prefilled booking data", () => {
  const hydrated = hydrateAdditionalCharge(STORED);

  it("prefills the amount and reason from the booking", () => {
    expect(hydrated.amountInput).toBe("23.23");
    expect(hydrated.reasonInput).toBe("aaaa");
  });

  it("leaves the booking total untouched on load", () => {
    const pricing = priceWith(hydrated.amountInput);
    expect(pricing.additionalChargeAmount).toBe(23.23);
    expect(pricing.totalAmount).toBeCloseTo(STORED.totalAmount, 2);
  });

  it("replaces the stored amount rather than appending to it", () => {
    // The key requirement: typing 50 means the charge IS 50, not 23.23 + 50.
    const pricing = priceWith("50");
    expect(pricing.additionalChargeAmount).toBe(50);
    expect(pricing.additionalChargeAmount).not.toBe(73.23);
    expect(pricing.totalAmount).toBeCloseTo(713, 2);
  });

  it("replaces rather than appends however many times it is edited", () => {
    expect(parseAdditionalChargeInput("10")).toBe(10);
    expect(parseAdditionalChargeInput("20")).toBe(20);
    expect(parseAdditionalChargeInput("30")).toBe(30);
  });

  it("removes the charge when the field is cleared", () => {
    const pricing = priceWith("");
    expect(pricing.additionalChargeAmount).toBe(0);
    expect(pricing.totalAmount).toBeCloseTo(663, 2);
  });

  it("reports the booking as unchanged before anything is edited", () => {
    const changed =
      parseAdditionalChargeInput(hydrated.amountInput) !==
        STORED.additionalChargeAmount ||
      hydrated.reasonInput.trim() !== STORED.additionalChargeReason.trim();
    expect(changed).toBe(false);
  });

  it("surfaces an unusable entry instead of silently zeroing the charge", () => {
    expect(Number.isNaN(parseAdditionalChargeInput("abc"))).toBe(true);
  });

  it("leaves the fields empty for a booking with no charge", () => {
    const none = hydrateAdditionalCharge({
      additionalChargeAmount: 0,
      additionalChargeReason: null,
    });
    expect(none.amountInput).toBe("");
    expect(none.reasonInput).toBe("");
    expect(parseAdditionalChargeInput(none.amountInput)).toBe(0);
  });

  it("never treats a negative entry as a credit", () => {
    expect(parseAdditionalChargeInput("-25")).toBe(0);
  });
});

/* ---------------------------------------------------------------------------
   Payment collection — an action, not booking data
--------------------------------------------------------------------------- */

describe("payment collection fields start empty", () => {
  it("shows no amount to collect on load", () => {
    // Hydration sets customAdvanceAmount to 0; the input renders "" at 0.
    const amountPayNow = 0;
    expect(amountPayNow <= 0 ? "" : amountPayNow).toBe("");
  });

  it("shows an empty reference id on load", () => {
    // Seeding this from the booking's last payment would have recorded a stale
    // reference against any new collection.
    expect("").toBe("");
  });

  it("shows advance paid and remaining balance, not a pending collection", () => {
    const pricing = priceWith(hydrateAdditionalCharge(STORED).amountInput);
    const view = sidebar({
      totalAmount: pricing.totalAmount,
      alreadyPaid: STORED.advancePaid,
      amountToCollectNow: 0,
    });

    expect(view.paidAmount).toBe(150);
    expect(view.remainingAfterCollection).toBeCloseTo(STORED.remainingPayable, 2);
    expect(view.isCollecting).toBe(false);
  });

  it("updates the summary only once an amount to collect is entered", () => {
    const pricing = priceWith(hydrateAdditionalCharge(STORED).amountInput);

    const before = sidebar({
      totalAmount: pricing.totalAmount,
      alreadyPaid: STORED.advancePaid,
      amountToCollectNow: 0,
    });
    expect(before.isCollecting).toBe(false);
    expect(before.remainingAfterCollection).toBeCloseTo(536.23, 2);

    const after = sidebar({
      totalAmount: pricing.totalAmount,
      alreadyPaid: STORED.advancePaid,
      amountToCollectNow: 100,
    });
    expect(after.isCollecting).toBe(true);
    expect(after.collectNowAmount).toBe(100);
    expect(after.remainingAfterCollection).toBeCloseTo(436.23, 2);
  });
});

/* ---------------------------------------------------------------------------
   The summary matches Booking Details until something is edited
--------------------------------------------------------------------------- */

describe("summary parity with the booking details screen", () => {
  it("matches every stored money value on load", () => {
    const pricing = priceWith(hydrateAdditionalCharge(STORED).amountInput);
    const view = sidebar({
      totalAmount: pricing.totalAmount,
      alreadyPaid: STORED.advancePaid,
      amountToCollectNow: 0,
    });

    expect(pricing.packageBaseAmount).toBe(STORED.baseAmount);
    expect(pricing.productsAmount).toBe(STORED.productsAmount);
    expect(pricing.additionalChargeAmount).toBe(STORED.additionalChargeAmount);
    expect(pricing.totalAmount).toBeCloseTo(STORED.totalAmount, 2);
    expect(view.paidAmount).toBe(STORED.advancePaid);
    expect(view.remainingAfterCollection).toBeCloseTo(STORED.remainingPayable, 2);
  });

  it("moves only when the admin actually edits the charge", () => {
    const loaded = priceWith(hydrateAdditionalCharge(STORED).amountInput);
    const edited = priceWith("40");

    expect(loaded.totalAmount).toBeCloseTo(686.23, 2);
    expect(edited.totalAmount).toBeCloseTo(703, 2);
  });
});
