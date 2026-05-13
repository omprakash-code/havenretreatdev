"use client";

import { useMemo, useRef } from "react";
import { Calendar, ChevronDown } from "@/components/icons";
import AdminCompactFilters from "@/components/admin/shared/AdminCompactFilters";
import type { SlotDatePreset } from "@/types/admin/slot-filters";

interface Props {
  preset: SlotDatePreset | null;
  setPreset: (p: SlotDatePreset | null) => void;

  selectedDate: Date | null;
  setSelectedDate: (d: Date | null) => void;

  theatre: string;
  setTheatre: (v: string) => void;

  status: string;
  setStatus: (v: string) => void;

  search: string;
  setSearch: (v: string) => void;

  theatres: string[];
  onClearFilters?: () => void;
}

const PRESET_LABEL: Record<string, string> = {
  ALL: "All dates",
  TODAY: "Today",
  TOMORROW: "Tomorrow",
  NEXT_7: "Next 7 days",
  NEXT_30: "Next 30 days",
};

export default function SlotFilters({
  preset,
  setPreset,
  selectedDate,
  setSelectedDate,
  theatre,
  setTheatre,
  status,
  setStatus,
  search,
  setSearch,
  theatres,
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

  const selectedDateValue = useMemo(() => {
    if (!selectedDate) return "";
    const year = selectedDate.getFullYear();
    const month = String(selectedDate.getMonth() + 1).padStart(2, "0");
    const day = String(selectedDate.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }, [selectedDate]);

  const formattedSelectedDate = useMemo(() => {
    if (!selectedDate) return "Date";
    return new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(selectedDate);
  }, [selectedDate]);

  const hasActiveFilters =
    search.trim().length > 0 ||
    theatre.length > 0 ||
    status.length > 0 ||
    preset !== null ||
    selectedDate !== null;
  const activeFilterCount = [
    theatre.length > 0,
    status.length > 0,
    preset !== null,
    selectedDate !== null,
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
          placeholder="Search time or theatre..."
          className="h-10 w-full rounded-md border border-neutral-200 px-3 text-sm"
        />
      }
      filterSlot={
        <>
          {/* Date Preset */}
          <div className="relative w-full">
            <select
              value={preset ?? "ALL"}
              onChange={(e) =>
                setPreset(
                  e.target.value === "ALL"
                    ? null
                    : (e.target.value as SlotDatePreset)
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

          {/* Specific Date */}
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
                value={selectedDateValue}
                onChange={(event) => {
                  const value = event.target.value.trim();
                  if (!value) {
                    setSelectedDate(null);
                    return;
                  }
                  setSelectedDate(new Date(`${value}T00:00:00`));
                  setPreset(null); // disable presets when manual date chosen
                }}
                className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
                aria-label="Select specific date"
              />
              <div className="inline-flex h-10 w-full items-center justify-between gap-2 rounded-md border border-neutral-200 bg-white px-3 text-sm text-neutral-700">
                <span className="inline-flex items-center gap-2 truncate">
                  <Calendar size={14} className="text-neutral-500" />
                  <span className="truncate">{formattedSelectedDate}</span>
                </span>
                <ChevronDown size={14} className="text-neutral-500" />
              </div>
            </div>
          </div>

          {/* Theatre */}
          <select
            value={theatre}
            onChange={(e) => setTheatre(e.target.value)}
            className="h-10 w-full rounded-md border border-neutral-200 px-3 text-sm"
          >
            <option value="">All Theatres</option>
            {theatres.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>

          {/* Status */}
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="h-10 w-full rounded-md border border-neutral-200 px-3 text-sm"
          >
            <option value="">All Status</option>
            <option value="AVAILABLE">Available</option>
            <option value="BOOKED">Booked</option>
            <option value="LOCKED">Locked</option>
            <option value="DISABLED">Disabled</option>
          </select>
        </>
      }
    />
  );
}
