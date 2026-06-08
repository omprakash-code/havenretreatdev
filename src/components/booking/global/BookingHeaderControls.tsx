"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { Calendar, MapPin } from "@/components/icons";
import { Timer } from "lucide-react";
import BookingCalendar from "@/components/booking/location/BookingCalendar";
import { useBooking } from "@/context/BookingContext";
import { useMounted } from "@/hooks/useMounted";
import { toDateKey } from "@/lib/date";
import { useLockCountdown } from "@/hooks/booking/useLockCountdown";
import { BOOKING_ROUTES } from "@/constants/routes";

type BookingHeaderControlsProps = {
  readOnly?: boolean;
};

type LocationOption = {
  id: string;
  name: string;
  city?: string;
};

type LocationApiResponse = {
  success?: boolean;
  data?: unknown;
};

type AvailabilityApiResponse = {
  success?: boolean;
  data?: unknown;
};

type BookingByRefHeaderResponse = {
  date?: unknown;
  locationName?: unknown;
};

const DEFAULT_VENUE_TIMEZONE = "America/New_York";

function parseDateKey(dateKey: string): Date {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setHours(0, 0, 0, 0);
  return date;
}

function formatBookingDate(date: Date) {
  return date.toLocaleDateString("en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function isLocationOption(value: unknown): value is LocationOption {
  if (!value || typeof value !== "object") return false;
  const row = value as {
    id?: unknown;
    name?: unknown;
    city?: unknown;
  };

  return (
    typeof row.id === "string" &&
    typeof row.name === "string" &&
    (row.city === undefined || typeof row.city === "string")
  );
}

function isDateRow(value: unknown): value is { date: string } {
  if (!value || typeof value !== "object") return false;
  const row = value as { date?: unknown };
  return typeof row.date === "string";
}

export default function BookingHeaderControls({
  readOnly = false,
}: BookingHeaderControlsProps) {
  const mounted = useMounted();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const controlsRef = useRef<HTMLDivElement>(null);

  const {
    booking,
    setDate,
    setLocation,
  } = useBooking();

  const canEditDateAndLocation =
    pathname === BOOKING_ROUTES.ROOT || pathname === BOOKING_ROUTES.PACKAGE;
  const isSelectorLocked = readOnly || !canEditDateAndLocation;

  const [dateMenuOpen, setDateMenuOpen] = useState(false);
  const [locationMenuOpen, setLocationMenuOpen] =
    useState(false);
  const [locationOptions, setLocationOptions] =
    useState<LocationOption[]>([]);
  const [availableDateKeys, setAvailableDateKeys] =
    useState<string[]>([]);
  const [loadingLocations, setLoadingLocations] =
    useState(false);
  const [loadingDates, setLoadingDates] = useState(false);
  const [updatingSelection, setUpdatingSelection] =
    useState(false);
  const [successHeaderData, setSuccessHeaderData] =
    useState<{ date: string; locationName: string } | null>(
      null
    );

  const isSuccessPage = pathname.startsWith("/booking/success");
  const successToken = searchParams.get("t");
  const isSuccessHeaderLoading =
    isSuccessPage &&
    Boolean(successToken) &&
    !successHeaderData;

  const contextLocationLabel =
    mounted && booking.location
      ? booking.location.name
      : "Select Location";
  const contextDateLabel =
    mounted && booking.date
      ? formatBookingDate(booking.date)
      : "Select Date";

  const locationLabel =
    isSuccessPage
      ? successHeaderData?.locationName ??
        (isSuccessHeaderLoading
          ? "Loading location..."
          : contextLocationLabel)
      : contextLocationLabel;

  const dateLabel =
    isSuccessPage
      ? successHeaderData?.date ??
        (isSuccessHeaderLoading
          ? "Loading date..."
          : contextDateLabel)
      : contextDateLabel;

  const shouldHideSelectors =
    !isSuccessPage && !canEditDateAndLocation;

  const lockExpiresAt =
    booking.slot && "lockExpiresAt" in booking.slot
      ? (booking.slot as { lockExpiresAt?: string | null }).lockExpiresAt ?? null
      : null;
  const { remainingSec: lockRemainingSec, formatted: lockCountdown } =
    useLockCountdown({
      lockExpiresAt: booking.bookingId ? lockExpiresAt : null,
      warningThresholdSec: 60,
    });
  const lockToneClass =
    lockRemainingSec != null && lockRemainingSec <= 120
      ? "text-red-700 border-red-200 bg-red-50"
      : lockRemainingSec != null && lockRemainingSec <= 240
        ? "text-amber-700 border-amber-200 bg-amber-50"
        : "text-emerald-700 border-emerald-200 bg-emerald-50";

  const closeMenus = useCallback(() => {
    setDateMenuOpen(false);
    setLocationMenuOpen(false);
  }, []);

  const fetchLocationOptions = useCallback(
    async () => {
      setLoadingLocations(true);
      try {
        const res = await fetch("/api/locations", {
          credentials: "include",
        });
        const json: LocationApiResponse =
          (await res.json()) as LocationApiResponse;

        const rows =
          json.success && Array.isArray(json.data)
            ? json.data.filter(isLocationOption)
            : [];

        setLocationOptions(rows);
        return rows;
      } catch {
        setLocationOptions([]);
        return [];
      } finally {
        setLoadingLocations(false);
      }
    },
    []
  );

  const fetchDateKeysForLocation = useCallback(
    async (locationId: string) => {
      setLoadingDates(true);
      try {
        const res = await fetch(
          `/api/availability/dates?locationId=${locationId}`,
          { credentials: "include" }
        );
        const json: AvailabilityApiResponse =
          (await res.json()) as AvailabilityApiResponse;

        const keys =
          json.success && Array.isArray(json.data)
            ? json.data
                .filter(isDateRow)
                .map((row) => row.date)
            : [];

        const sortedUnique = Array.from(new Set(keys)).sort(
          (a, b) => toDateKey(a) - toDateKey(b)
        );

        setAvailableDateKeys(sortedUnique);
        return sortedUnique;
      } catch {
        setAvailableDateKeys([]);
        return [];
      } finally {
        setLoadingDates(false);
      }
    },
    []
  );

  const persistPrebooking = useCallback(
    async (location: LocationOption, date: Date) => {
      try {
        await fetch("/api/prebooking/set", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          keepalive: true,
          body: JSON.stringify({
            locationId: location.id,
            locationName: location.name,
            city: location.city,
            date: date.toISOString(),
            startTime: booking.startTime,
            endTime: booking.endTime,
            durationHours: booking.durationHours,
          }),
        });
      } catch {
        // silent fail: local state already updated
      }
    },
    [booking.durationHours, booking.endTime, booking.startTime]
  );

  const releaseBookingSession = useCallback(async () => {
    try {
      await fetch("/api/bookings/release", {
        method: "POST",
        keepalive: true,
      });
    } catch {
      // best effort; local state already changed
    }
  }, []);

  const handleDateMenuToggle = async () => {
    if (isSelectorLocked || updatingSelection) return;
    setLocationMenuOpen(false);
    const nextOpen = !dateMenuOpen;
    setDateMenuOpen(nextOpen);

    if (nextOpen && booking.location?.id) {
      await fetchDateKeysForLocation(booking.location.id);
    }
  };

  const handleLocationMenuToggle = async () => {
    if (isSelectorLocked || updatingSelection) return;
    setDateMenuOpen(false);
    const nextOpen = !locationMenuOpen;
    setLocationMenuOpen(nextOpen);

    if (nextOpen && locationOptions.length === 0) {
      await fetchLocationOptions();
    }
  };

  const handleDateSelect = useCallback(
    async (selectedDate: Date) => {
      if (!booking.location || updatingSelection) return;
      const nextDate = new Date(selectedDate);
      nextDate.setHours(0, 0, 0, 0);

      setUpdatingSelection(true);
      setDate(nextDate);
      closeMenus();
      await releaseBookingSession();
      await persistPrebooking(booking.location, nextDate);
      setUpdatingSelection(false);
    },
    [
      booking.location,
      closeMenus,
      releaseBookingSession,
      persistPrebooking,
      setDate,
      updatingSelection,
    ]
  );

  const handleLocationSelect = async (location: LocationOption) => {
    if (updatingSelection) return;

    setUpdatingSelection(true);
    const freshDateKeys = await fetchDateKeysForLocation(location.id);

    const activeKey = booking.date
      ? toDateKey(booking.date)
      : null;

    const matchedKey =
      activeKey == null
        ? undefined
        : freshDateKeys.find(
            (key) => toDateKey(key) === activeKey
          );

    const fallbackKey = matchedKey ?? freshDateKeys[0];
    const nextDate = fallbackKey
      ? parseDateKey(fallbackKey)
      : booking.date;

    setLocation(location);
    await releaseBookingSession();
    if (nextDate) {
      setDate(nextDate);
      await persistPrebooking(location, nextDate);
    }

    closeMenus();
    setUpdatingSelection(false);
  };

  useEffect(() => {
    closeMenus();
  }, [pathname, closeMenus]);

  useEffect(() => {
    const token = successToken;

    if (!isSuccessPage || !token) {
      setSuccessHeaderData(null);
      return;
    }
    const confirmedToken: string = token;

    const controller = new AbortController();

    async function loadSuccessHeaderData() {
      try {
        const res = await fetch(
          `/api/bookings/by-success-token?t=${encodeURIComponent(confirmedToken)}`,
          {
            cache: "no-store",
            signal: controller.signal,
          }
        );

        if (!res.ok) return;

        const json = (await res
          .json()
          .catch(() => null)) as BookingByRefHeaderResponse | null;

        if (
          !json ||
          typeof json.date !== "string" ||
          typeof json.locationName !== "string"
        ) {
          return;
        }

        setSuccessHeaderData({
          date: json.date,
          locationName: json.locationName,
        });
      } catch {
        // keep context fallback
      }
    }

    void loadSuccessHeaderData();

    return () => {
      controller.abort();
    };
  }, [isSuccessPage, successToken]);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (!controlsRef.current?.contains(target)) {
        closeMenus();
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeMenus();
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener(
        "mousedown",
        handlePointerDown
      );
      document.removeEventListener("keydown", handleEscape);
    };
  }, [closeMenus]);

  if (shouldHideSelectors) {
    if (!lockCountdown) return null;

    return (
      <div className="ml-auto flex items-center">
        <div
          className={`inline-flex h-8 items-center gap-0.5 rounded-full border pl-1 pr-1.5 text-xs font-semibold leading-none ${lockToneClass}`}
          aria-live="polite"
          title="Slot hold timer"
        >
          <Timer size={22} className="shrink-0 align-middle" />
          <span className="relative top-px inline-flex min-w-[10px] items-center justify-end text-right font-mono tabular-nums leading-none">
            {lockCountdown}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={controlsRef}
      className="flex items-center gap-2 md:gap-3"
    >
      <div className="relative">
        <button
          type="button"
          aria-disabled={isSelectorLocked}
          onClick={() => void handleDateMenuToggle()}
          title={
            isSelectorLocked
              ? "Date can only be changed on booking and package page"
              : booking.location
                ? "Select date"
                : "Please select location first"
          }
          className={`flex items-center gap-2 px-3 md:px-4 py-2 rounded-full border transition-colors
              ${isSelectorLocked
                ? "cursor-not-allowed border-gray-300 bg-gray-50 text-gray-700"
                : "cursor-pointer border-gray-400 hover:border-black"
            }
            `}
        >
          <Calendar size={18} />
          <span className="text-[11px] md:text-sm whitespace-nowrap">
            {dateLabel}
          </span>
        </button>
        {!isSelectorLocked && (
          <div
            onClick={(event) => {
              if (event.target === event.currentTarget) {
                setDateMenuOpen(false);
              }
            }}
            className={`absolute right-0 top-full z-40 mt-2 transform-gpu transition-all duration-200 ease-out motion-reduce:transition-none
              max-md:fixed max-md:inset-0 max-md:mt-0 max-md:flex max-md:items-center max-md:justify-center max-md:bg-black/25 max-md:px-3 max-md:backdrop-blur-[1px]
              ${dateMenuOpen
                ? "opacity-100 pointer-events-auto md:translate-y-0 md:scale-100 max-md:scale-100"
                : "opacity-0 pointer-events-none md:-translate-y-1 md:scale-95 max-md:scale-95"
              }`}
          >
            {!booking.location ? (
              <div className="w-72 rounded-xl border border-gray-200 bg-white p-3 shadow-lg max-md:w-full max-md:max-w-[360px]">
                <p className="text-xs text-gray-500">
                  Select location first
                </p>
              </div>
            ) : loadingDates ? (
              <div className="w-72 rounded-xl border border-gray-200 bg-white p-3 shadow-lg max-md:w-full max-md:max-w-[360px]">
                <p className="text-xs text-gray-500">
                  Loading available dates...
                </p>
              </div>
            ) : (
              <BookingCalendar
                variant="inline"
                availableDates={availableDateKeys}
                selectedDate={booking.date}
                timezone={DEFAULT_VENUE_TIMEZONE}
                onSelect={(date) => void handleDateSelect(date)}
                onClose={() => setDateMenuOpen(false)}
              />
            )}
          </div>
        )}
      </div>

      <div className="relative">
        <button
          type="button"
          aria-disabled={isSelectorLocked}
          onClick={() => void handleLocationMenuToggle()}
          title={
            isSelectorLocked
              ? "Location can only be changed on booking and package page"
              : "Select location"
          }
          className={`flex items-center gap-2 px-3 md:px-4 py-2 rounded-full border transition-colors
              ${isSelectorLocked
                ? "cursor-not-allowed border-gray-300 bg-gray-50 text-gray-700"
                : "cursor-pointer border-gray-400 hover:border-black"
            }
            `}
        >
          <MapPin size={18} />
          <span className="text-[11px] md:text-sm whitespace-nowrap max-w-[90px] md:max-w-none truncate">
            {locationLabel}
          </span>
        </button>
        {!isSelectorLocked && (
          <div
            onClick={(event) => {
              if (event.target === event.currentTarget) {
                setLocationMenuOpen(false);
              }
            }}
            className={`absolute right-0 top-full z-40 mt-2 transform-gpu transition-all duration-200 ease-out motion-reduce:transition-none
              max-md:fixed max-md:inset-0 max-md:mt-0 max-md:flex max-md:items-center max-md:justify-center max-md:bg-black/25 max-md:px-3 max-md:backdrop-blur-[1px]
              ${locationMenuOpen
                ? "opacity-100 pointer-events-auto md:translate-y-0 md:scale-100 max-md:scale-100"
                : "opacity-0 pointer-events-none md:-translate-y-1 md:scale-95 max-md:scale-95"
              }`}
          >
            <div className="w-72 rounded-2xl border border-gray-200/90 bg-white p-2.5 max-md:w-full max-md:max-w-[360px]">
              <p className="px-2 pb-1.5 pt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-500">
                Choose Location
              </p>
              {loadingLocations ? (
                <p className="px-2 py-2 text-xs text-gray-500">
                  Loading locations...
                </p>
              ) : locationOptions.length === 0 ? (
                <p className="px-2 py-2 text-xs text-gray-500">
                  No locations available.
                </p>
              ) : (
                <div className="max-h-64 space-y-1 overflow-auto">
                  {locationOptions.map((location) => {
                    const isSelected =
                      booking.location?.id === location.id;

                    return (
                      <button
                        key={location.id}
                        type="button"
                        onClick={() =>
                          void handleLocationSelect(location)
                        }
                        className={`w-full rounded-xl border px-3 py-2.5 text-left text-sm transition-all duration-200
                              ${isSelected
                            ? "border-[#FFD700]/35 bg-[#FFD700]/8 text-gray-900"
                            : "border-transparent bg-white text-black hover:border-gray-200 hover:bg-gray-50"
                          }`}
                      >
                        <span className="font-semibold">
                          {location.name}
                        </span>
                        {location.city && (
                          <span
                            className={`ml-2 text-xs ${isSelected
                              ? "text-gray-600"
                              : "text-gray-500"
                              }`}
                          >
                            {location.city}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
