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

export class BookingOverlapError extends Error {
  constructor(message = "This time range is currently reserved.") {
    super(message);
    this.name = "BookingOverlapError";
  }
}

export function assertValidTimeRange({ startTime, endTime }: TimeRangeInput) {
  if (endTime <= startTime) {
    throw new BookingOverlapError("End time must be after start time.");
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
