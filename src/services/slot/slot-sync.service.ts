import { addDays } from "date-fns";
import { formatInTimeZone, toDate } from "date-fns-tz";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";

const IST_TIMEZONE = "Asia/Kolkata";
const SLOT_SYNC_LOCK_KEY_1 = 712031;
const SLOT_SYNC_LOCK_KEY_2 = 890117;
const MAX_DAYS_AHEAD = 365;
const DEFAULT_DAYS_AHEAD = 90;
const THEATRE_SOFT_DELETE_PREFIX = "__DELETED__";
const SLOT_SYNC_CHUNK_SIZE = 500;

type SyncContext = {
  daysAhead: number;
  dryRun: boolean;
};

export type SlotSyncResult = {
  ok: true;
  lockAcquired: boolean;
  dryRun: boolean;
  daysAhead: number;
  windowStart: string;
  windowEndExclusive: string;
  templatesScanned: number;
  existingSlotsInWindow: number;
  skippedExistingCount: number;
  toCreateCount: number;
  createdCount: number;
  durationMs: number;
  reason?: string;
};

function normalizeDaysAhead(input?: number | null) {
  if (!Number.isFinite(input)) return DEFAULT_DAYS_AHEAD;
  return Math.min(Math.max(Math.trunc(input as number), 1), MAX_DAYS_AHEAD);
}

function getIstDateKey(date: Date) {
  return formatInTimeZone(date, IST_TIMEZONE, "yyyy-MM-dd");
}

function getIstMidnightFromDateKey(dateKey: string) {
  return toDate(`${dateKey}T00:00:00+05:30`, { timeZone: IST_TIMEZONE });
}

function buildSlotSyncData(template: {
  theatreId: string;
  id: string;
  startTime: string;
  endTime: string;
  durationMin: number;
  regularPrice: number;
  salePrice: number | null;
  decorationMandatory: boolean;
  theatre: {
    baseGuests: number;
  };
}, slotDate: Date): Prisma.SlotCreateManyInput {
  const finalPrice = template.salePrice ?? template.regularPrice;

  return {
    theatreId: template.theatreId,
    slotTemplateId: template.id,
    date: slotDate,
    startTime: template.startTime,
    endTime: template.endTime,
    durationMin: template.durationMin,
    basePrice: finalPrice,
    baseGuests: template.theatre.baseGuests,
    regularPrice: template.regularPrice,
    salePrice: template.salePrice,
    finalPrice,
    isSpecial: template.salePrice !== null,
    decorationMandatory: template.decorationMandatory,
    discountText: null,
    status: "AVAILABLE",
  };
}

async function tryAcquireSlotSyncLock() {
  const result = await prisma.$queryRaw<{ acquired: boolean }[]>`
    SELECT pg_try_advisory_lock(${SLOT_SYNC_LOCK_KEY_1}, ${SLOT_SYNC_LOCK_KEY_2}) AS acquired
  `;
  return Boolean(result[0]?.acquired);
}

async function releaseSlotSyncLock() {
  await prisma.$queryRaw`
    SELECT pg_advisory_unlock(${SLOT_SYNC_LOCK_KEY_1}, ${SLOT_SYNC_LOCK_KEY_2})
  `;
}

function buildSyncWindow(daysAhead: number) {
  const todayDateKey = getIstDateKey(new Date());
  const windowStart = getIstMidnightFromDateKey(todayDateKey);
  const windowEndExclusive = addDays(windowStart, daysAhead);
  return { windowStart, windowEndExclusive };
}

async function runSlotSync(context: SyncContext): Promise<SlotSyncResult> {
  const startedAt = Date.now();
  const { windowStart, windowEndExclusive } = buildSyncWindow(context.daysAhead);

  const templates = await prisma.slotTemplate.findMany({
    where: {
      isActive: true,
      theatre: {
        isActive: true,
        name: {
          not: {
            startsWith: THEATRE_SOFT_DELETE_PREFIX,
          },
        },
      },
    },
    select: {
      id: true,
      theatreId: true,
      startTime: true,
      endTime: true,
      durationMin: true,
      regularPrice: true,
      salePrice: true,
      decorationMandatory: true,
      theatre: {
        select: {
          baseGuests: true,
        },
      },
    },
    orderBy: [{ theatreId: "asc" }, { startTime: "asc" }],
  });

  if (templates.length === 0) {
    return {
      ok: true,
      lockAcquired: true,
      dryRun: context.dryRun,
      daysAhead: context.daysAhead,
      windowStart: getIstDateKey(windowStart),
      windowEndExclusive: getIstDateKey(windowEndExclusive),
      templatesScanned: 0,
      existingSlotsInWindow: 0,
      skippedExistingCount: 0,
      toCreateCount: 0,
      createdCount: 0,
      durationMs: Date.now() - startedAt,
      reason: "no_active_templates",
    };
  }

  const templateIds = templates.map((template) => template.id);
  const existingSlots = await prisma.slot.findMany({
    where: {
      slotTemplateId: { in: templateIds },
      date: {
        gte: windowStart,
        lt: windowEndExclusive,
      },
    },
    select: {
      slotTemplateId: true,
      date: true,
    },
  });

  const existingKeys = new Set(
    existingSlots.map((slot) => `${slot.slotTemplateId}|${getIstDateKey(slot.date)}`)
  );

  let skippedExistingCount = 0;
  const createPayload: Prisma.SlotCreateManyInput[] = [];

  for (const template of templates) {
    for (let dayOffset = 0; dayOffset < context.daysAhead; dayOffset += 1) {
      const slotDate = addDays(windowStart, dayOffset);
      const slotDateKey = getIstDateKey(slotDate);
      const slotKey = `${template.id}|${slotDateKey}`;

      if (existingKeys.has(slotKey)) {
        skippedExistingCount += 1;
        continue;
      }

      createPayload.push(
        buildSlotSyncData(template, getIstMidnightFromDateKey(slotDateKey))
      );
      existingKeys.add(slotKey);
    }
  }

  let createdCount = 0;
  if (!context.dryRun && createPayload.length > 0) {
    for (let index = 0; index < createPayload.length; index += SLOT_SYNC_CHUNK_SIZE) {
      const batch = createPayload.slice(index, index + SLOT_SYNC_CHUNK_SIZE);
      const createResult = await prisma.slot.createMany({
        data: batch,
      });
      createdCount += createResult.count;
    }
  }

  return {
    ok: true,
    lockAcquired: true,
    dryRun: context.dryRun,
    daysAhead: context.daysAhead,
    windowStart: getIstDateKey(windowStart),
    windowEndExclusive: getIstDateKey(windowEndExclusive),
    templatesScanned: templates.length,
    existingSlotsInWindow: existingSlots.length,
    skippedExistingCount,
    toCreateCount: createPayload.length,
    createdCount,
    durationMs: Date.now() - startedAt,
  };
}

export async function syncFutureSlots(input?: {
  daysAhead?: number | null;
  dryRun?: boolean;
}): Promise<SlotSyncResult> {
  const daysAhead = normalizeDaysAhead(input?.daysAhead);
  const dryRun = Boolean(input?.dryRun);
  const startedAt = Date.now();

  const lockAcquired = await tryAcquireSlotSyncLock();
  if (!lockAcquired) {
    const { windowStart, windowEndExclusive } = buildSyncWindow(daysAhead);
    return {
      ok: true,
      lockAcquired: false,
      dryRun,
      daysAhead,
      windowStart: getIstDateKey(windowStart),
      windowEndExclusive: getIstDateKey(windowEndExclusive),
      templatesScanned: 0,
      existingSlotsInWindow: 0,
      skippedExistingCount: 0,
      toCreateCount: 0,
      createdCount: 0,
      durationMs: Date.now() - startedAt,
      reason: "lock_not_acquired",
    };
  }

  try {
    return await runSlotSync({ daysAhead, dryRun });
  } finally {
    await releaseSlotSyncLock();
  }
}

