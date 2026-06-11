"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { MapPin } from "@/components/icons";
import BookingCalendar from "@/components/booking/location/BookingCalendar";
import BookingHeroCard from "@/components/booking/location/BookingHeroCard";
import DateSelector from "@/components/booking/location/DateSelector";
import TimeRangePicker, {
  type UnavailableTimeRange,
} from "@/components/booking/time-range/TimeRangePicker";
import { useBooking } from "@/context/BookingContext";
import {
  addDaysToDateKey,
  dateFromDateKey,
  getDateKeyInTimeZone,
  toDateKey,
  toDateKeyString,
} from "@/lib/date";

type Props = {
  onContinue: () => void;
  selectedPackageName?: string;
  selectedPackageBasePrice?: number;
  selectedHourlyRate?: number;
  continueLabel?: string;
  continueDisabled?: boolean;
};

type Location = {
  id: string;
  name: string;
  city?: string;
};

const DEFAULT_VENUE_TIMEZONE = "America/New_York";

function getWeekdayShort(date: Date): string {
  return date.toLocaleDateString("en-US", {
    weekday: "short",
  });
}


export default function SelectLocationScreen({ onContinue, selectedPackageName, selectedPackageBasePrice, selectedHourlyRate, continueLabel, continueDisabled }: Props) {
  const {
    booking,
    setDate,
    setLocation,
    setTimeRange,
    minimumBookingDurationHours,
    extraHourlyRate,
    openCalendar,
    setOpenCalendar,
    hydrated,
  } = useBooking();

  /* -----------------------------
     UI-only social proof
  ------------------------------ */
  const [peopleCount, setPeopleCount] = useState(42);

  /* -----------------------------
     API data
  ------------------------------ */
  const [locations, setLocations] = useState<Location[]>([]);
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [unavailableRanges, setUnavailableRanges] = useState<UnavailableTimeRange[]>([]);
  const [rangeSettings, setRangeSettings] = useState<{
    businessOpenTime: string;
    businessCloseTime: string;
    minimumDurationMinutes: number;
    timezone: string;
  } | null>(null);
  const [datesLoading, setDatesLoading] = useState(false);
  const [lowestPackageRate, setLowestPackageRate] = useState<number | null>(null);

  // When a range booking's eventPackage.locationId is null in the DB, booking.location
  // synthesises to null even though we have an active session. Fall back to locations[0]
  // so the dates fetch and UI don't get stuck disabled.
  const effectiveLocationId =
    booking.location?.id ??
    (booking.bookingId && locations.length > 0 ? locations[0].id : undefined);

  const noSlotsForLocation = Boolean(effectiveLocationId) && !datesLoading && availableDates.length === 0;
  const venueTimezone = rangeSettings?.timezone ?? DEFAULT_VENUE_TIMEZONE;

  const releaseBookingSession = useCallback(async () => {
    try {
      await fetch("/api/bookings/release", {
        method: "POST",
        keepalive: true,
      });
    } catch {
      // best effort; local state still updates
    }
  }, []);

  const persistPrebooking = useCallback(
    async (location: Location, date: Date) => {
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
          }),
        });
      } catch {
        // best effort; local state still updates
      }
    },
    []
  );


  /* -----------------------------
     Fetch locations
  ------------------------------ */
  useEffect(() => {
    async function fetchLocations() {
      const res = await fetch("/api/locations");
      const json = await res.json();
      if (json.success) {
        setLocations(json.data);
      }
    }

    fetchLocations();
  }, []);


  useEffect(() => {
    fetch("/api/packages")
      .then((r) => r.json())
      .then((json) => {
        if (json.success && Array.isArray(json.data)) {
          const rates: number[] = json.data
            .map((p: { hourlyRate?: number }) => p.hourlyRate)
            .filter((r: unknown): r is number => typeof r === "number" && r > 0);
          if (rates.length > 0) setLowestPackageRate(Math.min(...rates));
        }
      })
      .catch(() => {});
  }, []);

  /* -------------------------------------
   Auto select first location (ONLY ONCE)
   -------------------------------------- */
  useEffect(() => {
    // Don't auto-select location if there is already an active booking session —
    // calling setLocation resets package + bookingId and would wipe the session.
    if (booking.bookingId) return;
    if (!booking.location && locations.length > 0) {
      setLocation(locations[0]);
    }
  }, [locations, booking.location, setLocation, booking.bookingId]);


  /* -------------------------------------
     Fetch available dates (per location)
  --------------------------------------- */
  useEffect(() => {
    const locationId = effectiveLocationId;
    if (!locationId) return;

    let cancelled = false;

    async function fetchAvailableDates() {
      setDatesLoading(true);
      try {
        const res = await fetch(
          `/api/availability/dates?locationId=${locationId}`
        );
        const json = await res.json();

        if (!cancelled && json.success) {
          setAvailableDates(json.data.map((d: { date: string }) => d.date));
        }
      } catch {
        if (!cancelled) setAvailableDates([]);
      } finally {
        if (!cancelled) setDatesLoading(false);
      }
    }

    fetchAvailableDates();

    return () => {
      cancelled = true;
    };
  }, [effectiveLocationId]);

  /* -------------------------------------
     Fetch unavailable ranges for selected date
  --------------------------------------- */
  useEffect(() => {
    const locationId = effectiveLocationId;
    const date = booking.date;
    if (!locationId || !date) {
      setUnavailableRanges([]);
      return;
    }

    let cancelled = false;
    const selectedLocationId = locationId;
    const dateKey = toDateKeyString(date);

    async function fetchUnavailableRanges() {
      try {
        const res = await fetch(
          `/api/availability/time-ranges?locationId=${encodeURIComponent(
            selectedLocationId
          )}&date=${encodeURIComponent(dateKey)}`,
          { cache: "no-store" }
        );
        const json = await res.json();
        if (!cancelled && json.success) {
          setUnavailableRanges(json.data ?? []);
          const settings = json.theatres?.[0];
          setRangeSettings(
            settings
              ? {
                  businessOpenTime: settings.businessOpenTime,
                  businessCloseTime: settings.businessCloseTime,
                  minimumDurationMinutes: settings.minimumDurationMinutes,
                  timezone: settings.timezone,
                }
              : null
          );
        }
      } catch {
        if (!cancelled) {
          setUnavailableRanges([]);
          setRangeSettings(null);
        }
      }
    }

    void fetchUnavailableRanges();

    return () => {
      cancelled = true;
    };
  }, [effectiveLocationId, booking.date]);

  useEffect(() => {
    // If the user already has an active booking lock, don't clear their time range —
    // the availability response will list their own lock as "LOCKED", which would
    // otherwise incorrectly invalidate the selection they just confirmed.
    if (booking.bookingId) return;
    if (!booking.startTime || !booking.endTime || unavailableRanges.length === 0) {
      return;
    }

    const overlapsUnavailable = unavailableRanges.some(
      (range) =>
        range.startTime < booking.endTime! && range.endTime > booking.startTime!
    );

    if (overlapsUnavailable) {
      setTimeRange(null, null);
    }
  }, [booking.bookingId, booking.endTime, booking.startTime, setTimeRange, unavailableRanges]);

  /* -------------------------------------
   Auto Select first date on first loading
  -------------------------------------- */

  useEffect(() => {
    // Don't auto-select date if there is already an active booking session —
    // calling setDate resets package + bookingId and would wipe the session.
    if (booking.bookingId) return;
    if (!booking.location || datesLoading || booking.date || availableDates.length === 0) return;

    const todayKey = toDateKey(getDateKeyInTimeZone(new Date(), venueTimezone));

    const firstValid = availableDates
      .map((d) => dateFromDateKey(d))
      .find((d) => toDateKey(d) >= todayKey);

    if (firstValid) {
      setDate(firstValid);
      void persistPrebooking(booking.location, firstValid);
    }
  }, [availableDates, datesLoading, booking.location, booking.date, setDate, persistPrebooking, venueTimezone, booking.bookingId]);



  const pickerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    pickerRef.current?.scrollIntoView({ behavior: "instant", block: "center" });
  }, []);

  /* -----------------------------
     People count animation
  ------------------------------ */
  useEffect(() => {
    const timer = setInterval(() => {
      const base = [45, 48, 55, 40, 38, 47, 52, 60];
      const randomBase = base[Math.floor(Math.random() * base.length)];
      const jitter = Math.floor(Math.random() * 4) - 2;
      setPeopleCount(randomBase + jitter);
    }, 2500);

    return () => clearInterval(timer);
  }, []);

  /* -----------------------------
     Helpers
  ------------------------------ */
  const activeIndex = locations.findIndex(
    (loc) => loc.id === booking.location?.id
  );

  const effectiveHourlyRate =
    selectedHourlyRate ||
    booking.package?.hourlyRate ||
    lowestPackageRate ||
    extraHourlyRate;
  const packageBasePrice =
    selectedPackageBasePrice ??
    booking.package?.basePrice ??
    0;
  const packageTitle =
    selectedPackageName ||
    booking.package?.name ||
    null;
  const isExactRate = Boolean(selectedHourlyRate || booking.package?.hourlyRate);
  const formatCurrency = (v: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(v);

  const quickDates = [
    { label: "Today", offset: 0 },
    { label: "Tomorrow", offset: 1 },
    { label: null, offset: 2 },
    { label: null, offset: 3 },
  ];

  const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  const isQuickDate = (date: Date) =>
    quickDates.some((d) => {
      const quick = dateFromDateKey(
        addDaysToDateKey(getDateKeyInTimeZone(new Date(), venueTimezone), d.offset)
      );
      return isSameDay(quick, date);
    });

  /* -----------------------------
     Handlers
  ------------------------------ */
  const handleQuickDateSelect = (offset: number) => {
    const date = dateFromDateKey(
      addDaysToDateKey(getDateKeyInTimeZone(new Date(), venueTimezone), offset)
    );

    const isAvailable = availableDates.some(
      (d) => toDateKey(d) === toDateKey(date)
    );
    if (!isAvailable) return;

    setDate(date);
    setOpenCalendar(false);
    const loc = booking.location ?? (locations.length > 0 ? locations[0] : null);
    if (loc) {
      void (async () => {
        await releaseBookingSession();
        await persistPrebooking(loc, date);
      })();
    }
  };


  const handleLocationSelect = (location: Location) => {
    setLocation(location);
    setAvailableDates([]);

    // Preserve date if already selected
    if (booking.date) {
      const nextDate = new Date(booking.date);
      nextDate.setHours(0, 0, 0, 0);
      setDate(nextDate);
      void (async () => {
        await releaseBookingSession();
        await persistPrebooking(location, nextDate);
      })();
    }
  };

  const canContinue = Boolean(
    effectiveLocationId &&
      booking.date &&
      booking.startTime &&
      booking.endTime &&
      booking.durationHours
  );
  const showLocationSelector = false;

  /* -----------------------------
     Render
  ------------------------------ */
  return (
    <section className="relative flex min-h-[calc(100dvh-120px)] items-center justify-center overflow-hidden bg-[#f6f8f7] px-3 py-6 sm:px-4 sm:py-8 lg:min-h-[calc(100vh-160px)] lg:py-10">
      {/* Background */}
      <div className="absolute inset-0 z-1">
        <Image
          src="/media/booking/location/booking-bg-2.jpg"
          alt="Event booking background"
          fill
          sizes="100vw"
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-[linear-gradient(120deg,rgba(8,26,25,0.78),rgba(12,35,33,0.38)_48%,rgba(255,255,255,0.18))]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.1),rgba(3,18,17,0.28)_72%)]" />
      </div>

      <BookingHeroCard
        title={packageTitle ?? "Your Private Retreat"}
        subtitle={booking.location?.name ?? "Miami"}
        rateLabel={
          <>
            {packageBasePrice > 0 ? (
              <>
                <p className="text-2xl font-bold leading-none tracking-[-0.05em] text-[#101828]">
                  {formatCurrency(packageBasePrice)}
                </p>
                <p className="mt-0.5 text-[10px] font-medium text-[#667085]">
                  Package price
                </p>
              </>
            ) : (
              <>
                {!isExactRate && (
                  <p className="mb-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[#347f7c]">
                    Starting at
                  </p>
                )}
                <p className="text-2xl font-bold leading-none tracking-[-0.05em] text-[#101828]">
                  {formatCurrency(effectiveHourlyRate)}
                  <span className="ml-1 text-sm font-medium tracking-normal text-[#101828]">
                    /hr
                  </span>
                </p>
              </>
            )}
            <p className="mt-1.5 text-[9px] font-bold uppercase tracking-[0.12em] text-[#101828]">
              {formatCurrency(effectiveHourlyRate)}/hr &nbsp;·&nbsp; {minimumBookingDurationHours}{" "}
              {minimumBookingDurationHours === 1 ? "hr" : "hrs"} min
            </p>
          </>
        }
      >
        {/* Location Toggle */}
        {showLocationSelector && locations.length > 0 && (
          <div className="mx-auto mb-5 w-full max-w-[430px] sm:mb-6">
            <p className="mb-2 text-center text-[0.68rem] font-bold uppercase tracking-[0.22em] text-[#347f7c]">
              Select Location
            </p>
            <div className="relative h-[54px] overflow-hidden bg-[#f5faf8] p-1 shadow-inner ring-1 ring-[#d7e4e1] sm:h-[50px]">
              <div
                className="absolute left-1 top-1 h-[calc(100%-8px)] bg-white shadow-[0_10px_22px_rgba(16,24,40,0.12)] ring-1 ring-[#2f7e7a]/15 transition-transform duration-300"
                style={{
                  width: `calc(${100 / locations.length}% - 8px)`,
                  transform:
                    activeIndex >= 0
                      ? `translateX(calc(${activeIndex * 100}% + ${activeIndex * 8}px))`
                      : "translateX(0)",
                }}
              />

              <div className="relative z-10 flex h-full">
                {locations.map((loc) => (
                  <button
                    key={loc.id}
                    type="button"
                    onClick={() => handleLocationSelect(loc)}
                    className="flex flex-1 items-center justify-center gap-1.5 truncate px-2 text-[11px] font-bold text-[#1f2937] transition hover:text-[#245e5b] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#347f7c] sm:text-xs md:text-sm"
                  >
                    <MapPin size={14} />
                    {loc.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        <div ref={pickerRef} className="space-y-5">
          <DateSelector
            datesLoading={datesLoading || !hydrated}
            noSlotsForLocation={noSlotsForLocation}
            hasLocation={Boolean(effectiveLocationId)}
            selectedDate={booking.date}
            availableDates={availableDates}
            quickDates={quickDates}
            onQuickDateSelect={handleQuickDateSelect}
            onOpenCalendar={() => {
              if (effectiveLocationId) {
                setOpenCalendar(true);
              }
            }}
            isQuickDate={isQuickDate}
            isSameDay={isSameDay}
            getWeekdayShort={getWeekdayShort}
            timezone={venueTimezone}
          />

          {/* Calendar Modal */}
          {openCalendar && effectiveLocationId && (
            <BookingCalendar
              availableDates={availableDates}
              selectedDate={booking.date}
              timezone={venueTimezone}
              onSelect={(date) => {
                const d = new Date(date);
                d.setHours(0, 0, 0, 0);
                setDate(d);
                setOpenCalendar(false);
                const loc = booking.location ?? (locations.length > 0 ? locations[0] : null);
                if (loc) {
                  void (async () => {
                    await releaseBookingSession();
                    await persistPrebooking(loc, d);
                  })();
                }
              }}
              onClose={() => setOpenCalendar(false)}
            />
          )}

          <TimeRangePicker
            startTime={booking.startTime}
            endTime={booking.endTime}
            minDurationHours={
              rangeSettings
                ? rangeSettings.minimumDurationMinutes / 60
                : minimumBookingDurationHours
            }
            onChange={setTimeRange}
            disabled={!booking.date}
            selectedDate={booking.date}
            unavailableRanges={unavailableRanges}
            businessOpenTime={rangeSettings?.businessOpenTime}
            businessCloseTime={rangeSettings?.businessCloseTime}
            timezone={rangeSettings?.timezone}
          />
        </div>

        {/* Footer */}
        <div className="mt-10 flex flex-col items-stretch justify-between gap-4 border-t border-[#d7e4e1] pt-4 md:flex-row md:items-center">
          <div className="order-2 text-center md:order-1 md:text-left">
            <p className="text-[11px] font-medium leading-4 text-gray-600">
              Secure reservation <span className="text-[#245e5b]">•</span>{" "}
              Instant booking confirmation
            </p>
            <p className="mt-1 text-[11px] font-medium text-[#667085]">
              Flexible rescheduling <span className="text-[#c5d6d2]">•</span>{" "}
              {peopleCount} checking availability
            </p>
          </div>

          <button
            type="button"
            onClick={onContinue}
            disabled={!canContinue || continueDisabled}
            className="order-1 inline-flex min-h-11 w-full min-w-[190px] items-center justify-center gap-2 rounded-full bg-[#0d3b24] px-6 py-3 text-sm font-bold text-white shadow-[0_16px_34px_rgba(13,59,36,0.28)] transition duration-300 ease-out hover:-translate-y-0.5 hover:bg-[#092c1b] hover:shadow-[0_20px_44px_rgba(13,59,36,0.32)] active:translate-y-0 active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-500 disabled:shadow-none disabled:hover:translate-y-0 md:order-2 md:w-auto"
          >
            <span>{continueLabel ?? "Continue to Packages"}</span>
          </button>
        </div>
      </BookingHeroCard>
    </section>
  );
}
