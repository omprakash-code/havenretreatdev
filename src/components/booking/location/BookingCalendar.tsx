"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "@/components/icons";
import { dateFromDateKey, getDateKeyInTimeZone, toDateKey } from "@/lib/date";

type BookingCalendarProps = {
  onSelect: (date: Date) => void;
  onClose: () => void;
  availableDates: string[]; // ["2025-01-03", "2025-01-04"]
  variant?: "modal" | "inline";
  selectedDate?: Date | null;
  timezone?: string;
};

export default function BookingCalendar({
  onSelect,
  onClose,
  availableDates,
  variant = "modal",
  selectedDate,
  timezone = "America/New_York",
}: BookingCalendarProps) {
  const venueToday = useMemo(
    () => dateFromDateKey(getDateKeyInTimeZone(new Date(), timezone)),
    [timezone]
  );
  const normalizedSelectedDate = useMemo(() => {
    if (!selectedDate) return null;
    const d = new Date(selectedDate);
    if (Number.isNaN(d.getTime())) return null;
    d.setHours(0, 0, 0, 0);
    return d;
  }, [selectedDate]);

  const [currentMonth, setCurrentMonth] = useState(() => {
    if (normalizedSelectedDate) {
      return new Date(
        normalizedSelectedDate.getFullYear(),
        normalizedSelectedDate.getMonth(),
        1
      );
    }
    return new Date(venueToday.getFullYear(), venueToday.getMonth(), 1);
  });
  const isInline = variant === "inline";

  const availableDateSet = useMemo(
    () => new Set(availableDates.map((d) => toDateKey(d))),
    [availableDates]
  );
  const selectedDateKey = normalizedSelectedDate
    ? toDateKey(normalizedSelectedDate)
    : null;

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const monthName = currentMonth.toLocaleString("en-IN", { month: "long" });
  const canGoPreviousMonth =
    year > venueToday.getFullYear() ||
    (year === venueToday.getFullYear() && month > venueToday.getMonth());

  const startOfMonth = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startDay = startOfMonth.getDay();

  const todayKey = toDateKey(venueToday);

  // Build fixed 6-row calendar grid
  const prevMonthDays = new Date(year, month, 0).getDate();
  const cells: Array<{ day: number; monthOffset: -1 | 0 | 1 }> = [];

  for (let i = startDay; i > 0; i--) {
    cells.push({
      day: prevMonthDays - i + 1,
      monthOffset: -1,
    });
  }
  for (let i = 1; i <= daysInMonth; i++) {
    cells.push({ day: i, monthOffset: 0 });
  }
  while (cells.length < 42) {
    cells.push({
      day: cells.length - (startDay + daysInMonth) + 1,
      monthOffset: 1,
    });
  }

  function handleDateClick(day: number, monthOffset: -1 | 0 | 1) {
    if (monthOffset !== 0) return;

    const selectedDate = new Date(year, month + monthOffset, day);
    selectedDate.setHours(0, 0, 0, 0);

    const key = toDateKey(selectedDate);

    if (key < todayKey) return;
    if (!availableDateSet.has(key)) return;


    onSelect(selectedDate);
  }

  const calendarCard = (
    <div
      className={`relative overflow-hidden border border-[#2f7e7a]/25 bg-white ${
        isInline
          ? "w-[min(92vw,310px)] p-3.5"
          : "w-[min(92vw,380px)] px-4 pt-4 pb-3 sm:px-5 sm:pt-5 sm:pb-3"
      }`}
    >
      {/* Header */}
      <div className="relative mb-3 grid grid-cols-[36px_1fr_36px] items-center gap-1.5 pt-5">
        <button
          type="button"
          onClick={() => setCurrentMonth(new Date(year, month - 1))}
          disabled={!canGoPreviousMonth}
          className="grid h-9 w-9 place-items-center border border-transparent bg-transparent text-gray-700 transition-colors hover:border-[#d7e4e1] hover:bg-[#f8fbfa] hover:text-[#245e5b] active:bg-[#edf3f1] disabled:cursor-not-allowed disabled:text-gray-300 disabled:hover:border-transparent disabled:hover:bg-transparent"
        >
          <ChevronLeft size={15} />
        </button>

        <div className="text-center">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-500">
            Choose Date
          </p>
          <h3 className="text-lg font-semibold text-[#1f2937]">
            {monthName} {year}
          </h3>
        </div>

        <button
          type="button"
          onClick={() => setCurrentMonth(new Date(year, month + 1))}
          className="grid h-9 w-9 place-items-center border border-transparent bg-transparent text-gray-700 transition-colors hover:border-[#d7e4e1] hover:bg-[#f8fbfa] hover:text-[#245e5b] active:bg-[#edf3f1]"
        >
          <ChevronRight size={15} />
        </button>
      </div>

      {/* Close */}
      <button
        type="button"
        onClick={onClose}
        className="absolute right-2 top-2 z-20 grid h-8 w-8 place-items-center border border-[#d7e4e1] bg-white text-gray-700 shadow-sm transition-colors hover:bg-[#f8fbfa] hover:text-[#245e5b]"
      >
        <X size={13} />
      </button>

      {/* Weekdays */}
      <div className="mb-1.5 grid grid-cols-7 text-center text-[10px] font-semibold uppercase tracking-[0.18em] text-gray-400">
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
          <div key={`${d}-${i}`}>{d}</div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-1 text-center">
        {cells.map((cell, idx) => {
          const cellDate = new Date(
            year,
            month + cell.monthOffset,
            cell.day
          );
          cellDate.setHours(0, 0, 0, 0);

          const key = toDateKey(cellDate);
          const isOutsideMonth = cell.monthOffset !== 0;
          const isPast = key < todayKey;
          const isUnavailable = !availableDateSet.has(key);

          const isDisabled =
            isOutsideMonth || isPast || isUnavailable;
          const isSelected =
            selectedDateKey != null &&
            key === selectedDateKey;
          const isToday = key === todayKey;

          return (
            <button
              key={idx}
              onClick={() =>
                handleDateClick(cell.day, cell.monthOffset)
              }
              disabled={isDisabled}
              className={`relative mx-auto grid h-8 w-8 place-items-center text-[13px] font-medium transition-all duration-200
                ${isDisabled
                  ? isOutsideMonth
                    ? "cursor-default bg-transparent text-gray-300/80"
                    : "cursor-not-allowed bg-transparent text-gray-400"
                  : isSelected
                    ? "cursor-pointer bg-[#347f7c] text-white ring-4 ring-[#347f7c]/15"
                  : isToday
                      ? "cursor-pointer border border-[#347f7c]/35 bg-[#edf3f1] text-[#245e5b] shadow-sm hover:border-[#347f7c]"
                      : "cursor-pointer bg-transparent text-gray-900 hover:bg-[#f8fbfa]"
                }`}
            >
              {cell.day}
              {!isDisabled && !isSelected && (
                <span className="pointer-events-none absolute bottom-[5px] h-1 w-1 rounded-full bg-emerald-500/70" />
              )}
            </button>
          );
        })}
      </div>

      <p className="mt-2 text-center text-[11px] font-medium text-gray-500">
        Dates with slots are highlighted for booking
      </p>

      {availableDates.length === 0 && (
        <div className="mt-3 border border-[#d7e4e1] bg-[#f8fbfa] p-3 text-center text-sm text-gray-600">
          No slots available for this location.
          Please choose another location.
        </div>
      )}
    </div>
  );

  return (
    isInline ? (
      calendarCard
    ) : (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-3 backdrop-blur-sm !mt-0">
        {calendarCard}
      </div>
    )
  );
}
