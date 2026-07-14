"use client";

import { useMemo, useRef } from "react";
import { Calendar, ChevronDown } from "@/components/icons";
import AdminCompactFilters from "@/components/admin/shared/AdminCompactFilters";
import { formatSlotTime, formatWallDate } from "@/lib/formatters";
import type { DatePreset } from "@/types/admin/filters";

interface Props {
  search: string;
  setSearch: (v: string) => void;

  preset: DatePreset | null;
  setPreset: (p: DatePreset | null) => void;

  packageName: string;
  setPackageName: (v: string) => void;

  timeRange: string;
  setTimeRange: (v: string) => void;

  status: string;
  setStatus: (v: string) => void;

  packages: string[];
  timeRanges: string[];
  showPreset?: boolean;
  showStatus?: boolean;
  statusOptions?: Array<{
    value: string;
    label: string;
  }>;
  customDate?: string;
  setCustomDate?: (v: string) => void;
  showCustomDate?: boolean;
  onClearFilters?: () => void;
}

const PRESET_LABEL: Record<string, string> = {
  ALL: "All event dates",
  TODAY: "Event today",
  YESTERDAY: "Event yesterday",
  LAST_3: "Event in last 3 days",
  LAST_7: "Event in last 7 days",
  LAST_15: "Event in last 15 days",
  LAST_30: "Event in last 30 days",
};



export default function BookingsFilters({
  search,
  setSearch,
  preset,
  setPreset,
  packageName,
  setPackageName,
  timeRange,
  setTimeRange,
  status,
  setStatus,
  packages,
  timeRanges,
  showPreset = true,
  showStatus = true,
  statusOptions = [
    { value: "PAID", label: "Paid" },
    { value: "PENDING", label: "Pending" },
    { value: "FAILED", label: "Failed" },
  ],
  customDate = "",
  setCustomDate,
  showCustomDate = false,
  onClearFilters,
}: Props) {
  const customDateInputRef = useRef<HTMLInputElement | null>(null);
  const openCustomDatePicker = () => {
    const input = customDateInputRef.current;
    if (!input) return;
    if (typeof input.showPicker === "function") {
      try {
        input.showPicker();
        return;
      } catch {
        // Fallback for browsers that block showPicker.
      }
    }
    input.focus();
  };

  const sortTimeRanges = (input: string[]) => {
    const toMinutes = (time: string) => {
      const [h, m] = time.split(":").map(Number);
      if (!Number.isFinite(h) || !Number.isFinite(m)) return Number.MAX_SAFE_INTEGER;
      return h * 60 + m;
    };

    const parseWindow = (window: string) => {
      const [start = "", end = ""] = window.split(" - ");
      return { start, end };
    };

    return [...new Set(input)].sort((a, b) => {
      const left = parseWindow(a);
      const right = parseWindow(b);
      const startDiff = toMinutes(left.start) - toMinutes(right.start);
      if (startDiff !== 0) return startDiff;
      return toMinutes(left.end) - toMinutes(right.end);
    });
  };

  const sortedTimeRanges = useMemo(
    () => sortTimeRanges(timeRanges),
    [timeRanges]
  );

  const formatTimeRangeLabel = (window: string) => {
    const [start = "", end = ""] = window.split(" - ");
    if (!start || !end) return window;
    return formatSlotTime(start, end);
  };

  const formattedCustomDate = useMemo(() => {
    if (!customDate) return "Event Date";
    const date = new Date(`${customDate}T00:00:00`);
    if (Number.isNaN(date.getTime())) return "Custom date";
    return formatWallDate(date, { day: "2-digit", month: "short", year: "numeric" }, "en-GB");
  }, [customDate]);

  const hasActiveFilters =
    search.trim().length > 0 ||
    packageName.length > 0 ||
    timeRange.length > 0 ||
    status.length > 0 ||
    customDate.length > 0 ||
    preset !== null;
  const activeFilterCount = [
    packageName.length > 0,
    timeRange.length > 0,
    status.length > 0,
    customDate.length > 0,
    preset !== null,
  ].filter(Boolean).length;

  return (
    <AdminCompactFilters
      hasActiveFilters={hasActiveFilters}
      activeFilterCount={activeFilterCount}
      onClearFilters={onClearFilters}
      searchSlot={
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search reference, name, phone, package..."
          className="h-10 w-full rounded-md border border-neutral-200 px-3 text-sm"
        />
      }
      filterSlot={
        <>
          {/* Date Preset */}
          {showPreset ? (
            <div className="relative w-full">
              <select
                value={preset ?? "ALL"}
                onChange={(e) =>
                  setPreset(
                    e.target.value === "ALL"
                      ? null
                      : (e.target.value as DatePreset)
                  )
                }
                className="h-10 w-full appearance-none rounded-md border border-neutral-200 bg-white pl-9 pr-8 text-sm"
              >
                {Object.entries(PRESET_LABEL).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>

              <Calendar
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500 pointer-events-none"
              />
              <ChevronDown
                size={14}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 pointer-events-none"
              />
            </div>
          ) : null}

          {showCustomDate && setCustomDate ? (
            <div className="relative w-full">
              <div
                className="relative"
                onClick={openCustomDatePicker}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    openCustomDatePicker();
                  }
                }}
                role="button"
                tabIndex={0}
              >
                <input
                  ref={customDateInputRef}
                  type="date"
                  value={customDate}
                  onChange={(event) => setCustomDate(event.target.value)}
                  className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
                  aria-label="Select event date"
                />
                <div className="inline-flex h-10 w-full items-center justify-between gap-2 rounded-md border border-neutral-200 bg-white px-3 text-sm text-neutral-700">
                  <span className="inline-flex items-center gap-2 truncate">
                    <Calendar size={14} className="text-neutral-500" />
                    <span className="truncate">{formattedCustomDate}</span>
                  </span>
                  <ChevronDown size={14} className="text-neutral-500" />
                </div>
              </div>
            </div>
          ) : null}

          {/* Package */}
          <select
            value={packageName}
            onChange={(e) => setPackageName(e.target.value)}
            className="h-10 w-full rounded-md border border-neutral-200 px-3 text-sm"
          >
            <option value="">All Packages</option>
            {packages.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>

          {/* Time range */}
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="h-10 w-full rounded-md border border-neutral-200 px-3 text-sm"
          >
            <option value="">All Times</option>
            {sortedTimeRanges.map((range) => (
              <option key={range} value={range}>
                {formatTimeRangeLabel(range)}
              </option>
            ))}
          </select>

          {/* Status */}
          {showStatus ? (
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="h-10 w-full rounded-md border border-neutral-200 px-3 text-sm"
            >
              <option value="">All Status</option>
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          ) : null}
        </>
      }
    />
  );
}
