import { describe, expect, it } from "vitest";

import {
  adminFeatures,
  isAdminPageEnabled,
} from "@/config/admin-features";

describe("admin feature access", () => {
  it("keeps the contracted admin pages enabled", () => {
    expect(adminFeatures.dashboard).toBe(true);
    expect(adminFeatures.bookings).toBe(true);
    expect(adminFeatures.manualBooking).toBe(true);
    expect(adminFeatures.settings).toBe(true);

    expect(isAdminPageEnabled("/admin")).toBe(true);
    expect(isAdminPageEnabled("/admin/bookings")).toBe(true);
    expect(isAdminPageEnabled("/admin/bookings/add")).toBe(true);
    expect(isAdminPageEnabled("/admin/settings")).toBe(true);
  });

  it("blocks hidden upgrade pages", () => {
    expect(isAdminPageEnabled("/admin/bookings/live")).toBe(false);
    expect(isAdminPageEnabled("/admin/bookings/abandoned")).toBe(false);
    expect(isAdminPageEnabled("/admin/slots")).toBe(false);
    expect(isAdminPageEnabled("/admin/theatres")).toBe(false);
    expect(isAdminPageEnabled("/admin/locations")).toBe(false);
    expect(isAdminPageEnabled("/admin/products")).toBe(false);
    expect(isAdminPageEnabled("/admin/coupons")).toBe(false);
    expect(isAdminPageEnabled("/admin/payments")).toBe(false);
    expect(isAdminPageEnabled("/admin/waitlist")).toBe(false);
    expect(isAdminPageEnabled("/admin/contact")).toBe(false);
    expect(isAdminPageEnabled("/admin/profile")).toBe(false);
  });

  it("denies unknown admin pages by default", () => {
    expect(isAdminPageEnabled("/admin/future-module")).toBe(false);
  });
});
