import { describe, expect, it } from "vitest";

import {
  getDateHoverHint,
  getSlotHoverHint,
  getTheatreHoverHint,
} from "@/components/admin/bookings/add/sections/scheduleSection.helpers";

describe("admin booking schedule section helpers", () => {
  it("gives date field dependency hint only when location is missing", () => {
    expect(getDateHoverHint("")).toBe("Select location first.");
    expect(getDateHoverHint("loc_1")).toBe("");
    expect(getDateHoverHint("loc_1")).toBe("");
  });

  it("gives theatre field dependency hints without telling users to select itself", () => {
    expect(getTheatreHoverHint("", "")).toBe("Select location first.");
    expect(getTheatreHoverHint("loc_1", "")).toBe("Select date first.");
    expect(getTheatreHoverHint("loc_1", "2026-03-24")).toBe("");
  });

  it("prioritizes slot dependency order and conflict messages", () => {
    expect(
      getSlotHoverHint({
        locationId: "",
        date: "",
        theatreId: "",
        slotId: "",
        slotConflictMessage: null,
      })
    ).toBe("Select location first.");

    expect(
      getSlotHoverHint({
        locationId: "loc_1",
        date: "",
        theatreId: "",
        slotId: "",
        slotConflictMessage: null,
      })
    ).toBe("Select date first.");

    expect(
      getSlotHoverHint({
        locationId: "loc_1",
        date: "2026-03-24",
        theatreId: "",
        slotId: "",
        slotConflictMessage: null,
      })
    ).toBe("Select theatre first.");

    expect(
      getSlotHoverHint({
        locationId: "loc_1",
        date: "2026-03-24",
        theatreId: "theatre_1",
        slotId: "",
        slotConflictMessage: null,
      })
    ).toBe("");

    expect(
      getSlotHoverHint({
        locationId: "loc_1",
        date: "2026-03-24",
        theatreId: "theatre_1",
        slotId: "",
        slotConflictMessage: "Slot is already booked.",
      })
    ).toBe("Slot is already booked.");
  });
});
