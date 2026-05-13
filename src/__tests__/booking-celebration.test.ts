import { describe, expect, it } from "vitest";
import {
  assignNumberDecorationDetails,
  buildOccasionDetails,
  extractNumberDecorationValuesFromOccasionData,
} from "@/lib/booking-celebration";

describe("booking celebration helpers", () => {
  it("formats occasion fields and excludes number-decoration keys", () => {
    expect(
      buildOccasionDetails({
        partnerName: "Aarav",
        welcome_message: "Happy Anniversary",
        ledNumber: ["2", "5"],
      })
    ).toEqual([
      { label: "Partner Name", value: "Aarav" },
      { label: "Welcome Message", value: "Happy Anniversary" },
    ]);
  });

  it("extracts number-decoration values from saved occasion data", () => {
    expect(
      extractNumberDecorationValuesFromOccasionData({
        ledNumber: ["2", "5"],
      })
    ).toEqual(["2", "5"]);
  });

  it("attaches saved number values to LED and balloon tower items in order", () => {
    expect(
      assignNumberDecorationDetails(
        [
          { productName: "LED Number", variantLabel: "Large" },
          { productName: "Rose Bouquet", variantLabel: "Classic" },
          { productName: "Number Balloon Tower", variantLabel: "Gold" },
        ],
        { ledNumber: ["2", "5"] }
      )
    ).toEqual([
      {
        productName: "LED Number",
        variantLabel: "Large",
        numberLabel: "LED Number",
        numberValue: "2",
      },
      {
        productName: "Rose Bouquet",
        variantLabel: "Classic",
        numberLabel: null,
        numberValue: null,
      },
      {
        productName: "Number Balloon Tower",
        variantLabel: "Gold",
        numberLabel: "Balloon Tower Number",
        numberValue: "5",
      },
    ]);
  });
});
