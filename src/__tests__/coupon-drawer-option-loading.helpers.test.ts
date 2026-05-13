import { describe, expect, it } from "vitest";

import {
  getNeededRuleOptionIncludes,
  mergeRuleOptions,
} from "@/components/admin/coupons/drawer/couponRuleOptions.helpers";

describe("coupon drawer option loading helpers", () => {
  it("always reloads slot durations but skips other already loaded options", () => {
    const loaded = new Set(["locations", "theatres", "products", "slotDurations"] as const);

    expect(
      getNeededRuleOptionIncludes(
        ["locations", "theatres", "products", "slotDurations"],
        loaded
      )
    ).toEqual(["slotDurations"]);
  });

  it("keeps unloaded option groups in the fetch list", () => {
    const loaded = new Set(["locations"] as const);

    expect(
      getNeededRuleOptionIncludes(["locations", "theatres", "coupons"], loaded)
    ).toEqual(["theatres", "coupons"]);
  });

  it("merges only the incoming option groups and preserves the rest", () => {
    const current = {
      locations: [{ id: "loc_1", name: "Delhi" }],
      theatres: [{ id: "theatre_1", name: "T1", locationId: "loc_1", locationName: "Delhi" }],
      products: [],
      slots: [],
      slotDurations: [],
      coupons: [],
    };

    expect(
      mergeRuleOptions(current, {
        products: [
          {
            id: "prod_1",
            name: "Cake",
            category: "CAKE",
            locationId: "loc_1",
            locationName: "Delhi",
          },
        ],
      })
    ).toEqual({
      ...current,
      products: [
        {
          id: "prod_1",
          name: "Cake",
          category: "CAKE",
          locationId: "loc_1",
          locationName: "Delhi",
        },
      ],
    });
  });
});
