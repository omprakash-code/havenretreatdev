import { prisma } from "@/lib/db";
import { toDate } from "date-fns-tz";
import { isSlotExpiredInIST } from "@/lib/slot-time";
import { resolveSlotExpiryConfig } from "@/services/booking/slot-expiry-config.service";
import { normalizeTheatreCardContent } from "@/lib/theatre-card-content";

const IST_TIMEZONE = "Asia/Kolkata";
const LOCK_LIFECYCLE_BOOKING_STATUSES = [
  "INCOMPLETE",
  "AWAITING_PAYMENT",
  "PAYMENT_PROCESSING",
] as const;

/* Existing function – keep as is */
export async function findAllTheatres() {
  return prisma.theatre.findMany({
    orderBy: { createdAt: "desc" },
  });
}

/* NEW: Fetch theatres with slots by location + date */
export async function findTheatresWithSlotsByLocationAndDate(
  locationId: string,
  date: string,
  guestToken: string | null
) {
  // Convert date string to IST midnight
  // date string is in format YYYY-MM-DD (IST date)
  const dateInIST = toDate(`${date}T00:00:00+05:30`, { timeZone: IST_TIMEZONE });

  const theatres = await prisma.theatre.findMany({
    where: { locationId, isActive: true },
    include: {
      slots: {
        where: {
          date: dateInIST,
        },
        orderBy: { startTime: "asc" },
      },
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  const now = Date.now();
  const slotExpiryConfig = await resolveSlotExpiryConfig();

  // console.log("[THEATRE REPO] incoming date param:", date);
  // console.log("[THEATRE REPO] computed dateInIST:", dateInIST.toISOString());

  return theatres.map((theatre) => {
    // Keep runtime-safe access so code works even if local Prisma client types are stale.
    const rawCardContent = (theatre as { cardContent?: unknown }).cardContent;

    return {
      ...theatre,
      menuFile: theatre.menuFile ?? null,
      mapUrl: theatre.mapUrl ?? null,
      cardContent: normalizeTheatreCardContent(rawCardContent),
      images: theatre.images.map((url) => ({
        url,
        type: url.endsWith(".mp4") || url.endsWith(".webm") ? "video" : "image",
      })),
      slots: theatre.slots.map((slot) => {
      const normalizedStatus = slot.status;
      const isExpired = isSlotExpiredInIST(
        { startTime: slot.startTime, endTime: slot.endTime },
        slot.date,
        slotExpiryConfig
      );
      const isActuallyBooked = normalizedStatus === "BOOKED";

      const lockRemainingSec =
        slot.lockExpiresAt
          ? Math.max(
            0,
            Math.floor(
              (new Date(slot.lockExpiresAt).getTime() - now) / 1000
            )
          )
          : null;

      const isLocked = normalizedStatus === "LOCKED" && !isExpired;
      const isBooked = isActuallyBooked || isExpired;
      const isLockedByMe =
        isLocked && guestToken !== null && slot.lockedBy === guestToken;

        // console.log("[THEATRE REPO] slot.date:", slot.date.toISOString());

      return {
        ...slot,
        status: normalizedStatus,
        isExpired,
        isBooked,
        isLocked,
        isLockedByMe,
        isAvailable: normalizedStatus === "AVAILABLE" && !isExpired,
        lockRemainingSec,
        statusLabel: isActuallyBooked
          ? "Booked"
          : isExpired
            ? "Expired"
          : isLockedByMe
            ? "Reserved for you"
            : isLocked
              ? "Locked"
              : "Available",
      };
    }),
    };
  });
}

export async function findTheatreAvailabilityCountsByLocationAndDate(
  locationId: string,
  date: string,
  guestToken: string | null
) {
  const dateInIST = toDate(`${date}T00:00:00+05:30`, { timeZone: IST_TIMEZONE });
  const slotExpiryConfig = await resolveSlotExpiryConfig();

  const theatres = await prisma.theatre.findMany({
    where: { locationId, isActive: true },
    select: {
      id: true,
      slots: {
        where: { date: dateInIST },
        select: {
          status: true,
          startTime: true,
          endTime: true,
          date: true,
          lockedBy: true,
        },
      },
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  return theatres.reduce<Record<string, number>>((acc, theatre) => {
    const count = theatre.slots.filter((slot) => {
      const isExpired = isSlotExpiredInIST(
        { startTime: slot.startTime, endTime: slot.endTime },
        slot.date,
        slotExpiryConfig
      );
      if (isExpired) return false;
      if (slot.status === "BOOKED" || slot.status === "DISABLED") return false;
      if (slot.status === "LOCKED" && slot.lockedBy !== guestToken) return false;
      return true;
    }).length;

    acc[theatre.id] = count;
    return acc;
  }, {});
}

/* NEW: Auto-unlock expired slots or manual locked slot or currupted slot */
export async function unlockExpiredSlots() {
  const now = new Date();

  return prisma.$transaction(async (tx) => {
    const staleLockedSlots = await tx.slot.findMany({
      where: {
        OR: [
          {
            // Legit temporary locks that expired
            status: "LOCKED",
            lockExpiresAt: { lt: now },
          },
          {
            // Corrupted locks (clear manual/bad update/crash slot)
            status: "LOCKED",
            lockExpiresAt: null,
          },
        ],
      },
      select: {
        id: true,
      },
    });

    if (staleLockedSlots.length === 0) {
      return { count: 0 };
    }

    const staleSlotIds = staleLockedSlots.map((slot) => slot.id);

    const unlockResult = await tx.slot.updateMany({
      where: {
        id: { in: staleSlotIds },
        status: "LOCKED",
      },
      data: {
        status: "AVAILABLE",
        lockedAt: null,
        lockExpiresAt: null,
        lockedBy: null,
      },
    });

    // Keep booking state consistent with unlocked stale locks.
    const staleActiveBookings = await tx.booking.findMany({
      where: {
        slotId: { in: staleSlotIds },
        bookingStatus: { in: [...LOCK_LIFECYCLE_BOOKING_STATUSES] },
        slot: {
          status: "AVAILABLE",
          lockedBy: null,
          lockExpiresAt: null,
        },
      },
      select: {
        id: true,
        bookingStatus: true,
      },
    });

    if (staleActiveBookings.length > 0) {
      const staleBookingIds = staleActiveBookings.map((booking) => booking.id);
      const abandonedBookingIds = staleActiveBookings
        .filter((booking) => booking.bookingStatus === "INCOMPLETE")
        .map((booking) => booking.id);

      if (abandonedBookingIds.length > 0) {
        await tx.booking.updateMany({
          where: {
            id: { in: abandonedBookingIds },
          },
          data: {
            bookingStatus: "ABANDONED",
            cancelledAt: now,
            cancelledReason: "AUTO_EXPIRED",
          },
        });
      }

      await tx.couponUsage.updateMany({
        where: {
          bookingId: { in: staleBookingIds },
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

    return unlockResult;
  });
}
