import { describe, expect, it, vi } from "vitest";
import {
  BookingOverlapError,
  assertValidTimeRange,
  validateNoOverlappingActiveBooking,
} from "@/services/booking/booking-safety.service";

function createTxMock() {
  return {
    booking: {
      findFirst: vi.fn(),
    },
  };
}

describe("booking safety service", () => {
  it("rejects invalid time ranges", () => {
    expect(() =>
      assertValidTimeRange({ startTime: "14:00", endTime: "14:00" })
    ).toThrow(BookingOverlapError);
  });

  it("rejects overlapping active bookings", async () => {
    const tx = createTxMock();
    tx.booking.findFirst.mockResolvedValueOnce({
      id: "booking-overlap",
      bookingStatus: "AWAITING_PAYMENT",
      slotId: "slot-overlap",
    });

    await expect(
      validateNoOverlappingActiveBooking(tx as never, {
        theatreId: "theatre-1",
        date: new Date("2099-01-01T00:00:00.000Z"),
        startTime: "10:00",
        endTime: "14:00",
        context: "test",
      })
    ).rejects.toThrow(BookingOverlapError);
  });

  it("allows a range when no active overlap exists", async () => {
    const tx = createTxMock();
    tx.booking.findFirst.mockResolvedValueOnce(null);

    await expect(
      validateNoOverlappingActiveBooking(tx as never, {
        theatreId: "theatre-1",
        date: new Date("2099-01-01T00:00:00.000Z"),
        startTime: "10:00",
        endTime: "14:00",
        context: "test",
      })
    ).resolves.toBeUndefined();
  });

  it("excludes the current booking and same lock owner when validating retries", async () => {
    const tx = createTxMock();
    tx.booking.findFirst.mockResolvedValueOnce(null);

    await validateNoOverlappingActiveBooking(tx as never, {
      theatreId: "theatre-1",
      date: new Date("2099-01-01T00:00:00.000Z"),
      startTime: "10:00",
      endTime: "14:00",
      excludeBookingId: "booking-current",
      allowLockOwner: "owner-current",
      context: "test",
    });

    expect(tx.booking.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: { not: "booking-current" },
          slot: expect.objectContaining({
            OR: [
              { lockedBy: null },
              { lockedBy: { not: "owner-current" } },
            ],
          }),
        }),
      })
    );
  });
});
