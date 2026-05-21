"use client";

import { useMemo } from "react";
import {
  buildTimeValues,
  calculateDurationHours,
  DEFAULT_TIME_RANGE_INCREMENT_MINUTES,
  parseTimeValue,
} from "@/lib/booking-time-range";
import { formatISTTime } from "@/lib/formatters";

type TimeRangePickerProps = {
  startTime: string | null;
  endTime: string | null;
  minDurationHours: number;
  onChange: (startTime: string | null, endTime: string | null) => void;
  incrementMinutes?: number;
  disabled?: boolean;
};

export default function TimeRangePicker({
  startTime,
  endTime,
  minDurationHours,
  onChange,
  incrementMinutes = DEFAULT_TIME_RANGE_INCREMENT_MINUTES,
  disabled = false,
}: TimeRangePickerProps) {
  const times = useMemo(() => buildTimeValues(incrementMinutes), [incrementMinutes]);
  const minDurationMinutes = Math.round(minDurationHours * 60);
  const startMinutes = parseTimeValue(startTime);
  const durationHours = calculateDurationHours(startTime, endTime);

  const canUseEndTime = (candidate: string) => {
    const candidateMinutes = parseTimeValue(candidate);
    return (
      startMinutes !== null &&
      candidateMinutes !== null &&
      candidateMinutes - startMinutes >= minDurationMinutes
    );
  };

  const handleStartChange = (nextStart: string) => {
    if (!nextStart) {
      onChange(null, null);
      return;
    }

    const nextStartMinutes = parseTimeValue(nextStart);
    const currentEndMinutes = parseTimeValue(endTime);
    const keepsEnd =
      nextStartMinutes !== null &&
      currentEndMinutes !== null &&
      currentEndMinutes - nextStartMinutes >= minDurationMinutes;

    onChange(nextStart, keepsEnd ? endTime : null);
  };

  return (
    <section
      aria-label="Choose booking time range"
      className="border border-[#d7e4e1] bg-[#f8fbfa] p-3 sm:p-4"
    >
      <div className="mb-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#347f7c]">
          Event Time
        </p>
        <p className="mt-1 text-sm text-[#475467]">
          Pick a start time first. Minimum booking duration is {minDurationHours}{" "}
          {minDurationHours === 1 ? "hour" : "hours"}.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[#475467]">
            Start Time
          </span>
          <select
            value={startTime ?? ""}
            disabled={disabled}
            onChange={(event) => handleStartChange(event.target.value)}
            className="mt-1 h-12 w-full border border-[#d0d5dd] bg-white px-3 text-sm font-medium text-[#101828] outline-none transition focus:border-[#347f7c] disabled:cursor-not-allowed disabled:bg-[#f2f4f7] disabled:text-[#98a2b3]"
          >
            <option value="">Select start time</option>
            {times.map((time) => {
              const timeMinutes = parseTimeValue(time);
              const hasSameDayEnd =
                timeMinutes !== null &&
                timeMinutes + minDurationMinutes <= 23 * 60 + 30;

              return (
                <option key={time} value={time} disabled={!hasSameDayEnd}>
                  {formatISTTime(time)}
                </option>
              );
            })}
          </select>
        </label>

        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[#475467]">
            End Time
          </span>
          <select
            value={endTime ?? ""}
            disabled={disabled || !startTime}
            onChange={(event) => onChange(startTime, event.target.value || null)}
            className="mt-1 h-12 w-full border border-[#d0d5dd] bg-white px-3 text-sm font-medium text-[#101828] outline-none transition focus:border-[#347f7c] disabled:cursor-not-allowed disabled:bg-[#f2f4f7] disabled:text-[#98a2b3]"
          >
            <option value="">
              {startTime ? "Select end time" : "Choose start time first"}
            </option>
            {times.map((time) => (
              <option key={time} value={time} disabled={!canUseEndTime(time)}>
                {formatISTTime(time)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div
        aria-live="polite"
        className="mt-3 flex min-h-9 items-center border border-[#e4eeeb] bg-white px-3 text-xs text-[#475467]"
      >
        {disabled ? (
          "Choose an available date to unlock time selection."
        ) : durationHours ? (
          <span className="font-semibold text-[#245e5b]">
            {formatISTTime(startTime!)} - {formatISTTime(endTime!)} ·{" "}
            {durationHours} {durationHours === 1 ? "hour" : "hours"}
          </span>
        ) : startTime ? (
          `End times before ${minDurationHours} ${
            minDurationHours === 1 ? "hour" : "hours"
          } are disabled.`
        ) : (
          "Time options are shown in 30-minute increments."
        )}
      </div>
    </section>
  );
}
