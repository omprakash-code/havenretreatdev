import { describe, expect, it } from "vitest";

import {
  getNeededRuleOptionIncludes,
  mergeRuleOptions,
} from "@/components/admin/coupons/drawer/couponRuleOptions.helpers";

describe("coupon drawer option loading helpers", () => {
  it("always reloads booking durations but skips other already loaded options", () => {
    const loaded = new Set(["locations", "products", "slotDurations"] as const);

    expect(
      getNeededRuleOptionIncludes(
        ["locations", "products", "slotDurations"],
        loaded
      )
    ).toEqual(["slotDurations"]);
  });

  it("keeps unloaded option groups in the fetch list", () => {
    const loaded = new Set(["locations"] as const);

    expect(
      getNeededRuleOptionIncludes(["locations", "products", "coupons"], loaded)
    ).toEqual(["products", "coupons"]);
  });

  it("merges only the incoming option groups and preserves the rest", () => {
    const current = {
      locations: [{ id: "loc_1", name: "Delhi" }],
      products: [],
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
