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
      { value: "THEATRE_ID", label: "Theatre" },
      { value: "SLOT_DURATION_MIN", label: "Slot Duration" },
    ];

    const result = buildRestrictionPickerOptions({
      restrictionTypeOptions,
      availableRestrictionOptions: [
        { value: "__LOCATION__", label: "Location" },
        { value: "SLOT_DURATION_MIN", label: "Slot Duration" },
      ],
      selectedRestrictionType: "THEATRE_ID",
    });

    expect(result.map((option) => option.value)).toEqual([
      "",
      "__LOCATION__",
      "SLOT_DURATION_MIN",
      "THEATRE_ID",
    ]);
  });

  it("does not duplicate the selected restriction when it is already available", () => {
    const restrictionTypeOptions = [
      { value: "__LOCATION__", label: "Location" },
      { value: "THEATRE_ID", label: "Theatre" },
    ];

    const result = buildRestrictionPickerOptions({
      restrictionTypeOptions,
      availableRestrictionOptions: [
        { value: "__LOCATION__", label: "Location" },
        { value: "THEATRE_ID", label: "Theatre" },
      ],
      selectedRestrictionType: "THEATRE_ID",
    });

    expect(result.map((option) => option.value)).toEqual([
      "",
      "__LOCATION__",
      "THEATRE_ID",
    ]);
  });

  it("preserves existing restriction order and appends new items at the end", () => {
    expect(
      mergeRestrictionOrder(
        ["location", "THEATRE_ID:0", "SLOT_DURATION_MIN:0"],
        ["location", "SLOT_DURATION_MIN:0", "PRODUCT_ID:0"]
      )
    ).toEqual(["location", "SLOT_DURATION_MIN:0", "PRODUCT_ID:0"]);
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
