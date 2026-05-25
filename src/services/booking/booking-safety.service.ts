import { Prisma } from "@prisma/client";

export const ACTIVE_OVERLAP_BOOKING_STATUSES = [
  "INCOMPLETE",
  "AWAITING_PAYMENT",
  "PAYMENT_PROCESSING",
  "CONFIRMED",
] as const;

type BookingSafetyTx = Prisma.TransactionClient;

type TimeRangeInput = {
  startTime: string;
  endTime: string;
};

type OverlapValidationInput = TimeRangeInput & {
  theatreId: string;
  date: Date;
  excludeBookingId?: string | null;
  allowLockOwner?: string | null;
  context: string;
};

type SlotLockInput = {
  slotId: string;
  context: string;
};

export class BookingOverlapError extends Error {
  constructor(message = "This time range is currently reserved.") {
    super(message);
    this.name = "BookingOverlapError";
  }
}

export class BookingSlotLockError extends Error {
  constructor(message = "Unable to lock booking slot.") {
    super(message);
    this.name = "BookingSlotLockError";
  }
}

export function assertValidTimeRange({ startTime, endTime }: TimeRangeInput) {
  if (endTime <= startTime) {
    throw new BookingOverlapError("End time must be after start time.");
  }
}

export async function lockSlotRowForUpdate(
  tx: BookingSafetyTx,
  { slotId, context }: SlotLockInput
) {
  const rows = await tx.$queryRaw<{ id: string }[]>(Prisma.sql`
    SELECT id
    FROM "Slot"
    WHERE id = ${slotId}
    FOR UPDATE
  `);

  if (rows.length === 0) {
    console.warn("BOOKING_SLOT_LOCK_MISSING", { slotId, context });
    throw new BookingSlotLockError("Slot does not exist.");
  }
}

export async function validateNoOverlappingActiveBooking(
  tx: BookingSafetyTx,
  input: OverlapValidationInput
) {
  assertValidTimeRange(input);

  const conflictingBooking = await tx.booking.findFirst({
    where: {
      theatreId: input.theatreId,
      bookingStatus: { in: [...ACTIVE_OVERLAP_BOOKING_STATUSES] },
      ...(input.excludeBookingId ? { id: { not: input.excludeBookingId } } : {}),
      slot: {
        date: input.date,
        startTime: { lt: input.endTime },
        endTime: { gt: input.startTime },
        ...(input.allowLockOwner
          ? {
              OR: [
                { lockedBy: null },
                { lockedBy: { not: input.allowLockOwner } },
              ],
            }
          : {}),
      },
    },
    select: {
      id: true,
      bookingStatus: true,
      slotId: true,
    },
  });

  if (conflictingBooking) {
    console.warn("BOOKING_OVERLAP_REJECTED", {
      context: input.context,
      theatreId: input.theatreId,
      date: input.date.toISOString(),
      startTime: input.startTime,
      endTime: input.endTime,
      conflictingBookingId: conflictingBooking.id,
      conflictingSlotId: conflictingBooking.slotId,
      conflictingStatus: conflictingBooking.bookingStatus,
    });
    throw new BookingOverlapError();
  }
}

export function logBookingSafetyEvent(
  event: string,
  payload: Record<string, unknown>
) {
  console.info(event, payload);
}
