import { afterEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/booking-locks/route";

describe("range booking rollout flags", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("keeps range booking creation disabled by default", async () => {
    vi.stubEnv("RANGE_BOOKING_LOCKS_ENABLED", "false");
    vi.stubEnv("CUSTOMER_RANGE_BOOKING_ENABLED", "false");

    const response = await POST(
      new Request("http://localhost/api/booking-locks", {
        method: "POST",
        body: "{}",
      })
    );

    expect(response.status).toBe(404);
  });

  it("requires the customer-flow flag in addition to the lock engine", async () => {
    vi.stubEnv("RANGE_BOOKING_LOCKS_ENABLED", "true");
    vi.stubEnv("CUSTOMER_RANGE_BOOKING_ENABLED", "false");

    const response = await POST(
      new Request("http://localhost/api/booking-locks", {
        method: "POST",
        body: "{}",
      })
    );

    expect(response.status).toBe(404);
  });
});
