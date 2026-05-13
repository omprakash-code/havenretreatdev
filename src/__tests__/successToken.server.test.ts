import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createSuccessToken,
  verifySuccessToken,
} from "@/services/booking/successToken.server";

describe("successToken.server", () => {
  beforeEach(() => {
    vi.useRealTimers();
    process.env.SUCCESS_PAGE_SECRET = "test-success-secret";
  });

  it("creates and verifies a valid token", () => {
    const token = createSuccessToken("booking-1", "DS-BOOK-1", Date.now());
    const result = verifySuccessToken(token);

    expect(result.valid).toBe(true);
    expect(result.payload).toMatchObject({
      bookingId: "booking-1",
      bookingRef: "DS-BOOK-1",
    });
  });

  it("fails verification for tampered token", () => {
    const token = createSuccessToken("booking-1", "DS-BOOK-1", Date.now());
    const tampered = token.slice(0, -1) + (token.endsWith("A") ? "B" : "A");
    const result = verifySuccessToken(tampered);

    expect(result.valid).toBe(false);
    expect(result.code).toBe("INVALID_TOKEN");
  });

  it("keeps old token valid when signature is valid", () => {
    const issuedAt = Date.now() - 25 * 60 * 60 * 1000;
    const token = createSuccessToken("booking-1", "DS-BOOK-1", issuedAt);
    const result = verifySuccessToken(token);

    expect(result.valid).toBe(true);
    expect(result.payload).toMatchObject({
      bookingId: "booking-1",
      bookingRef: "DS-BOOK-1",
    });
  });
});
