import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    theatre: { findUnique: vi.fn() },
    bookingSettings: {
      upsert: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/db";
import {
  DEFAULT_BOOKING_SETTINGS,
  BookingSettingsValidationError,
  getOrCreateBookingSettings,
  updateBookingSettings,
} from "@/services/booking/booking-settings.service";

describe("booking settings service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.theatre.findUnique).mockResolvedValue({
      id: "theatre-1",
    } as never);
  });

  it("creates default settings for a theatre", async () => {
    vi.mocked(prisma.bookingSettings.upsert).mockResolvedValue({
      id: "settings-1",
      theatreId: "theatre-1",
      ...DEFAULT_BOOKING_SETTINGS,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await getOrCreateBookingSettings("theatre-1");

    expect(prisma.bookingSettings.upsert).toHaveBeenCalledWith({
      where: { theatreId: "theatre-1" },
      update: {},
      create: {
        theatreId: "theatre-1",
        ...DEFAULT_BOOKING_SETTINGS,
      },
    });
  });

  it("rejects settings that are not aligned to 30 minutes", async () => {
    await expect(
      updateBookingSettings("theatre-1", {
        businessOpenTime: "09:15",
        businessCloseTime: "23:00",
        minimumDurationMinutes: 240,
        bufferMinutes: 60,
        lockDurationMinutes: 10,
        maximumGuests: 50,
      })
    ).rejects.toBeInstanceOf(BookingSettingsValidationError);

    expect(prisma.bookingSettings.update).not.toHaveBeenCalled();
  });

  it("persists maximumGuests rather than deriving a fixed capacity", async () => {
    vi.mocked(prisma.bookingSettings.upsert).mockResolvedValue({} as never);
    vi.mocked(prisma.bookingSettings.update).mockResolvedValue({} as never);

    await updateBookingSettings("theatre-1", {
      businessOpenTime: "09:00",
      businessCloseTime: "23:00",
      minimumDurationMinutes: 240,
      bufferMinutes: 60,
      lockDurationMinutes: 10,
      maximumGuests: 65,
    });

    expect(prisma.bookingSettings.update).toHaveBeenCalledWith({
      where: { theatreId: "theatre-1" },
      data: expect.objectContaining({ maximumGuests: 65 }),
    });
  });
});
