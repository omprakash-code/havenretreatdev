import { prisma } from "@/lib/db";

//------------------------------------------------------
// BOOKING CREATION (new additions)
//------------------------------------------------------
/**
 * Create booking inside transaction
 * Prevents partial writes
 */
export async function createBookingTx(data: {
  userId?: string; //optional
  slotId: string;
  theatreId: string;
  guestCount: number;
  occasion?: string;
  amounts: {
    base: number;
    extras: number;
    discount: number;
    total: number;
    advance: number;
  };
}) {
  return prisma.$transaction(async (tx) => {
    const booking = await tx.booking.create({
      data: {
        userId: data.userId ?? null, // SAFE

        slotId: data.slotId,
        theatreId: data.theatreId,
        guestCount: data.guestCount,
        occasionLabel: data.occasion,

        baseAmount: data.amounts.base,
        extrasAmount: data.amounts.extras,
        discountAmount: data.amounts.discount,
        totalAmount: data.amounts.total,

        advancePaid: data.amounts.advance ?? 0,
        remainingPayable: data.amounts.total - (data.amounts.advance ?? 0),

        bookingStatus: "INCOMPLETE",
        paymentStatus: "AWAITING_PAYMENT",
        bookingRef: "TEMP",
      },
    });

    return booking;
  });
}
