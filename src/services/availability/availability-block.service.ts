import type { Prisma } from "@prisma/client";
import { z } from "zod";

import { prisma } from "@/lib/db";
import {
  isBookingIntervalAligned,
  isDateKey,
  localBookingTimeToUtc,
  timeToMinutes,
  toBookingDate,
} from "@/lib/booking-range";
import { getOrCreateBookingSettings } from "@/services/booking/booking-settings.service";

type DbClient = Prisma.TransactionClient | typeof prisma;

export const availabilityBlockInputSchema = z.object({
  theatreId: z.string().trim().min(1),
  eventDate: z.string(),
  isFullDay: z.boolean(),
  startTime: z.string().nullable().optional(),
  endTime: z.string().nullable().optional(),
  internalNote: z.string().trim().max(1000).nullable().optional(),
});

export class AvailabilityBlockValidationError extends Error {}
export class AvailabilityBlockConflictError extends Error {}
export class AvailabilityBlockNotFoundError extends Error {}

type AvailabilityBlockInput = z.infer<typeof availabilityBlockInputSchema>;
type NormalizedBlock = Awaited<ReturnType<typeof normalizeBlockInput>>;

async function acquireTheatreDateLock(
  tx: Prisma.TransactionClient,
  theatreId: string,
  eventDate: Date
) {
  const dateKey = eventDate.toISOString().slice(0, 10);
  await tx.$queryRaw`
    SELECT pg_advisory_xact_lock(
      hashtext(${theatreId}),
      hashtext(${dateKey})
    )::text AS "lock"
  `;
}

async function normalizeBlockInput(input: AvailabilityBlockInput, db: DbClient) {
  if (!isDateKey(input.eventDate)) {
    throw new AvailabilityBlockValidationError("Use a valid YYYY-MM-DD date.");
  }

  const settings = await getOrCreateBookingSettings(input.theatreId, db);
  const theatre = await db.theatre.findUnique({
    where: { id: input.theatreId },
    select: { timezone: true },
  });
  if (!theatre) {
    throw new AvailabilityBlockValidationError("Theatre not found.");
  }
  const eventDate = toBookingDate(input.eventDate, theatre.timezone);

  if (input.isFullDay) {
    return {
      theatreId: input.theatreId,
      eventDate,
      isFullDay: true,
      startTime: null,
      endTime: null,
      startsAtUtc: localBookingTimeToUtc(
        input.eventDate,
        settings.businessOpenTime,
        theatre.timezone
      ),
      endsAtUtc: localBookingTimeToUtc(
        input.eventDate,
        settings.businessCloseTime,
        theatre.timezone
      ),
      internalNote: input.internalNote || null,
    };
  }

  const startTime = input.startTime ?? "";
  const endTime = input.endTime ?? "";
  const startMinutes = timeToMinutes(startTime);
  const endMinutes = timeToMinutes(endTime);
  const openMinutes = timeToMinutes(settings.businessOpenTime);
  const closeMinutes = timeToMinutes(settings.businessCloseTime);

  if (
    startMinutes === null ||
    endMinutes === null ||
    !isBookingIntervalAligned(startTime) ||
    !isBookingIntervalAligned(endTime)
  ) {
    throw new AvailabilityBlockValidationError(
      "Block times must use valid 30-minute increments."
    );
  }
  if (endMinutes <= startMinutes) {
    throw new AvailabilityBlockValidationError(
      "Block end time must be after start time."
    );
  }
  if (
    openMinutes === null ||
    closeMinutes === null ||
    startMinutes < openMinutes ||
    endMinutes > closeMinutes
  ) {
    throw new AvailabilityBlockValidationError(
      "Block must be within business hours."
    );
  }

  return {
    theatreId: input.theatreId,
    eventDate,
    isFullDay: false,
    startTime,
    endTime,
    startsAtUtc: localBookingTimeToUtc(
      input.eventDate,
      startTime,
      theatre.timezone
    ),
    endsAtUtc: localBookingTimeToUtc(
      input.eventDate,
      endTime,
      theatre.timezone
    ),
    internalNote: input.internalNote || null,
  };
}

async function assertRangeAvailableForBlock(
  data: NormalizedBlock,
  db: DbClient,
  excludeId?: string
) {
  const now = new Date();
  const [blockConflict, bookingConflict, lockConflict] = await Promise.all([
    db.availabilityBlock.findFirst({
      where: {
        theatreId: data.theatreId,
        eventDate: data.eventDate,
        isActive: true,
        ...(excludeId ? { id: { not: excludeId } } : {}),
        OR: [
          { isFullDay: true },
          {
            startsAtUtc: { lt: data.endsAtUtc },
            endsAtUtc: { gt: data.startsAtUtc },
          },
        ],
      },
      select: { id: true },
    }),
    db.booking.findFirst({
      where: {
        theatreId: data.theatreId,
        bookingStatus: "CONFIRMED",
        startsAtUtc: { lt: data.endsAtUtc },
        occupiedUntilUtc: { gt: data.startsAtUtc },
      },
      select: { id: true },
    }),
    db.bookingLock.findFirst({
      where: {
        theatreId: data.theatreId,
        status: "ACTIVE",
        expiresAt: { gt: now },
        startsAtUtc: { lt: data.endsAtUtc },
        occupiedUntilUtc: { gt: data.startsAtUtc },
      },
      select: { id: true },
    }),
  ]);

  if (blockConflict) {
    throw new AvailabilityBlockConflictError(
      "An active availability block already overlaps this range."
    );
  }
  if (bookingConflict) {
    throw new AvailabilityBlockConflictError(
      "A confirmed booking already overlaps this range."
    );
  }
  if (lockConflict) {
    throw new AvailabilityBlockConflictError(
      "An active customer booking lock overlaps this range."
    );
  }
}

function requireTransactionalClient(db: DbClient) {
  const transaction = (db as typeof prisma).$transaction;
  if (typeof transaction !== "function") {
    throw new Error("AvailabilityBlock writes require a transaction-capable client.");
  }
  return transaction.bind(db);
}

async function withAvailabilityBlockTransaction<T>(
  db: DbClient,
  callback: (tx: Prisma.TransactionClient) => Promise<T>
) {
  const transaction = requireTransactionalClient(db);
  return transaction(callback);
}

async function lockAndValidateBlockRange(
  tx: Prisma.TransactionClient,
  input: AvailabilityBlockInput,
  excludeId?: string
) {
  const data = await normalizeBlockInput(input, tx);
  await acquireTheatreDateLock(tx, data.theatreId, data.eventDate);
  await assertRangeAvailableForBlock(data, tx, excludeId);
  return data;
}

export async function listAvailabilityBlocks(input: {
  theatreId: string;
  from?: string | null;
  to?: string | null;
  includeInactive?: boolean;
}, db: DbClient = prisma) {
  if (!input.theatreId) {
    throw new AvailabilityBlockValidationError("theatreId is required.");
  }
  if (input.from && !isDateKey(input.from)) {
    throw new AvailabilityBlockValidationError("Invalid from date.");
  }
  if (input.to && !isDateKey(input.to)) {
    throw new AvailabilityBlockValidationError("Invalid to date.");
  }

  return db.availabilityBlock.findMany({
    where: {
      theatreId: input.theatreId,
      ...(input.includeInactive ? {} : { isActive: true }),
      ...(input.from || input.to
        ? {
            eventDate: {
              ...(input.from ? { gte: toBookingDate(input.from) } : {}),
              ...(input.to ? { lte: toBookingDate(input.to) } : {}),
            },
          }
        : {}),
    },
    orderBy: [{ eventDate: "asc" }, { startsAtUtc: "asc" }],
  });
}

export async function createAvailabilityBlock(
  input: AvailabilityBlockInput,
  adminId: string,
  db: DbClient = prisma
) {
  return withAvailabilityBlockTransaction(db, async (tx) => {
    const data = await lockAndValidateBlockRange(tx, input);
    return tx.availabilityBlock.create({
      data: {
        ...data,
        createdByAdminId: adminId,
      },
    });
  });
}

export async function updateAvailabilityBlock(
  id: string,
  input: AvailabilityBlockInput,
  db: DbClient = prisma
) {
  return withAvailabilityBlockTransaction(db, async (tx) => {
    const existing = await tx.availabilityBlock.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) throw new AvailabilityBlockNotFoundError("Block not found.");

    const data = await lockAndValidateBlockRange(tx, input, id);
    return tx.availabilityBlock.update({
      where: { id },
      data: {
        ...data,
        isActive: true,
      },
    });
  });
}

export async function deactivateAvailabilityBlock(
  id: string,
  db: DbClient = prisma
) {
  const result = await db.availabilityBlock.updateMany({
    where: { id, isActive: true },
    data: { isActive: false },
  });
  if (result.count === 0) {
    throw new AvailabilityBlockNotFoundError("Active block not found.");
  }
}
