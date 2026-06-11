import { describe, expect, it } from "vitest";

import {
  APP_SETTING_META,
  SLOT_EXPIRY_GRACE_MINUTES_KEY,
  SLOT_EXPIRY_MODE_KEY,
  normalizeAppSettingValue,
  validateAppSetting,
} from "@/lib/app-settings";

describe("admin app setting display metadata", () => {
  it("uses customer-friendly labels for expiry settings", () => {
    expect(APP_SETTING_META[SLOT_EXPIRY_GRACE_MINUTES_KEY]).toMatchObject({
      label: "Late Arrival Grace Period (minutes)",
      type: "number",
    });
    expect(APP_SETTING_META[SLOT_EXPIRY_MODE_KEY]).toMatchObject({
      label: "Booking Expiry Reference",
      type: "select",
      options: [{ label: "Scheduled start time", value: "START_TIME" }],
    });
  });

  it("normalizes and validates expiry settings", () => {
    expect(normalizeAppSettingValue(SLOT_EXPIRY_MODE_KEY, "start_time")).toBe(
      "START_TIME"
    );
    expect(validateAppSetting(SLOT_EXPIRY_MODE_KEY, "START_TIME")).toBeNull();
    expect(validateAppSetting(SLOT_EXPIRY_GRACE_MINUTES_KEY, "30")).toBeNull();
    expect(validateAppSetting(SLOT_EXPIRY_GRACE_MINUTES_KEY, "-1")).toBe(
      "Grace period cannot be negative."
    );
  });
});
