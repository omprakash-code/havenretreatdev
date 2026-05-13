import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

import { Calendar } from "@/components/icons";
import { FieldTooltip } from "@/components/admin/bookings/add/FieldTooltip";
import {
  inputClass,
  sectionClass,
  selectableInputClass,
  toTitleStatus,
  type LocationOption,
  type SlotOption,
  type TheatreOption,
} from "@/components/admin/bookings/add/shared";
import { formatISTDate, formatSlotTime } from "@/lib/formatters";

type ScheduleSectionProps = {
  locationId: string;
  date: string;
  theatreId: string;
  slotId: string;
  locations: LocationOption[];
  loadingTheatres: boolean;
  theatres: TheatreOption[];
  theatreSlots: SlotOption[];
  errors: Record<string, string>;
  dateHoverHint: string;
  theatreHoverHint: string;
  slotHoverHint: string;
  onLocationDateChange: (nextLocationId: string, nextDate: string) => void;
  onTheatreSlotChange: (nextTheatreId: string, nextSlotId: string) => void;
};

function getSlotStatusDotClass(status: SlotOption["status"]) {
  if (status === "AVAILABLE") return "bg-emerald-500";
  if (status === "LOCKED") return "bg-amber-500";
  if (status === "BOOKED") return "bg-red-500";
  if (status === "DISABLED") return "bg-slate-500";
  return "bg-slate-400";
}

function getFormattedDate(value: string) {
  if (!value) return "Select date";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Invalid date";
  return formatISTDate(parsed);
}

export function ScheduleSection({
  locationId,
  date,
  theatreId,
  slotId,
  locations,
  loadingTheatres,
  theatres,
  theatreSlots,
  errors,
  dateHoverHint,
  theatreHoverHint,
  slotHoverHint,
  onLocationDateChange,
  onTheatreSlotChange,
}: ScheduleSectionProps) {
  const dateInputRef = useRef<HTMLInputElement | null>(null);
  const slotMenuRef = useRef<HTMLDivElement | null>(null);
  const [isSlotMenuOpen, setIsSlotMenuOpen] = useState(false);

  const formattedDate = getFormattedDate(date);
  const isTheatreBlocked = !locationId || !date || loadingTheatres;
  const selectedTheatre = useMemo(
    () => theatres.find((theatre) => theatre.id === theatreId) ?? null,
    [theatres, theatreId]
  );
  const theatreLabel = loadingTheatres
    ? "Loading theatres..."
    : selectedTheatre
    ? selectedTheatre.name
    : "Select theatre";
  const selectedSlot = useMemo(
    () => theatreSlots.find((slot) => slot.id === slotId) ?? null,
    [theatreSlots, slotId]
  );
  const selectedSlotLabel = selectedSlot
    ? `${formatSlotTime(selectedSlot.startTime, selectedSlot.endTime)} (${toTitleStatus(selectedSlot.status)})`
    : "Select slot";

  const openDatePicker = () => {
    if (!locationId) return;
    const input = dateInputRef.current;
    if (!input) return;
    if (typeof input.showPicker === "function") {
      try {
        input.showPicker();
        return;
      } catch {
        // fallback to focus
      }
    }
    input.focus();
  };

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!slotMenuRef.current) return;
      if (slotMenuRef.current.contains(event.target as Node)) return;
      setIsSlotMenuOpen(false);
    }

    document.addEventListener("mousedown", onPointerDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, []);

  return (
    <section className={sectionClass}>
      <h2 className="text-sm font-semibold text-slate-900">1. Booking Details</h2>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-700">
            Location <span className="text-red-500">*</span>
          </label>
          <select
            value={locationId}
            onChange={(event) => onLocationDateChange(event.target.value, date)}
            className={selectableInputClass}
          >
            <option value="">Select location</option>
            {locations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.name}
                {location.city ? ` (${location.city})` : ""}
              </option>
            ))}
          </select>
          {errors.locationId && <p className="mt-1 text-xs text-red-600">{errors.locationId}</p>}
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-700">
            Date <span className="text-red-500">*</span>
          </label>
          <FieldTooltip message={dateHoverHint || errors.date}>
            <div
              className="relative mt-1"
              onClick={openDatePicker}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  openDatePicker();
                }
              }}
              role="button"
              tabIndex={locationId ? 0 : -1}
            >
              <input
                ref={dateInputRef}
                type="date"
                value={date}
                onChange={(event) => onLocationDateChange(locationId, event.target.value)}
                min={new Date().toISOString().slice(0, 10)}
                disabled={!locationId}
                aria-label="Date"
                className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
              />
              <div
                className={`${inputClass} flex items-center justify-between ${
                  locationId ? "cursor-pointer" : "cursor-not-allowed"
                }`}
              >
                <span
                  className={
                    date
                      ? "text-slate-900"
                      : locationId
                      ? "font-medium text-slate-700"
                      : "text-slate-400"
                  }
                >
                  {formattedDate}
                </span>
                <Calendar size={14} className="shrink-0 text-slate-500" />
              </div>
            </div>
          </FieldTooltip>
          {errors.date && <p className="mt-1 text-xs text-red-600">{errors.date}</p>}
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-700">
            Theatre <span className="text-red-500">*</span>
          </label>
          <FieldTooltip message={theatreHoverHint || errors.theatreId}>
            <div className="relative mt-1">
              <select
                value={theatreId}
                onChange={(event) => {
                  setIsSlotMenuOpen(false);
                  onTheatreSlotChange(event.target.value, "");
                }}
                disabled={isTheatreBlocked}
                aria-label="Theatre"
                className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
              >
                <option value="">{loadingTheatres ? "Loading theatres..." : "Select theatre"}</option>
                {theatres.map((theatre) => (
                  <option key={theatre.id} value={theatre.id}>
                    {theatre.name}
                  </option>
                ))}
              </select>
              <div
                className={`${inputClass} flex items-center justify-between ${
                  isTheatreBlocked ? "cursor-not-allowed" : "cursor-pointer"
                }`}
              >
                <span
                  className={
                    selectedTheatre
                      ? "text-slate-900"
                      : isTheatreBlocked
                      ? "text-slate-400"
                      : "font-medium text-slate-700"
                  }
                >
                  {theatreLabel}
                </span>
                <ChevronDown size={16} className="shrink-0 text-slate-500" />
              </div>
            </div>
          </FieldTooltip>
          {errors.theatreId && <p className="mt-1 text-xs text-red-600">{errors.theatreId}</p>}
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-700">
            Slot <span className="text-red-500">*</span>
          </label>
          <FieldTooltip message={slotHoverHint || errors.slotId || errors.slotStatus}>
            <div className="relative mt-1" ref={slotMenuRef}>
              <button
                type="button"
                disabled={!theatreId}
                onClick={() => setIsSlotMenuOpen((prev) => !prev)}
                className={`${inputClass} flex items-center justify-between text-left ${
                  theatreId ? "cursor-pointer" : "cursor-not-allowed"
                }`}
                aria-haspopup="listbox"
                aria-expanded={isSlotMenuOpen}
              >
                <span
                  className={`truncate ${
                    selectedSlot
                      ? "text-slate-900"
                      : theatreId
                      ? "font-medium text-slate-700"
                      : "text-slate-400"
                  }`}
                >
                  {selectedSlotLabel}
                </span>
                <ChevronDown
                  size={16}
                  className={`shrink-0 text-slate-500 transition-transform ${
                    isSlotMenuOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              {isSlotMenuOpen && theatreId ? (
                <div
                  role="listbox"
                  className="absolute z-30 mt-1 max-h-64 w-full overflow-auto rounded-md border border-slate-200 bg-white p-1 shadow-lg"
                >
                  {theatreSlots.length === 0 ? (
                    <div className="px-2 py-2 text-xs text-slate-500">No slots available</div>
                  ) : (
                    theatreSlots.map((slot) => {
                      const isSelected = slot.id === slotId;
                      return (
                        <button
                          key={slot.id}
                          type="button"
                          role="option"
                          aria-selected={isSelected}
                          onClick={() => {
                            onTheatreSlotChange(theatreId, slot.id);
                            setIsSlotMenuOpen(false);
                          }}
                          className={`flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm transition ${
                            isSelected
                              ? "bg-slate-100 text-slate-900"
                              : "text-slate-700 hover:bg-slate-50"
                          }`}
                        >
                          <span
                            className={`h-2 w-2 shrink-0 rounded-full ${getSlotStatusDotClass(slot.status)}`}
                            aria-hidden
                          />
                          <span className="truncate">
                            {formatSlotTime(slot.startTime, slot.endTime)} ({toTitleStatus(slot.status)})
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>
              ) : null}
            </div>
          </FieldTooltip>
          {errors.slotId && <p className="mt-1 text-xs text-red-600">{errors.slotId}</p>}
        </div>
      </div>
    </section>
  );
}
