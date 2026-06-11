import { describe, expect, it } from "vitest";

import { POST } from "@/app/api/session/reset/route";

describe("session reset route", () => {
  it("expires all customer booking session cookies", async () => {
    const response = await POST();
    const cookies = response.headers.getSetCookie().join("\n");

    expect(response.status).toBe(200);
    expect(cookies).toContain("ds_booking_session=");
    expect(cookies).toContain("ds_lock_owner=");
    expect(cookies).toContain("ds_prebooking=");
    expect(cookies.match(/Max-Age=0/g)).toHaveLength(3);
  });
});
