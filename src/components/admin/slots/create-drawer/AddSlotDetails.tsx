"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Calendar, ChevronDown, Clock, IndianRupee } from "lucide-react";
import { toast } from "sonner";

import type { AdminSlot } from "@/types/admin/slot-admin";
import {
  formatDuration,
  formatISTDate,
  formatISTTime,
  formatSlotTime,
} from "@/lib/formatters";
import { timeToMinutes } from "@/lib/time";

export type SlotCreateTheatreOption = {
  id: string;
  name: string;
  locationId: string;
  locationName: string;
};

export type SlotCreateLocationOption = {
  id: string;
  name: string;
};

type Props = {
  locations: SlotCreateLocationOption[];
  theatres: SlotCreateTheatreOption[];
  onCancel: () => void;
  onCreated?: (slot: AdminSlot) => void;
};

function getTodayISTDateInputValue() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function calculateDuration(startTime: string, endTime: string) {
  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);
  return end > start ? end - start : end + 1440 - start;
}

function formatConflictDate(date: string) {
  const parsed = new Date(`${date}T00:00:00+05:30`);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });
}

export default function AddSlotDetails({
  locations,
  theatres,
  onCancel,
  onCreated,
}: Props) {
  const locationOptions = useMemo(() => {
    if (locations.length > 0) {
      return locations;
    }

    const map = new Map<string, { id: string; name: string }>();
    for (const theatre of theatres) {
      if (!map.has(theatre.locationId)) {
        map.set(theatre.locationId, {
          id: theatre.locationId,
          name: theatre.locationName,
        });
      }
    }
    return Array.from(map.values());
  }, [locations, theatres]);

  const [locationId, setLocationId] = useState(locationOptions[0]?.id ?? "");
  const filteredTheatres = useMemo(
    () =>
      locationId
        ? theatres.filter((theatre) => theatre.locationId === locationId)
        : theatres,
    [locationId, theatres]
  );
  const [theatreId, setTheatreId] = useState(filteredTheatres[0]?.id ?? "");
  const [date, setDate] = useState(getTodayISTDateInputValue);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("12:00");
  const [regularPrice, setRegularPrice] = useState<number | "">(1499);
  const [salePrice, setSalePrice] = useState<number | "">("");
  const [status, setStatus] = useState<"AVAILABLE" | "DISABLED">("AVAILABLE");
  const [discountText, setDiscountText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const dateInputRef = useRef<HTMLInputElement | null>(null);
  const startTimeInputRef = useRef<HTMLInputElement | null>(null);
  const endTimeInputRef = useRef<HTMLInputElement | null>(null);

  const durationMin = useMemo(
    () => calculateDuration(startTime, endTime),
    [startTime, endTime]
  );
  const isOvernight = timeToMinutes(endTime) < timeToMinutes(startTime);
  const saleNumeric = salePrice === "" ? null : salePrice;
  const regularNumeric = regularPrice === "" ? null : regularPrice;

  const priceInvalid =
    regularNumeric == null ||
    regularNumeric <= 0 ||
    (saleNumeric != null && saleNumeric <= 0) ||
    (saleNumeric != null && regularNumeric != null && saleNumeric >= regularNumeric);

  const durationInvalid = durationMin < 30 || timeToMinutes(startTime) === timeToMinutes(endTime);
  const canSubmit =
    locationId.length > 0 &&
    theatreId.length > 0 &&
    date.length > 0 &&
    !durationInvalid &&
    !priceInvalid &&
    !submitting;
  const formattedDateValue = useMemo(() => {
    if (!date) return "Select date";
    return formatISTDate(`${date}T00:00:00+05:30`);
  }, [date]);

  useEffect(() => {
    if (!locationId && locationOptions.length > 0) {
      setLocationId(locationOptions[0].id);
      return;
    }

    const selectedIsValid = filteredTheatres.some((theatre) => theatre.id === theatreId);
    if (!selectedIsValid) {
      setTheatreId(filteredTheatres[0]?.id ?? "");
    }
  }, [filteredTheatres, locationId, locationOptions, theatreId]);

  async function handleCreateSlot() {
    if (!canSubmit) return;

    try {
      setSubmitting(true);
      const res = await fetch("/api/admin/slots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          theatreId,
          date,
          timing: {
            startTime,
            endTime,
          },
          pricing: {
            regularPrice: Number(regularNumeric),
            salePrice: saleNumeric,
          },
          status: {
            value: status,
            discountText: discountText.trim() || null,
          },
        }),
      });

      const json = await res.json();

      if (!res.ok || !json?.success) {
        if (json?.code === "SLOT_OVERLAP" && json?.details?.conflictingSlot) {
          const conflicting = json.details.conflictingSlot;
          const conflictDate = formatConflictDate(conflicting.date);
          const conflictTime = formatSlotTime(conflicting.startTime, conflicting.endTime);
          throw new Error(
            `Slot conflict with ${conflictDate} ${conflictTime}${
              json.details.reason ? ` (${json.details.reason})` : ""
            }`
          );
        }

        throw new Error(json?.message || "Failed to create slot");
      }

      onCreated?.(json.data as AdminSlot);
      toast.success("Slot created successfully");
      onCancel();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to create slot";
      toast.error("Slot creation failed", { description: message });
    } finally {
      setSubmitting(false);
    }
  }

  function openPicker(inputRef: { current: HTMLInputElement | null }) {
    const input = inputRef.current;
    if (!input) return;
    if (typeof input.showPicker === "function") {
      try {
        input.showPicker();
        return;
      } catch {
        // Browser may block showPicker unless in direct gesture context.
      }
    }
    input.focus();
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-3 overflow-y-auto">
        <div className="space-y-2 rounded-lg border border-slate-200 p-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Calendar size={16} />
            Slot Basics
          </h3>

          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-slate-500">Location</label>
                <select
                  value={locationId}
                  onChange={(event) => setLocationId(event.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="" disabled>
                    Select location
                  </option>
                  {locationOptions.map((location) => (
                    <option key={location.id} value={location.id}>
                      {location.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs text-slate-500">Theatre</label>
                <select
                  value={theatreId}
                  onChange={(event) => setTheatreId(event.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="" disabled>
                    Select theatre
                  </option>
                  {filteredTheatres.map((theatre) => (
                    <option key={theatre.id} value={theatre.id}>
                      {theatre.name}
                    </option>
                  ))}
                </select>
                {locationId && filteredTheatres.length === 0 && (
                  <p className="mt-1 text-xs text-amber-700">
                    No theatres are available for this location.
                  </p>
                )}
              </div>
            </div>

            <div>
              <label className="text-xs text-slate-500">Date</label>
              <div
                className="relative mt-1"
                role="button"
                tabIndex={0}
                onClick={() => openPicker(dateInputRef)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    openPicker(dateInputRef);
                  }
                }}
              >
                <input
                  ref={dateInputRef}
                  type="date"
                  value={date}
                  min={getTodayISTDateInputValue()}
                  onChange={(event) => setDate(event.target.value)}
                  className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
                  aria-label="Select slot date"
                />
                <div className="inline-flex w-full items-center justify-between gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700">
                  <span className="inline-flex items-center gap-2 truncate">
                    <Calendar size={14} className="text-slate-500" />
                    <span className="truncate">{formattedDateValue}</span>
                  </span>
                  <ChevronDown size={14} className="text-slate-500" />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-2 rounded-lg border border-slate-200 p-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Clock size={16} />
            Timing
          </h3>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div>
              <label className="text-xs text-slate-500">Start Time</label>
              <div
                className="relative mt-1"
                role="button"
                tabIndex={0}
                onClick={() => openPicker(startTimeInputRef)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    openPicker(startTimeInputRef);
                  }
                }}
              >
                <input
                  ref={startTimeInputRef}
                  type="time"
                  value={startTime}
                  onChange={(event) => setStartTime(event.target.value)}
                  className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
                  aria-label="Select start time"
                />
                <div className="inline-flex w-full items-center justify-between gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700">
                  <span className="inline-flex items-center gap-2 truncate">
                    <Clock size={14} className="text-slate-500" />
                    <span className="truncate">{formatISTTime(startTime)}</span>
                  </span>
                  <ChevronDown size={14} className="text-slate-500" />
                </div>
              </div>
            </div>

            <div>
              <label className="text-xs text-slate-500">End Time</label>
              <div
                className="relative mt-1"
                role="button"
                tabIndex={0}
                onClick={() => openPicker(endTimeInputRef)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    openPicker(endTimeInputRef);
                  }
                }}
              >
                <input
                  ref={endTimeInputRef}
                  type="time"
                  value={endTime}
                  onChange={(event) => setEndTime(event.target.value)}
                  className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
                  aria-label="Select end time"
                />
                <div className="inline-flex w-full items-center justify-between gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700">
                  <span className="inline-flex items-center gap-2 truncate">
                    <Clock size={14} className="text-slate-500" />
                    <span className="truncate">{formatISTTime(endTime)}</span>
                  </span>
                  <ChevronDown size={14} className="text-slate-500" />
                </div>
              </div>
            </div>
          </div>

          <div className="text-xs text-slate-700">
            Duration: <span className="font-semibold text-slate-900">{formatDuration(durationMin)}</span>
          </div>

          {durationInvalid && (
            <p className="inline-block rounded border border-red-200 bg-red-50 p-2 text-xs text-red-600">
              Slot duration must be at least 30 minutes and start/end times cannot be same.
            </p>
          )}

          {!durationInvalid && isOvernight && (
            <p className="inline-block rounded border border-amber-200 bg-amber-50 p-2 text-xs text-amber-700">
              This slot will extend into the next day.
            </p>
          )}
        </div>

        <div className="space-y-2 rounded-lg border border-slate-200 p-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <IndianRupee size={16} />
            Pricing
          </h3>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div>
              <label className="text-xs text-slate-500">Regular Price</label>
              <input
                type="number"
                min={1}
                value={regularPrice}
                onChange={(event) =>
                  setRegularPrice(event.target.value === "" ? "" : Number(event.target.value))
                }
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="text-xs text-slate-500">Sale Price (optional)</label>
              <input
                type="number"
                min={1}
                value={salePrice}
                onChange={(event) =>
                  setSalePrice(event.target.value === "" ? "" : Number(event.target.value))
                }
                placeholder="Enter sale price"
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          </div>

          {priceInvalid && (
            <p className="inline-block rounded border border-red-200 bg-red-50 p-2 text-xs text-red-600">
              Enter valid pricing. Sale price must be less than regular price.
            </p>
          )}
        </div>

        <div className="space-y-2 rounded-lg border border-slate-200 p-3">
          <h3 className="text-sm font-semibold text-slate-900">Visibility</h3>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div>
              <label className="text-xs text-slate-500">Status</label>
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value as "AVAILABLE" | "DISABLED")}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="AVAILABLE">Available</option>
                <option value="DISABLED">Disabled</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-500">Offer Message (optional)</label>
              <input
                type="text"
                value={discountText}
                maxLength={25}
                onChange={(event) => setDiscountText(event.target.value)}
                placeholder="e.g. Limited Time"
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="mt-2 border-t border-slate-200 pt-2">
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="rounded-md border border-neutral-200 px-3 py-2 text-sm text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleCreateSlot()}
            disabled={!canSubmit}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? "Creating..." : "Create Slot"}
          </button>
        </div>
      </div>
    </div>
  );
}
