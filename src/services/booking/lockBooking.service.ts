//src/services/booking/lockBooking.service.ts
import { prisma } from "@/lib/db";
import {
  BOOKING_LOCK_MINUTES_KEY,
  BOOKING_LOCK_MINUTES_MAX,
  BOOKING_LOCK_MINUTES_MIN,
  DEFAULT_BOOKING_LOCK_MINUTES,
} from "@/lib/app-settings";
import { generateBookingRef } from "./bookingId.service";
import { toDateKey } from "@/lib/date";
import { isSlotExpiredInIST } from "@/lib/slot-time";
import { releaseSiblingSessionLocks } from "./booking-lock-lifecycle.service";
import { resolveSlotExpiryConfig } from "./slot-expiry-config.service";
import { notifyAbandonedBookingsByIds } from "@/services/booking/booking-abandonment-email.service";

export const BOOKING_LOCK_MINUTES = DEFAULT_BOOKING_LOCK_MINUTES;
const ADMIN_SOFT_DELETE_REASON = "ADMIN_SOFT_DELETED";
const LOCK_BOOKING_ABANDONMENT_NOTIFY_ERROR =
  "LOCK_BOOKING_ABANDONMENT_NOTIFY_FAILED";

type LockBookingInput = {
  slotId: string;
  theatreId: string;
  lockOwner: string;
  currentBookingId?: string | null;
};

type LockBookingResult = {
  booking: {
    id: string;
  };
  lockExpiresAt: Date | null;
};

type LockBookingTransactionResult = LockBookingResult & {
  abandonedBookingIds: string[];
};

const ACTIVE_BOOKING_STATUSES = [
  "INCOMPLETE",
  "AWAITING_PAYMENT",
  "PAYMENT_PROCESSING",
] as const;

function normalizeLockWindowMinutes(rawValue: unknown) {
  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed)) return BOOKING_LOCK_MINUTES;
  const normalized = Math.trunc(parsed);
  if (normalized < BOOKING_LOCK_MINUTES_MIN) return BOOKING_LOCK_MINUTES_MIN;
  if (normalized > BOOKING_LOCK_MINUTES_MAX) return BOOKING_LOCK_MINUTES_MAX;
  return normalized;
}

type LockSettingReader = {
  appSetting?: typeof prisma.appSetting;
};

export async function resolveBookingLockMinutes(
  reader: LockSettingReader = prisma
) {
  const appSettingDelegate = reader?.appSetting;
  if (!appSettingDelegate) {
    return BOOKING_LOCK_MINUTES;
  }

  try {
    const row = await appSettingDelegate.findUnique({
      where: { key: BOOKING_LOCK_MINUTES_KEY },
      select: { value: true },
    });
    return normalizeLockWindowMinutes(row?.value);
  } catch {
    return BOOKING_LOCK_MINUTES;
  }
}

export async function lockBookingService({
  slotId,
  theatreId,
  lockOwner,
  currentBookingId = null,
}: LockBookingInput) {
  const result = await prisma.$transaction(async (tx): Promise<LockBookingTransactionResult> => {
    const now = new Date();
    const lockWindowMinutes = await resolveBookingLockMinutes(tx);
    const lockExpiresAt = new Date(
      now.getTime() + lockWindowMinutes * 60 * 1000
    );
    const abandonedBookingIdsToNotify = new Set<string>();

    /* ---------------------------------
       1. Auto-heal expired / corrupt locks
    ---------------------------------- */
    await tx.slot.updateMany({
      where: {
        status: "LOCKED",
        OR: [
          { lockExpiresAt: { lt: now } },
          { lockExpiresAt: null },
          { lockedAt: null },
        ],
      },
      data: {
        status: "AVAILABLE",
        lockedAt: null,
        lockExpiresAt: null,
        lockedBy: null,
      },
    });

    /* ---------------------------------
       2. Auto-expire abandoned bookings
    ---------------------------------- */
    const staleIncompleteBookings = await tx.booking.findMany({
      where: {
        bookingStatus: "INCOMPLETE",
        OR: [{ createdByRole: null }, { createdByRole: { not: "ADMIN" } }],
        createdAt: {
          lt: new Date(now.getTime() - lockWindowMinutes * 60 * 1000),
        },
      },
      select: { id: true },
    });

    if (staleIncompleteBookings.length > 0) {
      const staleBookingIds = staleIncompleteBookings.map((booking) => booking.id);
      await tx.booking.updateMany({
        where: {
          id: { in: staleBookingIds },
        },
        data: {
          bookingStatus: "ABANDONED",
          cancelledAt: now,
          cancelledReason: "AUTO_EXPIRED",
        },
      });

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

      staleBookingIds.forEach((id) => abandonedBookingIdsToNotify.add(id));
    }

    /* ---------------------------------
       3. Fetch slot
    ---------------------------------- */
    const slot = await tx.slot.findUnique({
      where: { id: slotId },
    });

    if (!slot || slot.theatreId !== theatreId) {
      throw new Error("SLOT_NOT_FOUND");
    }

    /* ---------------------------------
       4. Reconcile BOOKED status against active confirmed booking linkage
    ---------------------------------- */
    const activeConfirmedBookingCount = await tx.booking.count({
      where: {
        slotId,
        bookingStatus: "CONFIRMED",
        OR: [
          { cancelledReason: null },
          { cancelledReason: { not: ADMIN_SOFT_DELETE_REASON } },
        ],
      },
    });

    if (activeConfirmedBookingCount > 0) {
      if (slot.status !== "BOOKED") {
        await tx.slot.updateMany({
          where: { id: slotId, status: "AVAILABLE" },
          data: { status: "BOOKED" },
        });
      }
      throw new Error("SLOT_ALREADY_BOOKED");
    }

    if (slot.status === "BOOKED") {
      await tx.slot.updateMany({
        where: { id: slotId, status: "BOOKED" },
        data: {
          status: "AVAILABLE",
          lockedAt: null,
          lockExpiresAt: null,
          lockedBy: null,
        },
      });
      slot.status = "AVAILABLE";
      slot.lockedAt = null;
      slot.lockExpiresAt = null;
      slot.lockedBy = null;
    }

    if (slot.status === "DISABLED") {
      throw new Error("SLOT_NOT_AVAILABLE");
    }

    if (slot.status === "LOCKED") {
      const activeBooking = await tx.booking.findFirst({
        where: {
          slotId,
          bookingStatus: {
            in: [...ACTIVE_BOOKING_STATUSES],
          },
        },
        orderBy: { createdAt: "desc" },
      });

      // No active booking linked to locked slot => orphan/stale lock, auto-release.
      if (!activeBooking) {
        await tx.slot.updateMany({
          where: { id: slotId, status: "LOCKED" },
          data: {
            status: "AVAILABLE",
            lockedBy: null,
            lockedAt: null,
            lockExpiresAt: null,
          },
        });
      } else {
        const bookingContextMatches =
          currentBookingId != null &&
          activeBooking.id === currentBookingId;
        const lockOwnerMatches = slot.lockedBy === lockOwner;

        // Idempotent path for same active booking context
        // OR same lock owner trying to reopen their own reserved slot.
        if (bookingContextMatches || lockOwnerMatches) {
          return {
            booking: activeBooking,
            lockExpiresAt: slot.lockExpiresAt ?? null,
            abandonedBookingIds: [],
          };
        }

        throw new Error("LOCK_IN_USE");
      }
    }
    const slotExpiryConfig = await resolveSlotExpiryConfig(tx);
    const isExpired = isSlotExpiredInIST(
      { startTime: slot.startTime, endTime: slot.endTime },
      slot.date,
      slotExpiryConfig
    );

    if (isExpired) {
      throw new Error("SLOT_NOT_AVAILABLE");
    }




    /* ---------------------------------
       5. Lock slot FIRST (source of truth)
    ---------------------------------- */
    const lockResult = await tx.slot.updateMany({
      where: {
        id: slotId,
        theatreId,
        status: "AVAILABLE",
      },
      data: {
        status: "LOCKED",
        lockedAt: now,
        lockExpiresAt,
        lockedBy: lockOwner,
      },
    });

    if (lockResult.count === 0) {
      throw new Error("LOCK_IN_USE");
    }

    /* ---------------------------------
       5.1 Keep only one active lock for this session owner
    ---------------------------------- */
    const siblingReleaseResult = await releaseSiblingSessionLocks(tx, {
      lockOwner,
      keepSlotId: slotId,
      now,
      cancelledReason: "SESSION_SLOT_SWITCHED",
    });
    siblingReleaseResult.releasedBookingIds.forEach((id) =>
      abandonedBookingIdsToNotify.add(id)
    );

    /* -------------------------------------------
       6. Create or reuse INCOMPLETE booking ONLY
    ------------------------------------------- */
    const basePrice = slot.finalPrice ?? slot.basePrice;

    const existingBooking = await tx.booking.findFirst({
      where: {
        slotId,
        bookingStatus: "INCOMPLETE",
        slot: {
          lockedBy: lockOwner,
        },
      },
      orderBy: { createdAt: "desc" },
    });


    let booking;

    if (existingBooking) {
      await tx.couponUsage.updateMany({
        where: {
          bookingId: existingBooking.id,
          status: "RESERVED",
        },
        data: {
          status: "RELEASED",
          discountAmount: 0,
          releasedAt: now,
          confirmedAt: null,
        },
      });

      booking = await tx.booking.update({
        where: { id: existingBooking.id },
        data: {
          paymentStatus: null,
          guestCount: 0,
          baseAmount: basePrice,
          extrasAmount: 0,
          decorationAmount: 0,
          discountAmount: 0,
          totalAmount: basePrice,
          advancePaid: 0,
          remainingPayable: basePrice,
          cancelledAt: null,
          cancelledReason: null,
          updatedAt: now,
        },
      });
    } else {
      booking = await tx.booking.create({
        data: {
          bookingRef: "TEMP",
          bookingStatus: "INCOMPLETE",
          paymentStatus: null,

          guestCount: 1,
          baseAmount: basePrice,
          extrasAmount: 0,
          decorationAmount: 0,
          discountAmount: 0,
          totalAmount: basePrice,

          advancePaid: 0,
          remainingPayable: basePrice,

          theatre: { connect: { id: theatreId } },
          slot: { connect: { id: slotId } },
        },
      });
    }

    /* ---------------------------------
       7. Generate booking reference
    ---------------------------------- */
    const todayKey = toDateKey(now);
    const todayCount = await tx.booking.count({
      where: {
        createdAt: {
          gte: new Date(todayKey),
        },
      },
    });



    await tx.booking.update({
      where: { id: booking.id },
      data: {
        bookingRef: generateBookingRef(new Date(), todayCount + 1),
      },
    });

    return {
      booking,
      lockExpiresAt,
      abandonedBookingIds: Array.from(abandonedBookingIdsToNotify),
    };
  });

  if (result.abandonedBookingIds.length > 0) {
    void notifyAbandonedBookingsByIds(result.abandonedBookingIds).catch(
      (error) => {
        console.error(LOCK_BOOKING_ABANDONMENT_NOTIFY_ERROR, error);
      }
    );
  }

  return {
    booking: result.booking,
    lockExpiresAt: result.lockExpiresAt,
  };
}
