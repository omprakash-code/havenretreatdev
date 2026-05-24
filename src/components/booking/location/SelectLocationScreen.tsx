"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { Calendar, MapPin } from "@/components/icons";
import BookingCalendar from "@/components/booking/location/BookingCalendar";
import TimeRangePicker from "@/components/booking/time-range/TimeRangePicker";
import { useBooking } from "@/context/BookingContext";
import { toDateKey } from "@/lib/date";
import { formatISTDate } from "@/lib/formatters";

type Props = {
  onContinue: () => void;
};

type Location = {
  id: string;
  name: string;
  city?: string;
};

function getISTWeekdayShort(date: Date): string {
  return date.toLocaleDateString("en-IN", {
    weekday: "short",
    timeZone: "Asia/Kolkata",
  });
}


export default function SelectLocationScreen({ onContinue }: Props) {
  const {
    booking,
    setDate,
    setLocation,
    setTimeRange,
    minimumBookingDurationHours,
    openCalendar,
    setOpenCalendar,
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
  const [datesLoading, setDatesLoading] = useState(false);
  const noSlotsForLocation = booking.location && !datesLoading && availableDates.length === 0;

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


  /* -------------------------------------
   Auto select first location (ONLY ONCE)
   -------------------------------------- */
  useEffect(() => {
    if (!booking.location && locations.length > 0) {
      setLocation(locations[0]);
    }
  }, [locations, booking.location, setLocation]);


  /* -------------------------------------
     Fetch available dates (per location)
  --------------------------------------- */
  useEffect(() => {
    const locationId = booking.location?.id;
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
  }, [booking.location]);

  /* -------------------------------------
   Auto Select first date on first loading
  -------------------------------------- */

  useEffect(() => {
    if (!booking.location || datesLoading || booking.date || availableDates.length === 0) return;

    const todayKey = toDateKey(new Date());


    const firstValid = availableDates
      .map((d) => new Date(d))
      .find((d) => toDateKey(d) >= todayKey);

    if (firstValid) {
      setDate(firstValid);
      void persistPrebooking(booking.location, firstValid);
    }
  }, [availableDates, datesLoading, booking.location, booking.date, setDate, persistPrebooking]);



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
      const quick = new Date();
      quick.setDate(quick.getDate() + d.offset);
      return isSameDay(quick, date);
    });

  /* -----------------------------
     Handlers
  ------------------------------ */
  const handleQuickDateSelect = (offset: number) => {
    const date = new Date();
    date.setDate(date.getDate() + offset);
    date.setHours(0, 0, 0, 0);

    const isAvailable = availableDates.some(
      (d) => toDateKey(d) === toDateKey(date)
    );
    if (!isAvailable) return;

    setDate(date);
    setOpenCalendar(false);
    if (booking.location) {
      const location = booking.location;
      void (async () => {
        await releaseBookingSession();
        await persistPrebooking(location, date);
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
    booking.location &&
      booking.date &&
      booking.startTime &&
      booking.endTime &&
      booking.durationHours
  );

  /* -----------------------------
     Render
  ------------------------------ */
  return (
    <section className="relative flex min-h-[calc(100dvh-120px)] items-center justify-center bg-[#f6f8f7] px-1 py-3 sm:px-4 sm:py-4 lg:min-h-[calc(100vh-160px)] lg:py-0">
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
      </div>

      <div className="relative z-2 w-full max-w-[42rem] border border-[#2f7e7a]/25 bg-white/92 p-3.5 shadow-xl backdrop-blur-md sm:p-4 md:p-5 lg:p-6 lg:px-10">
        {/* Heading */}
        <div className="mb-4 text-center sm:mb-5 lg:mb-6">
          <h1 className="mb-1 text-xl font-bold text-[#1f2937] sm:text-2xl lg:text-3xl">
            Select Location, Date & Time
          </h1>
          <p className="text-sm text-gray-600 sm:text-base">
            Choose where and when you want to celebrate
          </p>
        </div>

        {/* Location Toggle */}
        {locations.length > 0 && (
          <div className="mx-auto mb-4 w-full max-w-[390px] sm:mb-5 sm:max-w-[412px]">
            <div className="relative h-[55px] overflow-hidden border border-[#d7e4e1] bg-[#f8fbfa] sm:h-[46px]">
              <div
                className="absolute left-[3.5px] top-[3.5px] h-[calc(100%-7px)] border border-[#2f7e7a]/20 bg-[#edf3f1] transition-transform duration-300"
                style={{
                  width: `calc(${100 / locations.length}% - 7px)`,
                  transform:
                    activeIndex >= 0
                      ? `translateX(calc(${activeIndex * 100}% + ${activeIndex * 7}px))`
                      : "translateX(0)",
                }}
              />

              <div className="relative z-10 flex h-full">
                {locations.map((loc) => (
                  <button
                    key={loc.id}
                    onClick={() => handleLocationSelect(loc)}
                    className="flex flex-1 items-center justify-center gap-1 truncate px-2 text-[11px] font-semibold text-[#1f2937] transition hover:text-[#245e5b] sm:text-xs md:text-sm"
                  >
                    <MapPin size={14} />
                    {loc.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Quick Dates + More (Mobile) */}
        <div className="mb-4 sm:hidden">
          <div className="grid grid-cols-4 gap-2">
            {datesLoading
              ? Array.from({ length: quickDates.length }).map((_, i) => (
                <DateSkeleton key={`mobile-skeleton-${i}`} />
              ))
              : quickDates.map((d) => {
                const date = new Date();
                date.setHours(0, 0, 0, 0);
                date.setDate(date.getDate() + d.offset);

                const label =
                  d.offset <= 1
                    ? d.label
                    : getISTWeekdayShort(date);

                const isActive =
                  booking.date &&
                  isSameDay(date, booking.date);

                const isDisabled =
                  datesLoading ||
                  !booking.location ||
                  !availableDates.some(
                    (availableDate) => toDateKey(availableDate) === toDateKey(date)
                  );

                return (
                  <button
                    key={`mobile-quick-${d.offset}`}
                    disabled={isDisabled}
                    onClick={() => handleQuickDateSelect(d.offset)}
                    className={`min-h-[52px] w-full border px-2 py-1.5 transition-all duration-300 ${
                      datesLoading
                        ? "opacity-40 scale-95 cursor-wait"
                        : noSlotsForLocation
                          ? "border-[#d7e4e1] bg-[#f8fbfa] text-gray-400 cursor-not-allowed"
                          : isActive
                            ? "border-[#347f7c] bg-[#347f7c] text-white scale-100 cursor-pointer"
                            : "border-[#d7e4e1] bg-white text-[#1f2937] hover:bg-[#f8fbfa] hover:scale-[1.02] cursor-pointer"
                    }`}
                    title={
                      noSlotsForLocation
                        ? "No slots available for this location"
                        : undefined
                    }
                  >
                    <p className="text-[11px] font-medium leading-tight">{label}</p>
                    <p className="text-[14px] font-bold leading-tight">
                      {formatISTDate(date).replace(/ \d{4}$/, "")}
                    </p>
                  </button>
                );
              })}
          </div>

          {!datesLoading && (
            <div className="mt-2 flex justify-center">
              <button
                disabled={!booking.location}
                onClick={() => {
                  if (booking.location) {
                    setOpenCalendar(true);
                  }
                }}
                title={
                  noSlotsForLocation
                    ? "No slots available for this location"
                    : undefined
                }
                className={`min-h-[52px] min-w-[100%] border px-3 py-2 transition ${
                  !booking.location
                    ? "border-[#d7e4e1] bg-[#f8fbfa] text-gray-400 cursor-not-allowed"
                    : noSlotsForLocation
                      ? "border-[#d7e4e1] bg-[#f8fbfa] text-gray-400 cursor-not-allowed"
                      : booking.date && !isQuickDate(booking.date)
                        ? "border-[#347f7c] bg-[#edf3f1] text-[#245e5b] cursor-pointer"
                        : "border-[#d7e4e1] bg-white text-[#1f2937] cursor-pointer hover:bg-[#f8fbfa]"
                }`}
              >
                <p className="flex items-center justify-center gap-1 whitespace-nowrap text-[20px] font-semibold leading-tight">
                  <Calendar size={30} />
                  {booking.date && !isQuickDate(booking.date)
                    ? formatISTDate(booking.date).replace(/ \d{4}$/, "")
                    : "Choose More Date"}
                </p>
              </button>
            </div>
          )}
        </div>

        {/* Quick Dates + More (Tablet/Desktop) */}
        <div className="mb-4 hidden grid-cols-4 gap-2.5 sm:grid md:grid-cols-5">
          {datesLoading
            ? Array.from({ length: quickDates.length }).map((_, i) => (
              <DateSkeleton key={`desktop-skeleton-${i}`} />
            ))
            : quickDates.map((d) => {
              const date = new Date();
              date.setHours(0, 0, 0, 0);
              date.setDate(date.getDate() + d.offset);

              const label =
                d.offset <= 1
                  ? d.label
                  : getISTWeekdayShort(date);

              const isActive =
                booking.date &&
                isSameDay(date, booking.date);

              const isDisabled =
                datesLoading ||
                !booking.location ||
                !availableDates.some(
                  (availableDate) => toDateKey(availableDate) === toDateKey(date)
                );

              return (
                <button
                  key={`desktop-quick-${d.offset}`}
                  disabled={isDisabled}
                  onClick={() => handleQuickDateSelect(d.offset)}
                  className={`min-h-[56px] border px-2.5 py-1.5 md:p-2.5 transition-all duration-300 ${
                    datesLoading
                      ? "opacity-40 scale-95 cursor-wait"
                      : noSlotsForLocation
                        ? "border-[#d7e4e1] bg-[#f8fbfa] text-gray-400 cursor-not-allowed"
                        : isActive
                          ? "border-[#347f7c] bg-[#347f7c] text-white scale-100 cursor-pointer"
                          : "border-[#d7e4e1] bg-white text-[#1f2937] hover:bg-[#f8fbfa] hover:scale-[1.02] cursor-pointer"
                  }`}
                  title={
                    noSlotsForLocation
                      ? "No slots available for this location"
                      : undefined
                  }
                >
                  <p className="text-[11px] font-medium leading-tight sm:text-[12px]">{label}</p>
                  <p className="text-[13px] font-bold leading-tight sm:text-[14px] md:text-base">
                    {formatISTDate(date).replace(/ \d{4}$/, "")}
                  </p>
                </button>
              );
            })}

          <button
            disabled={!booking.location}
            onClick={() => {
              if (booking.location) {
                setOpenCalendar(true);
              }
            }}
            title={
              noSlotsForLocation
                ? "No slots available for this location"
                : undefined
            }
            className={`min-h-[56px] border px-2.5 py-1.5 md:p-2.5 transition ${
              !booking.location
                ? "border-[#d7e4e1] bg-[#f8fbfa] text-gray-400 cursor-not-allowed"
                : noSlotsForLocation
                  ? "border-[#d7e4e1] bg-[#f8fbfa] text-gray-400 cursor-not-allowed"
                  : booking.date && !isQuickDate(booking.date)
                    ? "border-[#347f7c] bg-[#edf3f1] text-[#245e5b] cursor-pointer"
                    : "border-[#d7e4e1] bg-white text-[#1f2937] cursor-pointer hover:bg-[#f8fbfa]"
            }`}
          >
            <p className="text-[11px] leading-tight sm:text-[12px]">Choose More</p>
            <p className="inline-flex items-center gap-1 text-[13px] font-bold leading-tight sm:text-[14px] md:text-base">
              <Calendar size={12} />
              {booking.date && !isQuickDate(booking.date)
                ? formatISTDate(booking.date).replace(/ \d{4}$/, "")
                : "Date"}
            </p>
          </button>
        </div>

        {/* Calendar Modal */}
        {openCalendar && booking.location && (
          <BookingCalendar
            availableDates={availableDates}
            selectedDate={booking.date}
            onSelect={(date) => {
              const d = new Date(date);
              d.setHours(0, 0, 0, 0);
              setDate(d);
              setOpenCalendar(false);
              if (booking.location) {
                const location = booking.location;
                void (async () => {
                  await releaseBookingSession();
                  await persistPrebooking(location, d);
                })();
              }
            }}
            onClose={() => setOpenCalendar(false)}
          />
        )}

        <TimeRangePicker
          startTime={booking.startTime}
          endTime={booking.endTime}
          minDurationHours={minimumBookingDurationHours}
          onChange={setTimeRange}
          disabled={!booking.date}
          selectedDate={booking.date}
        />

        {/* Footer */}
        <div className="mt-4 flex flex-col items-stretch justify-between gap-2.5 sm:gap-3 md:flex-row md:items-center">
          <p className="order-2 text-center text-xs text-gray-600 sm:text-sm md:order-1 md:text-left">
            {peopleCount} people are checking availability right now
          </p>

          <button
            type="button"
            onClick={onContinue}
            disabled={!canContinue}
            className="order-1 inline-flex w-full min-w-[132px] items-center justify-center gap-2 border border-[#347f7c] bg-[#347f7c] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#245e5b] disabled:cursor-not-allowed disabled:border-gray-300 disabled:bg-gray-200 disabled:text-gray-500 md:order-2 md:w-auto"
          >
            <span>View Available Packages</span>
          </button>
        </div>
      </div>
    </section>
  );
}

function DateSkeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`${className} min-h-[52px] border border-[#d7e4e1] bg-[#f8fbfa] px-2 py-1.5 sm:min-h-[56px] sm:px-2.5 sm:py-1.5 md:p-2.5 animate-pulse`}
    >
      <div className="mb-1.5 h-2.5 w-9 bg-[#d7e4e1]" />
      <div className="h-4 w-12 bg-[#c5d6d2]" />
    </div>
  );
}
