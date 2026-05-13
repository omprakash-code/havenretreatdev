import { BookingStatus, Prisma, PrismaClient } from "@prisma/client";

type DbClient = Prisma.TransactionClient | PrismaClient;

const ACTIVE_LOCK_BOOKING_STATUSES: BookingStatus[] = [
  BookingStatus.INCOMPLETE,
  BookingStatus.AWAITING_PAYMENT,
  BookingStatus.PAYMENT_PROCESSING,
];
const ABANDONABLE_BOOKING_STATUSES: BookingStatus[] = [
  BookingStatus.INCOMPLETE,
];

type OverrideLockedSlotForAdminInput = {
  slotId: string;
  adminId?: string | null;
  now?: Date;
};

export async function overrideLockedSlotForAdmin(
  db: DbClient,
  { slotId, adminId, now = new Date() }: OverrideLockedSlotForAdminInput
) {
  const slot = await db.slot.findUnique({
    where: { id: slotId },
    select: {
      id: true,
      status: true,
      lockedBy: true,
      lockExpiresAt: true,
    },
  });

  if (!slot || slot.status !== "LOCKED") {
    return {
      overridden: false,
      abandonedBookingIds: [] as string[],
    };
  }

  const activeBookings = await db.booking.findMany({
    where: {
      slotId,
      bookingStatus: { in: ACTIVE_LOCK_BOOKING_STATUSES },
    },
    select: { id: true, bookingStatus: true },
  });

  const activeBookingIds = activeBookings.map((booking) => booking.id);
  const abandonedBookingIds = activeBookings
    .filter((booking) => ABANDONABLE_BOOKING_STATUSES.includes(booking.bookingStatus))
    .map((booking) => booking.id);

  if (abandonedBookingIds.length > 0) {
    await db.booking.updateMany({
      where: {
        id: { in: abandonedBookingIds },
      },
      data: {
        bookingStatus: BookingStatus.ABANDONED,
        cancelledAt: now,
        cancelledReason: "ADMIN_LOCK_OVERRIDE",
      },
    });
  }

  if (activeBookingIds.length > 0) {
    await db.couponUsage.updateMany({
      where: {
        bookingId: { in: activeBookingIds },
        status: "RESERVED",
      },
      data: {
        status: "RELEASED",
        discountAmount: 0,
        releasedAt: now,
        confirmedAt: null,
      },
    });
  }

  await db.slot.updateMany({
    where: {
      id: slotId,
      status: "LOCKED",
    },
    data: {
      status: "AVAILABLE",
      lockedBy: null,
      lockedAt: null,
      lockExpiresAt: null,
    },
  });

  console.info("ADMIN_SLOT_LOCK_OVERRIDE", {
    adminId: adminId ?? "admin_unknown",
    slotId,
    timestamp: now.toISOString(),
    abandonedBookingIds,
    abandonedBookingCount: abandonedBookingIds.length,
  });

  return {
    overridden: true,
    abandonedBookingIds,
  };
}
