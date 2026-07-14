import type { Prisma } from "@prisma/client";
import { formatInTimeZone } from "date-fns-tz";
import { BOOKING_TIME_ZONE } from "@/lib/booking-policy";

const MAX_YEARLY_BOOKINGS = 99_999;

type CounterRow = {
  lastNumber: number;
};

/**
 * Allocates a customer-facing booking reference.
 *
 * Format: HRMMDDYYYYNNNNN
 * Example: HR0607202600001 = June 7, 2026, booking sequence 00001.
 *
 * The counter is shared across all booking creation paths and resets only
 * when the Miami calendar year changes.
 */
export async function allocateBookingRef(
  tx: Prisma.TransactionClient,
  now = new Date()
) {
  const year = Number(
    formatInTimeZone(now, BOOKING_TIME_ZONE, "yyyy")
  );
  const datePart = formatInTimeZone(
    now,
    BOOKING_TIME_ZONE,
    "MMddyyyy"
  );

  const rows = await tx.$queryRaw<CounterRow[]>`
    INSERT INTO "BookingReferenceCounter" (
      "year",
      "lastNumber",
      "createdAt",
      "updatedAt"
    )
    VALUES (${year}, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT ("year")
    DO UPDATE SET
      "lastNumber" = "BookingReferenceCounter"."lastNumber" + 1,
      "updatedAt" = CURRENT_TIMESTAMP
    RETURNING "lastNumber"
  `;

  const sequence = rows[0]?.lastNumber;
  if (!Number.isInteger(sequence) || sequence < 1) {
    throw new Error("Unable to allocate a booking reference.");
  }
  if (sequence > MAX_YEARLY_BOOKINGS) {
    throw new Error(`Booking reference capacity reached for ${year}.`);
  }

  return `HR${datePart}${String(sequence).padStart(5, "0")}`;
}
