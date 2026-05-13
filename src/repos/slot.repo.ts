//src/repos/slot.repo.ts

// ------------------------------------------------------
// SLOT GENERATION HELPERS (already correct)
// ------------------------------------------------------

import { prisma } from "@/lib/db";

// Repo layer ensures DB integrity and prevents duplicate slots
// Prevent duplicate slot generation
export async function slotExists(
  theatreId: string,
  templateId: string,
  date: Date
) {
  return prisma.slot.findFirst({
    where: {
      theatreId,
      slotTemplateId: templateId,
      date,
    },
  });
}

// Create a new slot from template
export async function createSlot(data: {
  theatreId: string;
  slotTemplateId: string;
  date: Date;
  startTime: string;
  endTime: string;
  price: number;
  durationMin: number; 
  baseGuests: number; 
}) {
  return prisma.slot.create({
    data: {
      theatreId: data.theatreId,
      slotTemplateId: data.slotTemplateId,
      date: data.date,
      startTime: data.startTime,
      endTime: data.endTime,
      regularPrice: data.price,
      finalPrice: data.price,
      durationMin: data.durationMin, 
      basePrice: data.price,         
      baseGuests: data.baseGuests,  
    },
  });
}


// ------------------------------------------------------
// ADMIN SLOT MANAGEMENT (new additions)
// ------------------------------------------------------

/**
 * Fetch all slots for a theatre on a specific date
 * Used for overlap validation before admin updates
 */
export async function getSlotsForDate(
  theatreId: string,
  date: Date
) {
  return prisma.slot.findMany({
    where: {
      theatreId,
      date,
    },
    orderBy: {
      startTime: "asc",
    },
  });
}

/**
 * Update slot timing or price
 * Used by admin override actions
 */
export async function updateSlot(
  slotId: string,
  data: Partial<{
    startTime: string;
    endTime: string;
    finalPrice: number;
    status: "AVAILABLE" | "BOOKED" | "DISABLED";
  }>
) {
  return prisma.slot.update({
    where: { id: slotId },
    data,
  });
}