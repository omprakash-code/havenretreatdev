// src/services/slot.service.ts
import { prisma } from "@/lib/db";
import * as slotRepo from "@/repos/slot.repo";
import { addDays } from "date-fns";
import { toDate, formatInTimeZone } from "date-fns-tz";
import { isOverlapping } from "@/lib/time";

const IST_TIMEZONE = "Asia/Kolkata";
const ADMIN_SOFT_DELETE_REASON = "ADMIN_SOFT_DELETED";

/**
 * Generates date-specific slots from reusable templates
 * Designed to run:
 * - First time: generate 1 year
 * - Later: cron for rolling 3 months
 */
export async function generateSlotsForTheatre(
  theatreId: string,
  days = 365
) {
  const theatre = await prisma.theatre.findUnique({
    where: { id: theatreId },
    include: { slotTemplates: true },
  });

  if (!theatre) throw new Error("Theatre not found");

  // Get today's date in IST at midnight (correct way with timezone)
  const now = new Date();
  const todayISTStr = formatInTimeZone(now, IST_TIMEZONE, "yyyy-MM-dd");
  const todayIST = toDate(todayISTStr + "T00:00:00+05:30", { timeZone: IST_TIMEZONE });

  for (let i = 0; i < days; i++) {
    // Calculate slot date in IST
    const slotDateISTStr = formatInTimeZone(addDays(todayIST, i), IST_TIMEZONE, "yyyy-MM-dd");
    const slotDateIST = toDate(slotDateISTStr + "T00:00:00+05:30", { timeZone: IST_TIMEZONE });

    for (const template of theatre.slotTemplates) {
      if (!template.isActive) continue;

      const exists = await slotRepo.slotExists(
        theatre.id,
        template.id,
        slotDateIST
      );

      if (exists) continue;

      await slotRepo.createSlot({
        theatreId: theatre.id,
        slotTemplateId: template.id,
        date: slotDateIST,
        startTime: template.startTime,
        endTime: template.endTime,
        price: template.regularPrice,
        durationMin: template.durationMin,
        baseGuests: theatre.baseGuests,
      });
    }
  }
}

/**
 * Validates slot time changes
 * This function is the HEART of booking safety
 */
export async function validateSlotUpdate(
  slotId: string,
  theatreId: string,
  date: Date,
  newStart: string,
  newEnd: string,
  bufferMin: number
) {
  const existingSlots = await slotRepo.getSlotsForDate(theatreId, date);

  for (const slot of existingSlots) {
    // Skip self during update
    if (slot.id === slotId) continue;

    if (
      isOverlapping(
        newStart,
        newEnd,
        slot.startTime,
        slot.endTime,
        bufferMin
      )
    ) {
      throw new Error(
        `Slot overlaps with ${slot.startTime}-${slot.endTime}`
      );
    }
  }
}

/**
 * Admin-only slot edit
 * - Supports booked slots
 * - Payment handled manually at theatre
 */
export async function adminUpdateSlotTime(
  slotId: string,
  data: {
    startTime: string;
    endTime: string;
    finalPrice?: number;
  }
) {
  const slot = await prisma.slot.findUnique({
    where: { id: slotId },
    include: {
      bookings: {
        where: {
          bookingStatus: "CONFIRMED",
          OR: [
            { cancelledReason: null },
            { cancelledReason: { not: ADMIN_SOFT_DELETE_REASON } },
          ],
        },
      },
    },
  });


  if (!slot) throw new Error("Slot not found");

  await validateSlotUpdate(
    slot.id,
    slot.theatreId,
    slot.date,
    data.startTime,
    data.endTime,
    30 // buffer minutes
  );

  /**
   * IMPORTANT:
   * If slot is BOOKED and price increases,
   * remaining amount is collected manually.
   * No auto-charging here to avoid payment complexity.
   */
  return slotRepo.updateSlot(slotId, data);
}
