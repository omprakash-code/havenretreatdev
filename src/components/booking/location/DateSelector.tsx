"use client";

import { Calendar } from "@/components/icons";
import { formatWallDate } from "@/lib/formatters";
import { BOOKING_TIME_ZONE } from "@/lib/booking-policy";
import {
  addDaysToDateKey,
  dateFromDateKey,
  getDateKeyInTimeZone,
  toDateKey,
} from "@/lib/date";

type QuickDate = {
  label: string | null;
  offset: number;
};

type DateSelectorProps = {
  datesLoading: boolean;
  noSlotsForLocation: boolean | null;
  hasLocation: boolean;
  selectedDate: Date | null;
  availableDates: string[];
  quickDates: QuickDate[];
  onQuickDateSelect: (offset: number) => void;
  onOpenCalendar: () => void;
  isQuickDate: (date: Date) => boolean;
  isSameDay: (a: Date, b: Date) => boolean;
  getWeekdayShort: (date: Date) => string;
  timezone?: string;
};

function formatBookingDateShort(date: Date) {
  return formatWallDate(date, { day: "2-digit", month: "short" });
}

export default function DateSelector({
  datesLoading,
  noSlotsForLocation,
  hasLocation,
  selectedDate,
  availableDates,
  quickDates,
  onQuickDateSelect,
  onOpenCalendar,
  isQuickDate,
  isSameDay,
  getWeekdayShort,
  timezone = BOOKING_TIME_ZONE,
}: DateSelectorProps) {
  const venueTodayKey = getDateKeyInTimeZone(new Date(), timezone);

  return (
    <section className="space-y-3">
      <p className="text-[0.68rem] font-bold uppercase tracking-[0.2em] text-[#101828]">
        Select Date
      </p>

      <div className="grid grid-cols-5 gap-2 sm:gap-3">
        {datesLoading
          ? Array.from({ length: quickDates.length }).map((_, i) => (
              <DateSkeleton key={`date-skeleton-${i}`} />
            ))
          : quickDates.map((quickDate) => {
              const dateKey = addDaysToDateKey(venueTodayKey, quickDate.offset);
              const date = dateFromDateKey(dateKey);

              const label =
                quickDate.offset <= 1 ? quickDate.label : getWeekdayShort(date);
              const active = selectedDate && isSameDay(date, selectedDate);
              const disabled =
                datesLoading ||
                !hasLocation ||
                !availableDates.some(
                  (availableDate) => toDateKey(availableDate) === toDateKey(date)
                );

              return (
                <button
                  key={`quick-${quickDate.offset}`}
                  type="button"
                  disabled={disabled}
                  onClick={() => onQuickDateSelect(quickDate.offset)}
                  className={`min-h-[68px] px-1.5 py-2 text-center transition duration-300 ease-out sm:min-h-[74px] sm:px-2 sm:py-2.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#347f7c] ${
                    disabled
                      ? "cursor-not-allowed bg-[#f6f8f7] text-[#98a2b3]"
                      : active
                        ? "bg-[#0d3b24] text-white shadow-[0_16px_30px_rgba(13,59,36,0.28)]"
                        : "bg-white text-[#101828] hover:-translate-y-0.5 hover:bg-[#f8fbfa] hover:shadow-[0_10px_22px_rgba(16,24,40,0.07)] active:translate-y-0 active:scale-[0.99]"
                  }`}
                  title={
                    noSlotsForLocation
                      ? "No dates available for this location"
                      : undefined
                  }
                >
                  <span className="block truncate text-[9px] font-bold uppercase tracking-[0.03em] opacity-80 sm:text-[11px] sm:tracking-[0.04em]">
                    {label}
                  </span>
                  <span className="mt-1 block text-lg font-bold leading-none sm:text-lg">
                    {date.getDate()}
                  </span>
                  <span className="mt-1 block text-[11px] font-medium opacity-75">
                    {formatWallDate(date, { month: "short" })}
                  </span>
                </button>
              );
            })}

        {!datesLoading && (
          <button
            type="button"
            disabled={!hasLocation}
            onClick={onOpenCalendar}
            className={`flex min-h-[68px] flex-col items-center justify-center px-1.5 py-2 text-center transition duration-300 ease-out sm:min-h-[74px] sm:px-2 sm:py-2.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#347f7c] ${
              !hasLocation || noSlotsForLocation
                ? "cursor-not-allowed bg-[#f6f8f7] text-[#98a2b3]"
                : selectedDate && !isQuickDate(selectedDate)
                  ? "bg-[#0d3b24] text-white shadow-[0_16px_30px_rgba(13,59,36,0.28)]"
                  : "bg-white text-[#101828] shadow-[0_6px_18px_rgba(16,24,40,0.04)] ring-1 ring-[#d7e4e1] hover:-translate-y-0.5 hover:bg-[#fbfdfc] hover:shadow-[0_14px_28px_rgba(16,24,40,0.08)] hover:ring-[#9fbfba] active:translate-y-0 active:scale-[0.99]"
            }`}
          >
            <span className={`flex justify-center ${selectedDate && !isQuickDate(selectedDate) ? "text-white" : "text-[#245e5b]"}`}>
              <Calendar size={17} className="sm:size-[18px]" />
            </span>
            <span className="mt-1 block text-[11px] font-semibold leading-tight sm:text-[12px]">
              {selectedDate && !isQuickDate(selectedDate)
                ? formatBookingDateShort(selectedDate)
                : "Choose Date"}
            </span>
          </button>
        )}
      </div>
    </section>
  );
}

function DateSkeleton() {
  return (
    <div className="min-h-[64px] animate-pulse bg-[#f6f8f7] px-3 py-2.5 ring-1 ring-[#d7e4e1]">
      <div className="mb-2 h-3 w-12 bg-[#d7e4e1]" />
      <div className="h-5 w-16 bg-[#c5d6d2]" />
    </div>
  );
}
