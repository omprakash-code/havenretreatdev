import type { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import { allocateBookingRef } from "@/services/booking/bookingId.service";

function transactionReturning(lastNumber: number) {
  return {
    $queryRaw: vi.fn().mockResolvedValue([{ lastNumber }]),
  } as unknown as Prisma.TransactionClient;
}

describe("allocateBookingRef", () => {
  it("uses the Miami calendar date", async () => {
    const tx = transactionReturning(1);
    const bookingRef = await allocateBookingRef(
      tx,
      new Date("2026-06-08T00:30:00.000Z")
    );

    expect(bookingRef).toBe("HR0607202600001");
  });

  it("uses a five-digit yearly sequence", async () => {
    const tx = transactionReturning(42);
    const bookingRef = await allocateBookingRef(
      tx,
      new Date("2026-06-08T16:00:00.000Z")
    );

    expect(bookingRef).toBe("HR0608202600042");
  });

  it("rejects a sequence beyond the five-digit yearly capacity", async () => {
    const tx = transactionReturning(100_000);

    await expect(
      allocateBookingRef(tx, new Date("2026-06-08T16:00:00.000Z"))
    ).rejects.toThrow("Booking reference capacity reached for 2026.");
  });
});
