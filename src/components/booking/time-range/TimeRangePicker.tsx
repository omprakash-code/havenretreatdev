"use client";

import { useEffect, useMemo, useState } from "react";
import { Clock, Edit, X } from "@/components/icons";
import {
  buildTimeValues,
  calculateDurationHours,
  DEFAULT_TIME_RANGE_INCREMENT_MINUTES,
  parseTimeValue,
} from "@/lib/booking-time-range";
import { formatISTTime } from "@/lib/formatters";

const IST_TIMEZONE = "Asia/Kolkata";
const BUSINESS_OPEN_MINUTES = 9 * 60;
const BUSINESS_CLOSE_MINUTES = 23 * 60;

type TimeRangePickerProps = {
  startTime: string | null;
  endTime: string | null;
  minDurationHours: number;
  onChange: (startTime: string | null, endTime: string | null) => void;
  incrementMinutes?: number;
  disabled?: boolean;
  selectedDate?: Date | null;
  variant?: "event-card" | "admin-field";
  unavailableRanges?: UnavailableTimeRange[];
};

export type UnavailableTimeRange = {
  startTime: string;
  endTime: string;
  reason: "BOOKED" | "BLOCKED" | "LOCKED";
};

function getISTDateKey(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: IST_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function getNowISTMinutes() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: IST_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? 0);
  return hour * 60 + minute;
}

function formatDurationHint(minutes: number) {
  const hours = minutes / 60;
  return Number.isInteger(hours) ? `${hours}h` : `${hours.toFixed(1)}h`;
}

function formatMinutesAsTime(minutes: number) {
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function reasonLabel(reason: UnavailableTimeRange["reason"]) {
  if (reason === "BLOCKED") return "blocked";
  if (reason === "LOCKED") return "temporarily reserved";
  return "booked";
}

export default function TimeRangePicker({
  startTime,
  endTime,
  minDurationHours,
  onChange,
  incrementMinutes = DEFAULT_TIME_RANGE_INCREMENT_MINUTES,
  disabled = false,
  selectedDate = null,
  variant = "event-card",
  unavailableRanges = [],
}: TimeRangePickerProps) {
  const times = useMemo(() => buildTimeValues(incrementMinutes), [incrementMinutes]);
  const [nowISTMinutes, setNowISTMinutes] = useState(() => getNowISTMinutes());
  const [open, setOpen] = useState(false);
  const [draftStartTime, setDraftStartTime] = useState<string | null>(startTime);
  const [draftEndTime, setDraftEndTime] = useState<string | null>(endTime);
  const minDurationMinutes = Math.round(minDurationHours * 60);
  const startMinutes = parseTimeValue(startTime);
  const draftStartMinutes = parseTimeValue(draftStartTime);
  const durationHours = calculateDurationHours(startTime, endTime);
  const draftDurationHours = calculateDurationHours(draftStartTime, draftEndTime);
  const isSelectingEndTime = Boolean(draftStartTime && !draftEndTime);
  const isSelectedDateToday =
    selectedDate !== null && getISTDateKey(selectedDate) === getISTDateKey(new Date());

  useEffect(() => {
    const interval = window.setInterval(() => {
      setNowISTMinutes(getNowISTMinutes());
    }, 60_000);

    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!isSelectedDateToday || startMinutes === null) return;
    if (startMinutes <= nowISTMinutes) {
      onChange(null, null);
    }
  }, [isSelectedDateToday, nowISTMinutes, onChange, startMinutes]);

  const canUseStartTime = (candidate: string) => {
    const candidateMinutes = parseTimeValue(candidate);
    const isWithinBusinessHours =
      candidateMinutes !== null &&
      candidateMinutes >= BUSINESS_OPEN_MINUTES &&
      candidateMinutes <= BUSINESS_CLOSE_MINUTES;
    const hasSameDayEnd =
      candidateMinutes !== null &&
      candidateMinutes + minDurationMinutes <= BUSINESS_CLOSE_MINUTES;
    const hasNotExpired =
      !isSelectedDateToday ||
      (candidateMinutes !== null && candidateMinutes > nowISTMinutes);

    const minEndTime =
      candidateMinutes !== null
        ? formatMinutesAsTime(candidateMinutes + minDurationMinutes)
        : null;

    return (
      isWithinBusinessHours &&
      hasSameDayEnd &&
      hasNotExpired &&
      minEndTime !== null &&
      !rangeOverlapsUnavailable(candidate, minEndTime)
    );
  };

  const canUseDraftEndTime = (candidate: string) => {
    const candidateMinutes = parseTimeValue(candidate);
    return (
      draftStartMinutes !== null &&
      candidateMinutes !== null &&
      candidateMinutes <= BUSINESS_CLOSE_MINUTES &&
      candidateMinutes - draftStartMinutes >= minDurationMinutes &&
      !rangeOverlapsUnavailable(draftStartTime!, candidate)
    );
  };

  const rangeOverlapsUnavailable = (start: string, end: string) => {
    const startMinutes = parseTimeValue(start);
    const endMinutes = parseTimeValue(end);
    if (startMinutes === null || endMinutes === null || endMinutes <= startMinutes) {
      return false;
    }

    return unavailableRanges.some((range) => {
      const rangeStart = parseTimeValue(range.startTime);
      const rangeEnd = parseTimeValue(range.endTime);
      if (rangeStart === null || rangeEnd === null) return false;
      return rangeStart < endMinutes && rangeEnd > startMinutes;
    });
  };

  const findUnavailableRangeForTime = (time: string) => {
    const minutes = parseTimeValue(time);
    if (minutes === null) return null;

    return (
      unavailableRanges.find((range) => {
        const rangeStart = parseTimeValue(range.startTime);
        const rangeEnd = parseTimeValue(range.endTime);
        if (rangeStart === null || rangeEnd === null) return false;
        return minutes >= rangeStart && minutes < rangeEnd;
      }) ?? null
    );
  };

  const handleDraftStartSelect = (nextStart: string) => {
    if (!nextStart) {
      setDraftStartTime(null);
      setDraftEndTime(null);
      return;
    }

    const nextStartMinutes = parseTimeValue(nextStart);
    const currentEndMinutes = parseTimeValue(draftEndTime);
    const keepsEnd =
      nextStartMinutes !== null &&
      currentEndMinutes !== null &&
      currentEndMinutes - nextStartMinutes >= minDurationMinutes;

    setDraftStartTime(nextStart);
    setDraftEndTime(keepsEnd ? draftEndTime : null);
  };

  const openPicker = () => {
    if (disabled) return;
    setDraftStartTime(startTime);
    setDraftEndTime(endTime);
    setOpen(true);
  };

  const clearDraft = () => {
    setDraftStartTime(null);
    setDraftEndTime(null);
  };

  const saveDraft = () => {
    onChange(draftStartTime, draftEndTime);
    setOpen(false);
  };

  const handleTimeSelect = (time: string) => {
    if (!draftStartTime || draftEndTime) {
      handleDraftStartSelect(time);
      return;
    }

    if (canUseDraftEndTime(time)) {
      setDraftEndTime(time);
    }
  };

  const getChipMessage = ({
    time,
    selected,
    isRangeInterior,
    isEndSelection,
  }: {
    time: string;
    selected: boolean;
    isRangeInterior: boolean;
    isEndSelection: boolean;
  }) => {
    const label = formatISTTime(time);
    const candidateMinutes = parseTimeValue(time);

    if (selected) return `${label} selected`;
    if (isRangeInterior) return `${label} is included in your selected range`;

    const unavailableRange = findUnavailableRangeForTime(time);
    if (unavailableRange) {
      return `${label} is ${reasonLabel(unavailableRange.reason)}.`;
    }

    if (isEndSelection) {
      if (!draftStartTime) return "Choose a start time first";
      if (candidateMinutes !== null && candidateMinutes > BUSINESS_CLOSE_MINUTES) {
        return `${label} is outside business hours`;
      }
      if (!canUseDraftEndTime(time)) {
        if (draftStartTime && rangeOverlapsUnavailable(draftStartTime, time)) {
          return `${label} conflicts with an existing booked or blocked range`;
        }
        return `${label} is unavailable because it is below the ${minDurationHours} ${
          minDurationHours === 1 ? "hour" : "hours"
        } minimum`;
      }

      return `${label} is available as an end time`;
    }

    if (isSelectedDateToday && candidateMinutes !== null && candidateMinutes <= nowISTMinutes) {
      return `${label} is unavailable because it has already passed`;
    }

    if (
      candidateMinutes !== null &&
      candidateMinutes + minDurationMinutes > BUSINESS_CLOSE_MINUTES
    ) {
      return `${label} is unavailable because it cannot meet the minimum duration today`;
    }

    if (
      candidateMinutes !== null &&
      rangeOverlapsUnavailable(
        time,
        formatMinutesAsTime(candidateMinutes + minDurationMinutes)
      )
    ) {
      return `${label} cannot start because the minimum booking range overlaps a booked or blocked time`;
    }

    return `${label} is available as a start time`;
  };
  const visibleTimes = times.filter((time) => {
    const candidateMinutes = parseTimeValue(time);
    const isInBusinessWindow =
      candidateMinutes !== null &&
      candidateMinutes >= BUSINESS_OPEN_MINUTES &&
      candidateMinutes <= BUSINESS_CLOSE_MINUTES;

    if (isSelectingEndTime) {
      return (
        draftStartMinutes !== null &&
        candidateMinutes !== null &&
        candidateMinutes >= draftStartMinutes &&
        candidateMinutes <= BUSINESS_CLOSE_MINUTES
      );
    }

    return isInBusinessWindow;
  });

  return (
    <section
      aria-label="Choose booking time range"
      className={
        variant === "admin-field"
          ? "text-slate-900"
          : "border border-[#c6ddcf] bg-white p-4 text-[#0d3b24] transition duration-300 ease-out hover:border-[#9fbfba] sm:p-5"
      }
    >
      <div>
        {variant === "event-card" && (
          <p className="text-[0.68rem] font-bold uppercase tracking-[0.18em] text-[#101828]">
            Event Duration
          </p>
        )}
        <button
          type="button"
          disabled={disabled}
          onClick={openPicker}
          className={
            variant === "admin-field"
              ? "group flex h-11 w-full cursor-pointer items-center justify-between gap-3 rounded-lg border border-slate-300 bg-white px-3.5 text-left text-base text-slate-900 transition-all hover:border-slate-400 focus:border-black focus:outline-none focus:ring-1 focus:ring-black/5 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400 sm:h-10 sm:rounded-md sm:px-3 sm:text-sm"
              : "group mt-4 flex min-h-[52px] w-full cursor-pointer items-center justify-between gap-4 bg-[#f2f3f3] px-4 py-3 text-left transition duration-300 ease-out hover:bg-[#ecefef] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#347f7c] active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-[#f6f7f8] disabled:text-[#98a2b3]"
          }
        >
          <span className="flex min-w-0 items-center gap-3">
            <span className="flex shrink-0 items-center justify-center text-[#344054] transition duration-300 group-hover:text-[#245e5b]">
              <Clock size={variant === "admin-field" ? 16 : 22} />
            </span>
            <span
              className={
                variant === "admin-field"
                  ? "block min-w-0 truncate text-sm font-medium text-slate-900"
                  : "block min-w-0 truncate text-base font-semibold text-[#101828] sm:text-lg"
              }
            >
              {durationHours
                ? `${formatISTTime(startTime!)} - ${formatISTTime(endTime!)}`
                : startTime
                  ? `${formatISTTime(startTime)} - Add end time`
                  : "Add time range"}
            </span>
          </span>
          <span className="flex shrink-0 items-center justify-center text-[#344054] transition duration-300 group-hover:text-[#245e5b]">
            <Edit size={variant === "admin-field" ? 15 : 18} />
          </span>
        </button>
        <p
          className={
            variant === "admin-field"
              ? "mt-1 text-xs text-slate-500"
              : "mt-3 pl-4 text-sm italic text-[#245e5b]"
          }
        >
          {disabled
            ? "Choose package and date first."
            : `${minDurationHours} ${
                minDurationHours === 1 ? "hour" : "hours"
              } minimum`}
        </p>
      </div>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-stretch justify-center bg-[#101828]/60 p-0 sm:items-center backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Select booking time"
        >
          <div className="relative max-h-[100dvh] w-full overflow-y-auto bg-white px-5 pb-5 pt-12 shadow-[0_28px_80px_rgba(16,24,40,0.28)] sm:max-h-[calc(100vh-2rem)] sm:px-8 sm:pb-6 sm:pt-12">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="absolute right-4 top-4 flex size-8 items-center justify-center bg-[#edf3f1] text-[#245e5b] transition hover:bg-[#dcebe8] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#347f7c]"
              aria-label="Close time picker"
            >
              <X size={14} />
            </button>

            <div className="mb-4 grid gap-5 xl:grid-cols-[minmax(150px,1fr)_minmax(420px,auto)] xl:items-start">
              <div className="min-w-0 lg:pt-1">
                <h2 className="text-lg font-semibold tracking-[-0.02em] text-[#101828]">
                  {draftDurationHours
                    ? `${draftDurationHours} ${draftDurationHours === 1 ? "hour" : "hours"}`
                    : isSelectingEndTime
                      ? "Select end time"
                      : "Select start time"}
                </h2>
                <p className="mt-1 text-sm text-[#667085]">
                  {draftStartTime && draftEndTime
                    ? `${formatISTTime(draftStartTime)} - ${formatISTTime(draftEndTime)}`
                    : `${minDurationHours} ${minDurationHours === 1 ? "hour" : "hours"} booking minimum`}
                </p>
              </div>

              <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:w-[350px]">
                <div
                  className={`min-h-[58px] border bg-white px-5 py-3 text-left ${
                    !draftStartTime || draftEndTime
                      ? "border-[#347f7c] shadow-[inset_0_0_0_1px_#347f7c]"
                      : "border-[#d0d5dd]"
                  }`}
                >
                  <span className="block whitespace-nowrap text-xs font-semibold uppercase tracking-[0.12em] text-[#475467]">
                    Start Time
                  </span>
                  <span className="mt-1.5 block text-sm font-medium text-[#101828]">
                    {draftStartTime ? formatISTTime(draftStartTime) : "Add time"}
                  </span>
                </div>

                <div
                  className={`min-h-[58px] border bg-white px-5 py-3 text-left ${
                    isSelectingEndTime
                      ? "border-[#347f7c] shadow-[inset_0_0_0_1px_#347f7c]"
                      : "border-[#d0d5dd]"
                  }`}
                >
                  <span className="block whitespace-nowrap text-xs font-semibold uppercase tracking-[0.12em] text-[#475467]">
                    End Time
                  </span>
                  <span className="mt-1.5 block text-sm font-medium text-[#101828]">
                    {draftEndTime ? formatISTTime(draftEndTime) : "Add time"}
                  </span>
                </div>
              </div>
            </div>

            <div className="grid max-h-[42vh] grid-cols-3 gap-3 overflow-y-auto overflow-x-visible pr-1 sm:grid-cols-4 md:grid-cols-5 lg:max-h-[48vh] lg:grid-cols-7 lg:gap-2 lg:pr-0">
              {visibleTimes.map((time) => {
                const selected =
                  draftStartTime === time || draftEndTime === time;
                const endMinutes = parseTimeValue(draftEndTime);
                const timeMinutes = parseTimeValue(time);
                const isShortEndOption =
                  isSelectingEndTime &&
                  draftStartMinutes !== null &&
                  timeMinutes !== null &&
                  timeMinutes > draftStartMinutes &&
                  timeMinutes - draftStartMinutes < minDurationMinutes;
                const durationHint =
                  isSelectingEndTime &&
                  draftStartMinutes !== null &&
                  timeMinutes !== null &&
                  timeMinutes > draftStartMinutes
                    ? formatDurationHint(timeMinutes - draftStartMinutes)
                    : null;
                const isRangeInterior =
                  draftStartMinutes !== null &&
                  endMinutes !== null &&
                  timeMinutes !== null &&
                  timeMinutes > draftStartMinutes &&
                  timeMinutes < endMinutes;
                const unavailable = selected
                  ? false
                  : isSelectingEndTime
                    ? !canUseDraftEndTime(time)
                    : !canUseStartTime(time);
                const unavailableRange = findUnavailableRangeForTime(time);
                const chipMessage = getChipMessage({
                  time,
                  selected,
                  isRangeInterior,
                  isEndSelection: isSelectingEndTime,
                });

                return (
                  <button
                    key={time}
                    type="button"
                    aria-label={chipMessage}
                    aria-pressed={selected}
                    disabled={unavailable}
                    onClick={() => handleTimeSelect(time)}
                    className={`group relative min-h-[50px] w-full border px-2 py-1 text-xs font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#347f7c] ${
                      selected
                        ? "border-[#347f7c] bg-[#347f7c] text-white shadow-[0_14px_28px_rgba(52,127,124,0.24)]"
                      : isRangeInterior
                          ? "border-[#e4eeeb] bg-[#edf3f1] text-[#245e5b]"
                        : unavailableRange
                          ? "cursor-not-allowed border-[#ead7d7] bg-[#fff5f5] text-[#b42318] line-through"
                        : isShortEndOption
                          ? "cursor-not-allowed border-transparent bg-transparent text-[#c0c6cf] line-through"
                        : unavailable
                          ? "cursor-not-allowed border-[#edf0f2] bg-[#f6f7f8] text-[#a8b0bb] line-through"
                          : "border-[#cfd6df] bg-white text-[#101828] hover:border-[#98a2b3] hover:shadow-[0_6px_16px_rgba(16,24,40,0.08)]"
                    }`}
                  >
                    <span className="block text-[13px] leading-none">
                      {formatISTTime(time).replace(" AM", "").replace(" PM", "")}
                    </span>
                    <span className="mt-1 block text-[10px] font-normal">
                      {formatISTTime(time).endsWith("AM") ? "AM" : "PM"}
                    </span>
                    {durationHint && !selected && !isShortEndOption && (
                      <span className="pointer-events-none absolute left-1/2 top-full z-10 mt-2 -translate-x-1/2 translate-y-1 whitespace-nowrap bg-[#102f2d] px-2.5 py-1.5 text-[11px] font-medium text-white opacity-0 shadow-[0_10px_24px_rgba(16,47,45,0.22)] transition duration-150 ease-out group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100">
                        {durationHint} duration
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="mt-3 flex items-center justify-between gap-4">
              <button
                type="button"
                onClick={clearDraft}
                className="text-sm font-medium text-[#101828] transition hover:text-[#347f7c]"
              >
                Clear times
              </button>

              <div className="flex items-center gap-3">
                {draftDurationHours && (
                  <span className="hidden text-sm font-medium text-[#245e5b] sm:inline">
                    {draftDurationHours} {draftDurationHours === 1 ? "hour" : "hours"}
                  </span>
                )}
                <button
                  type="button"
                  onClick={saveDraft}
                  disabled={!draftStartTime || !draftEndTime}
                  className="bg-[#347f7c] px-7 py-3 text-base font-medium text-white shadow-[0_12px_28px_rgba(52,127,124,0.25)] transition hover:-translate-y-0.5 hover:bg-[#245e5b] disabled:cursor-not-allowed disabled:bg-[#d0d5dd] disabled:shadow-none disabled:hover:translate-y-0"
                >
                  Save
                </button>
              </div>
            </div>

            <div className="mt-3 border-t border-[#eef2f1] pt-3">
              <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-[11px] font-medium text-[#667085]">
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-2.5 border border-[#cfd6df] bg-white" />
                  Available
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-2.5 border border-[#347f7c] bg-[#347f7c]" />
                  Selected
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-2.5 border border-[#e4eeeb] bg-[#edf3f1]" />
                  Selected range
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-2.5 border border-[#ead7d7] bg-[#fff5f5]" />
                  Booked
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-2.5 border border-transparent bg-[#f6f7f8]" />
                  Under minimum
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
