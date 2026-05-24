"use client";

import { useEffect, useMemo, useState } from "react";
import {
  buildTimeValues,
  calculateDurationHours,
  DEFAULT_TIME_RANGE_INCREMENT_MINUTES,
  parseTimeValue,
} from "@/lib/booking-time-range";
import { formatISTTime } from "@/lib/formatters";

const IST_TIMEZONE = "Asia/Kolkata";

type TimeRangePickerProps = {
  startTime: string | null;
  endTime: string | null;
  minDurationHours: number;
  onChange: (startTime: string | null, endTime: string | null) => void;
  incrementMinutes?: number;
  disabled?: boolean;
  selectedDate?: Date | null;
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

export default function TimeRangePicker({
  startTime,
  endTime,
  minDurationHours,
  onChange,
  incrementMinutes = DEFAULT_TIME_RANGE_INCREMENT_MINUTES,
  disabled = false,
  selectedDate = null,
}: TimeRangePickerProps) {
  const times = useMemo(() => buildTimeValues(incrementMinutes), [incrementMinutes]);
  const [nowISTMinutes, setNowISTMinutes] = useState(() => getNowISTMinutes());
  const minDurationMinutes = Math.round(minDurationHours * 60);
  const startMinutes = parseTimeValue(startTime);
  const durationHours = calculateDurationHours(startTime, endTime);
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

  const canUseEndTime = (candidate: string) => {
    const candidateMinutes = parseTimeValue(candidate);
    return (
      startMinutes !== null &&
      candidateMinutes !== null &&
      candidateMinutes - startMinutes >= minDurationMinutes
    );
  };

  const canUseStartTime = (candidate: string) => {
    const candidateMinutes = parseTimeValue(candidate);
    const hasSameDayEnd =
      candidateMinutes !== null &&
      candidateMinutes + minDurationMinutes <= 23 * 60 + 30;
    const hasNotExpired =
      !isSelectedDateToday ||
      (candidateMinutes !== null && candidateMinutes > nowISTMinutes);

    return hasSameDayEnd && hasNotExpired;
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
              return (
                <option key={time} value={time} disabled={!canUseStartTime(time)}>
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
        ) : isSelectedDateToday ? (
          "Past start times for today are disabled."
        ) : (
          "Time options are shown in 30-minute increments."
        )}
      </div>
    </section>
  );
}
