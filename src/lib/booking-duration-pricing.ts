import type { Prisma } from "@prisma/client";
import {
  DEFAULT_EXTRA_HOURLY_RATE,
  DEFAULT_MINIMUM_BOOKING_DURATION_HOURS,
  EXTRA_HOURLY_RATE_KEY,
  MINIMUM_BOOKING_DURATION_HOURS_KEY,
  parseExtraHourlyRate,
  parseMinimumBookingDurationHours,
} from "@/lib/app-settings";
import { calculateDurationHours } from "@/lib/booking-time-range";

type SettingsReader = {
  appSetting: {
    findMany: (args: {
      where: { key: { in: string[] } };
      select: { key: true; value: true };
    }) => Promise<Array<{ key: string; value: string }>>;
  };
};

export async function resolveBookingDurationPricingConfig(
  reader: SettingsReader | Prisma.TransactionClient
) {
  const rows = await reader.appSetting.findMany({
    where: {
      key: {
        in: [MINIMUM_BOOKING_DURATION_HOURS_KEY, EXTRA_HOURLY_RATE_KEY],
      },
    },
    select: { key: true, value: true },
  });
  const map = new Map(rows.map((row) => [row.key, row.value]));

  return {
    includedDurationHours:
      parseMinimumBookingDurationHours(
        map.get(MINIMUM_BOOKING_DURATION_HOURS_KEY)
      ) ?? DEFAULT_MINIMUM_BOOKING_DURATION_HOURS,
    extraHourlyRate:
      parseExtraHourlyRate(map.get(EXTRA_HOURLY_RATE_KEY)) ??
      DEFAULT_EXTRA_HOURLY_RATE,
  };
}

export function resolveSlotDurationHours(input: {
  startTime?: string | null;
  endTime?: string | null;
  durationMin?: number | null;
}) {
  return (
    calculateDurationHours(input.startTime, input.endTime) ??
    (typeof input.durationMin === "number" && Number.isFinite(input.durationMin)
      ? Math.max(input.durationMin, 0) / 60
      : null)
  );
}
