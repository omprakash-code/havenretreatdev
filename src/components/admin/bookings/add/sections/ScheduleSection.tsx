import { useMemo, useRef } from "react";
import { ChevronDown } from "lucide-react";

import { Calendar } from "@/components/icons";
import TimeRangePicker, { type UnavailableTimeRange } from "@/components/booking/time-range/TimeRangePicker";
import { FieldTooltip } from "@/components/admin/bookings/add/FieldTooltip";
import {
  inputClass,
  sectionClass,
  selectableInputClass,
  type LocationOption,
  type TheatreOption,
} from "@/components/admin/bookings/add/shared";

type ScheduleSectionProps = {
  locationId: string;
  date: string;
  theatreId: string;
  startTime: string | null;
  endTime: string | null;
  minimumBookingDurationHours: number;
  locations: LocationOption[];
  loadingTheatres: boolean;
  theatres: TheatreOption[];
  errors: Record<string, string>;
  dateHoverHint: string;
  theatreHoverHint: string;
  slotHoverHint: string;
  unavailableRanges?: UnavailableTimeRange[];
  businessOpenTime?: string;
  businessCloseTime?: string;
  timezone?: string;
  loadingAvailability?: boolean;
  onLocationDateChange: (nextLocationId: string, nextDate: string) => void;
  onTheatreSlotChange: (nextTheatreId: string, nextSlotId: string) => void;
  onTimeRangeChange: (nextStartTime: string | null, nextEndTime: string | null) => void;
};

const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function getFormattedDate(value: string) {
  if (!value) return "Select date";
  const parts = value.split("-").map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) return "Invalid date";
  const [year, month, day] = parts;
  return `${String(day).padStart(2, "0")} ${MONTH_NAMES[month - 1]} ${year}`;
}

export function ScheduleSection({
  locationId,
  date,
  theatreId,
  startTime,
  endTime,
  minimumBookingDurationHours,
  locations,
  loadingTheatres,
  theatres,
  errors,
  dateHoverHint,
  theatreHoverHint,
  slotHoverHint,
  unavailableRanges = [],
  businessOpenTime = "09:00",
  businessCloseTime = "23:00",
  timezone = "America/New_York",
  loadingAvailability = false,
  onLocationDateChange,
  onTheatreSlotChange,
  onTimeRangeChange,
}: ScheduleSectionProps) {
  const dateInputRef = useRef<HTMLInputElement | null>(null);

  const formattedDate = getFormattedDate(date);
  const isTheatreBlocked = !locationId || !date || loadingTheatres;
  const isTimeRangeBlocked = !locationId || !date || !theatreId || loadingTheatres || loadingAvailability;
  const selectedDate = useMemo(() => {
    if (!date) return null;
    const parsed = new Date(`${date}T00:00:00`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }, [date]);
  const selectedTheatre = useMemo(
    () => theatres.find((theatre) => theatre.id === theatreId) ?? null,
    [theatres, theatreId]
  );
  const theatreLabel = loadingTheatres
    ? "Loading packages..."
    : selectedTheatre
    ? selectedTheatre.name
    : "Select package";

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
            Package <span className="text-red-500">*</span>
          </label>
          <FieldTooltip message={theatreHoverHint || errors.theatreId}>
            <div className="relative mt-1">
              <select
                value={theatreId}
                onChange={(event) => {
                  onTheatreSlotChange(event.target.value, "");
                }}
                disabled={isTheatreBlocked}
                aria-label="Package"
                className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
              >
                <option value="">{loadingTheatres ? "Loading packages..." : "Select package"}</option>
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
            Event Time <span className="text-red-500">*</span>
          </label>
          <FieldTooltip message={slotHoverHint || errors.slotId || errors.slotStatus}>
            <div>
              <TimeRangePicker
                startTime={startTime}
                endTime={endTime}
                minDurationHours={minimumBookingDurationHours}
                selectedDate={selectedDate}
                disabled={isTimeRangeBlocked}
                variant="admin-field"
                unavailableRanges={unavailableRanges}
                businessOpenTime={businessOpenTime}
                businessCloseTime={businessCloseTime}
                timezone={timezone}
                onChange={onTimeRangeChange}
              />
              {loadingAvailability && (
                <p className="mt-1 text-xs text-slate-500">Checking availability…</p>
              )}
            </div>
          </FieldTooltip>
          {errors.slotId && <p className="mt-1 text-xs text-red-600">{errors.slotId}</p>}
        </div>
      </div>
    </section>
  );
}
