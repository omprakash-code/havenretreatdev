import { describe, expect, it } from "vitest";

import {
  getSubmitBlockerMessage,
  getSummaryHint,
} from "@/components/admin/bookings/add/sections/bookingSummary.helpers";

describe("admin booking summary helpers", () => {
  it("guides progressively through schedule selection", () => {
    expect(
      getSummaryHint({
        locationId: "",
        date: "",
        theatreId: "",
        selectedSlot: null,
      })
    ).toBe("Select a location.");

    expect(
      getSummaryHint({
        locationId: "loc_1",
        date: "",
        theatreId: "",
        selectedSlot: null,
      })
    ).toBe("Select a date.");

    expect(
      getSummaryHint({
        locationId: "loc_1",
        date: "2026-03-24",
        theatreId: "",
        selectedSlot: null,
      })
    ).toBe("Select a theatre.");
  });

  it("prioritizes booking blocker messages in the expected admin order", () => {
    expect(
      getSubmitBlockerMessage({
        phone: "Enter a valid 10-digit phone number.",
        amountPayNow: "Enter a valid advance amount.",
      })
    ).toBe("Enter a valid phone number.");

    expect(
      getSubmitBlockerMessage({
        amountPayNow: "Enter a valid advance amount.",
        offlineReference: "Reference ID is required for this method.",
      })
    ).toBe("Enter a valid advance amount.");
  });

  it("surfaces occasion and coupon issues with user-facing wording", () => {
    expect(
      getSubmitBlockerMessage({
        "occasion.personName": "Name is required.",
      })
    ).toBe("Name is required.");

    expect(
      getSubmitBlockerMessage({
        couponCode: "Apply coupon or clear the coupon code.",
      })
    ).toBe("Apply coupon or clear the coupon code.");
  });
});
