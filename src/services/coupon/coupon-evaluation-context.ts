import { differenceInMinutes } from "date-fns";

import type { CouponScheduleContext } from "@/services/coupon/coupon.types";
import type { CouponEvaluationContext } from "@/services/coupon/coupon.types";

type LegacySlotScheduleInput = {
  id: string;
  date: Date;
  startTime: string;
  endTime: string;
  durationMin: number;
};

type BookingOwnedScheduleInput = {
  eventDate?: Date | null;
  eventStartTime?: string | null;
  eventEndTime?: string | null;
  startsAtUtc?: Date | null;
  endsAtUtc?: Date | null;
};

export function buildCouponScheduleContext(input: {
  bookingSchedule?: BookingOwnedScheduleInput | null;
  slot?: LegacySlotScheduleInput | null;
}): CouponScheduleContext {
  const bookingSchedule = input.bookingSchedule;
  if (
    bookingSchedule?.eventDate &&
    bookingSchedule.eventStartTime &&
    bookingSchedule.eventEndTime
  ) {
    return {
      date: bookingSchedule.eventDate,
      startTime: bookingSchedule.eventStartTime,
      endTime: bookingSchedule.eventEndTime,
      durationMin: resolveDurationMinutes({
        startsAtUtc: bookingSchedule.startsAtUtc,
        endsAtUtc: bookingSchedule.endsAtUtc,
        startTime: bookingSchedule.eventStartTime,
        endTime: bookingSchedule.eventEndTime,
      }),
      startsAtUtc: bookingSchedule.startsAtUtc ?? null,
      endsAtUtc: bookingSchedule.endsAtUtc ?? null,
      source: "BOOKING",
    };
  }

  if (input.slot) {
    return {
      date: input.slot.date,
      startTime: input.slot.startTime,
      endTime: input.slot.endTime,
      durationMin: input.slot.durationMin,
      startsAtUtc: null,
      endsAtUtc: null,
      source: "SLOT",
    };
  }

  throw new Error("COUPON_SCHEDULE_REQUIRED");
}

export function resolveCouponScheduleContext(
  context: CouponEvaluationContext
): CouponScheduleContext {
  if (context.schedule) return context.schedule;

  return buildCouponScheduleContext({
    slot: context.slot ?? null,
  });
}

function resolveDurationMinutes(input: {
  startsAtUtc?: Date | null;
  endsAtUtc?: Date | null;
  startTime: string;
  endTime: string;
}) {
  if (input.startsAtUtc && input.endsAtUtc) {
    const diff = differenceInMinutes(input.endsAtUtc, input.startsAtUtc);
    if (Number.isFinite(diff) && diff > 0) return diff;
  }

  const start = parseTimeMinutes(input.startTime);
  const end = parseTimeMinutes(input.endTime);
  if (start === null || end === null) return 0;
  return end >= start ? end - start : end + 24 * 60 - start;
}

function parseTimeMinutes(value: string) {
  const [hoursRaw, minutesRaw] = value.split(":");
  const hours = Number(hoursRaw);
  const minutes = Number(minutesRaw);
  if (
    !Number.isInteger(hours) ||
    !Number.isInteger(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return null;
  }
  return hours * 60 + minutes;
}
