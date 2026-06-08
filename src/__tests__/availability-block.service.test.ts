import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    $transaction: vi.fn(),
    $queryRaw: vi.fn(),
    theatre: { findUnique: vi.fn() },
    bookingSettings: { upsert: vi.fn() },
    booking: { findFirst: vi.fn() },
    bookingLock: { findFirst: vi.fn() },
    availabilityBlock: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/db";
import {
  AvailabilityBlockConflictError,
  AvailabilityBlockValidationError,
  createAvailabilityBlock,
  deactivateAvailabilityBlock,
} from "@/services/availability/availability-block.service";

const settings = {
  id: "settings-1",
  theatreId: "theatre-1",
  businessOpenTime: "09:00",
  businessCloseTime: "23:00",
  minimumDurationMinutes: 240,
  bufferMinutes: 60,
  lockDurationMinutes: 10,
  maximumGuests: 50,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("availability block service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.$transaction).mockImplementation(
      async (callback: (tx: typeof prisma) => Promise<unknown>) =>
        callback(prisma)
    );
    vi.mocked(prisma.theatre.findUnique).mockResolvedValue({
      id: "theatre-1",
      timezone: "America/New_York",
    } as never);
    vi.mocked(prisma.bookingSettings.upsert).mockResolvedValue(settings);
    vi.mocked(prisma.availabilityBlock.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.booking.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.bookingLock.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.availabilityBlock.create).mockResolvedValue({} as never);
  });

  it("creates a full-day block using configured business hours", async () => {
    await createAvailabilityBlock(
      {
        theatreId: "theatre-1",
        eventDate: "2026-07-04",
        isFullDay: true,
        internalNote: "Holiday",
      },
      "admin-1"
    );

    expect(prisma.availabilityBlock.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        theatreId: "theatre-1",
        isFullDay: true,
        startTime: null,
        endTime: null,
        internalNote: "Holiday",
        createdByAdminId: "admin-1",
      }),
    });
    const data = vi.mocked(prisma.availabilityBlock.create).mock.calls[0][0].data;
    expect(data).not.toHaveProperty("recurrenceRule");
    expect(data).not.toHaveProperty("recurrenceStartDate");
    expect(data).not.toHaveProperty("recurrenceEndDate");
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it("rejects a partial block outside configured business hours", async () => {
    await expect(
      createAvailabilityBlock(
        {
          theatreId: "theatre-1",
          eventDate: "2026-07-04",
          isFullDay: false,
          startTime: "08:30",
          endTime: "10:00",
        },
        "admin-1"
      )
    ).rejects.toBeInstanceOf(AvailabilityBlockValidationError);
  });

  it("rejects overlapping active blocks", async () => {
    vi.mocked(prisma.availabilityBlock.findFirst).mockResolvedValue({
      id: "existing-block",
    } as never);

    await expect(
      createAvailabilityBlock(
        {
          theatreId: "theatre-1",
          eventDate: "2026-07-04",
          isFullDay: false,
          startTime: "10:00",
          endTime: "12:00",
        },
        "admin-1"
      )
    ).rejects.toBeInstanceOf(AvailabilityBlockConflictError);
  });

  it("rejects ranges that overlap confirmed bookings", async () => {
    vi.mocked(prisma.booking.findFirst).mockResolvedValue({
      id: "confirmed-booking",
    } as never);

    await expect(
      createAvailabilityBlock(
        {
          theatreId: "theatre-1",
          eventDate: "2026-07-04",
          isFullDay: false,
          startTime: "10:00",
          endTime: "12:00",
        },
        "admin-1"
      )
    ).rejects.toThrow("confirmed booking");
  });

  it("rejects ranges that overlap active booking locks", async () => {
    vi.mocked(prisma.bookingLock.findFirst).mockResolvedValue({
      id: "active-lock",
    } as never);

    await expect(
      createAvailabilityBlock(
        {
          theatreId: "theatre-1",
          eventDate: "2026-07-04",
          isFullDay: false,
          startTime: "10:00",
          endTime: "12:00",
        },
        "admin-1"
      )
    ).rejects.toThrow("customer booking lock");
  });

  it("soft-deactivates an active block", async () => {
    vi.mocked(prisma.availabilityBlock.updateMany).mockResolvedValue({ count: 1 });

    await deactivateAvailabilityBlock("block-1");

    expect(prisma.availabilityBlock.updateMany).toHaveBeenCalledWith({
      where: { id: "block-1", isActive: true },
      data: { isActive: false },
    });
  });
});
