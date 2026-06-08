import type { BookingSettings, Prisma } from "@prisma/client";
import { z } from "zod";

import { prisma } from "@/lib/db";
import {
  isBookingIntervalAligned,
  timeToMinutes,
} from "@/lib/booking-range";

type DbClient = Prisma.TransactionClient | typeof prisma;

export const DEFAULT_BOOKING_SETTINGS = {
  businessOpenTime: "09:00",
  businessCloseTime: "23:00",
  minimumDurationMinutes: 240,
  bufferMinutes: 60,
  lockDurationMinutes: 10,
  maximumGuests: 50,
} as const;

export const bookingSettingsUpdateSchema = z.object({
  businessOpenTime: z.string(),
  businessCloseTime: z.string(),
  minimumDurationMinutes: z.number().int().min(30).max(24 * 60),
  bufferMinutes: z.number().int().min(0).max(12 * 60),
  lockDurationMinutes: z.number().int().min(1).max(60),
  maximumGuests: z.number().int().min(1).max(10000),
});

export class BookingSettingsValidationError extends Error {}

export function validateBookingSettingsInput(
  input: z.infer<typeof bookingSettingsUpdateSchema>
) {
  const openMinutes = timeToMinutes(input.businessOpenTime);
  const closeMinutes = timeToMinutes(input.businessCloseTime);

  if (
    openMinutes === null ||
    closeMinutes === null ||
    !isBookingIntervalAligned(input.businessOpenTime) ||
    !isBookingIntervalAligned(input.businessCloseTime)
  ) {
    throw new BookingSettingsValidationError(
      "Business hours must use valid 30-minute increments."
    );
  }
  if (closeMinutes <= openMinutes) {
    throw new BookingSettingsValidationError(
      "Business close time must be after open time."
    );
  }
  if (input.minimumDurationMinutes % 30 !== 0) {
    throw new BookingSettingsValidationError(
      "Minimum duration must use 30-minute increments."
    );
  }
  if (input.bufferMinutes % 30 !== 0) {
    throw new BookingSettingsValidationError(
      "Buffer must use 30-minute increments."
    );
  }
  if (input.minimumDurationMinutes > closeMinutes - openMinutes) {
    throw new BookingSettingsValidationError(
      "Minimum duration cannot exceed business hours."
    );
  }
}

export async function getOrCreateBookingSettings(
  theatreId: string,
  db: DbClient = prisma
): Promise<BookingSettings> {
  const theatre = await db.theatre.findUnique({
    where: { id: theatreId },
    select: { id: true },
  });
  if (!theatre) {
    throw new BookingSettingsValidationError("Theatre not found.");
  }

  return db.bookingSettings.upsert({
    where: { theatreId },
    update: {},
    create: {
      theatreId,
      ...DEFAULT_BOOKING_SETTINGS,
    },
  });
}

export async function updateBookingSettings(
  theatreId: string,
  input: z.infer<typeof bookingSettingsUpdateSchema>,
  db: DbClient = prisma
) {
  validateBookingSettingsInput(input);
  await getOrCreateBookingSettings(theatreId, db);

  return db.bookingSettings.update({
    where: { theatreId },
    data: input,
  });
}
