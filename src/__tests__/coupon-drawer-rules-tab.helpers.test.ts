import { describe, expect, it } from "vitest";

import {
  buildRestrictionPickerOptions,
  mergeRestrictionOrder,
  resolveLocationRestrictionSelection,
} from "@/components/admin/coupons/drawer/tabs/rulesTab.helpers";

describe("coupon drawer restriction picker helpers", () => {
  it("keeps the selected restriction option visible even after it becomes unavailable", () => {
    const restrictionTypeOptions = [
      { value: "__LOCATION__", label: "Location" },
      { value: "BOOKING_DATE_RANGE", label: "Booking Date Range" },
      { value: "BOOKING_DURATION_MIN", label: "Booking Duration" },
    ];

    const result = buildRestrictionPickerOptions({
      restrictionTypeOptions,
      availableRestrictionOptions: [
        { value: "__LOCATION__", label: "Location" },
        { value: "BOOKING_DURATION_MIN", label: "Booking Duration" },
      ],
      selectedRestrictionType: "BOOKING_DATE_RANGE",
    });

    expect(result.map((option) => option.value)).toEqual([
      "",
      "__LOCATION__",
      "BOOKING_DURATION_MIN",
      "BOOKING_DATE_RANGE",
    ]);
  });

  it("does not duplicate the selected restriction when it is already available", () => {
    const restrictionTypeOptions = [
      { value: "__LOCATION__", label: "Location" },
      { value: "BOOKING_DATE_RANGE", label: "Booking Date Range" },
    ];

    const result = buildRestrictionPickerOptions({
      restrictionTypeOptions,
      availableRestrictionOptions: [
        { value: "__LOCATION__", label: "Location" },
        { value: "BOOKING_DATE_RANGE", label: "Booking Date Range" },
      ],
      selectedRestrictionType: "BOOKING_DATE_RANGE",
    });

    expect(result.map((option) => option.value)).toEqual([
      "",
      "__LOCATION__",
      "BOOKING_DATE_RANGE",
    ]);
  });

  it("preserves existing restriction order and appends new items at the end", () => {
    expect(
      mergeRestrictionOrder(
        ["location", "BOOKING_DATE_RANGE:0", "BOOKING_DURATION_MIN:0"],
        ["location", "BOOKING_DURATION_MIN:0", "PRODUCT_ID:0"]
      )
    ).toEqual(["location", "BOOKING_DURATION_MIN:0", "PRODUCT_ID:0"]);
  });

  it("adds location immediately when locations are already available", () => {
    expect(
      resolveLocationRestrictionSelection({
        currentLocationId: null,
        availableLocationIds: ["loc_1", "loc_2"],
      })
    ).toEqual({
      nextLocationId: "loc_1",
      pending: false,
      shouldLoad: false,
    });
  });

  it("enters pending mode and loads locations when none are available yet", () => {
    expect(
      resolveLocationRestrictionSelection({
        currentLocationId: null,
        availableLocationIds: [],
      })
    ).toEqual({
      nextLocationId: null,
      pending: true,
      shouldLoad: true,
    });
  });
});
