"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useBooking } from "@/context/BookingContext";
import TheatreCard from "./TheatreCard";
import type { Theatre } from "@/types/theatre";
import type { Location as BookingLocation } from "@/context/BookingContext";
import { formatInTimeZone } from "date-fns-tz";
import { BOOKING_ROUTES } from "@/constants/routes";
import { AlertTriangle, Calendar } from "@/components/icons";
import { addDays } from "@/lib/date";
import { toast } from "sonner";

const IST_TIMEZONE = "Asia/Kolkata";

export default function TheatreList() {
  const { booking, hydrated, setDate } = useBooking();
  const router = useRouter();

  const [theatres, setTheatres] = useState<Theatre[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [nextDaySlotCounts, setNextDaySlotCounts] =
    useState<Record<string, number>>({});
  const [changingDate, setChangingDate] = useState(false);

  useEffect(() => {
    if (!hydrated) return;

    const location = booking.location;
    const date = booking.date;

    if (!location || !date) {
      setLoading(false);
      setLoadError(null);
      setNextDaySlotCounts({});
      router.replace(BOOKING_ROUTES.ROOT);
      return;
    }

    void fetchTheatres(location, date);
    void fetchNextDaySlotCounts(location.id, date);
  }, [hydrated, booking.location, booking.date, router]);

  async function fetchTheatres(
    location: BookingLocation,
    date: Date
  ) {
    try {
      setLoading(true);
      setLoadError(null);

      // Convert date to IST format (not UTC)
      const dateStr = formatInTimeZone(date, IST_TIMEZONE, "yyyy-MM-dd");

      const res = await fetch(
        `/api/theatres?locationId=${location.id}&date=${dateStr}`,
        { credentials: "include" }
      );

      const json = await res.json();
      if (!res.ok || !json?.success) {
        setTheatres([]);
      setLoadError(json?.message || "Unable to load packages right now.");
        return;
      }
      setTheatres(json.data?.theatres ?? []);
    } catch (error) {
      console.error("THEATRE FETCH ERROR:", error);
      setTheatres([]);
      setLoadError("Unable to load packages right now. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function fetchNextDaySlotCounts(
    locationId: string,
    selectedDate: Date
  ) {
    try {
      const nextDate = addDays(selectedDate, 1);
      nextDate.setHours(0, 0, 0, 0);
      const dateStr = formatInTimeZone(nextDate, IST_TIMEZONE, "yyyy-MM-dd");

      const res = await fetch(
        `/api/theatres/available-counts?locationId=${locationId}&date=${dateStr}`,
        { credentials: "include" }
      );
      const json = await res.json().catch(() => null);
      const nextCounts =
        json?.success &&
        json?.data &&
        typeof json.data === "object" &&
        json.data.counts &&
        typeof json.data.counts === "object"
          ? (json.data.counts as Record<string, number>)
          : {};

      setNextDaySlotCounts(nextCounts);
    } catch {
      setNextDaySlotCounts({});
    }
  }

  async function handleNextDayClick(theatreId: string) {
    if (!booking.location || !booking.date || changingDate) return;
    const nextDayCount = nextDaySlotCounts[theatreId] ?? 0;
    if (nextDayCount <= 0) return;

    const nextDate = addDays(booking.date, 1);
    nextDate.setHours(0, 0, 0, 0);
    const nextDateLabel = formatInTimeZone(nextDate, IST_TIMEZONE, "EEE, dd MMM");
    const slotLabel = `${nextDayCount} slot${nextDayCount === 1 ? "" : "s"}`;

    setChangingDate(true);
    setDate(nextDate);
    toast.success(`Date changed to ${nextDateLabel}`, {
      id: "theatre-next-day-updated",
      description: `Showing ${slotLabel} for this package.`,
    });

    try {
      await fetch("/api/bookings/release", {
        method: "POST",
        keepalive: true,
      });

      await fetch("/api/prebooking/set", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        keepalive: true,
        body: JSON.stringify({
          locationId: booking.location.id,
          locationName: booking.location.name,
          city: booking.location.city,
          date: nextDate.toISOString(),
        }),
      });
    } catch {
      // local booking context already updated
    } finally {
      setChangingDate(false);
    }
  }

  function handleRetry() {
    if (!booking.location || !booking.date) return;
    void fetchTheatres(booking.location, booking.date);
  }

  /* ---------------- Skeleton Loader ---------------- */

  if (loading) {
    return (
      <section className="bg-white px-3.5 py-8 pb-24 sm:px-4 sm:py-10 md:px-6 lg:py-14 lg:pb-14">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <TheatreSkeleton key={i} />
            ))}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="bg-white px-3.5 py-8 pb-10 sm:px-4 sm:py-10 md:px-6 lg:py-14 lg:pb-20">
      <div className="max-w-7xl mx-auto">
        {/* Heading */}
        <div className="mb-8 text-center sm:mb-10 lg:mb-14">
          <h2 className="mb-2 text-2xl font-bold text-black sm:text-3xl lg:mb-3 lg:text-4xl">
            Event Packages Designed Around Your Celebration
          </h2>
          <p className="mx-auto max-w-2xl text-sm text-gray-500 sm:text-base lg:text-lg">
            Flexible options for intimate gatherings, styled celebrations, and personalized setups based on your event needs.
          </p>
        </div>

        {/* Error state */}
        {!loading && loadError && (
          <div className="mx-auto max-w-xl rounded-2xl border border-red-200 bg-red-50 p-6 text-center sm:p-8">
            <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-red-100 text-red-600">
              <AlertTriangle size={18} />
            </div>
            <h3 className="text-base font-semibold text-red-800 sm:text-lg">
              Couldn&apos;t load packages
            </h3>
            <p className="mt-1 text-sm text-red-700">{loadError}</p>
            <button
              type="button"
              onClick={handleRetry}
              className="mt-4 inline-flex cursor-pointer items-center justify-center rounded-full border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 transition hover:bg-red-100"
            >
              Retry
            </button>
          </div>
        )}

        {/* Empty state */}
        {!loading && !loadError && theatres.length === 0 && (
          <div className="mx-auto max-w-xl rounded-2xl border border-slate-200 bg-slate-50 p-6 text-center sm:p-8">
            <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-slate-200 text-slate-700">
              <Calendar size={18} />
            </div>
            <h3 className="text-base font-semibold text-slate-900 sm:text-lg">
              No packages available for this date
            </h3>
            <p className="mt-1 text-sm text-slate-600">
              Try a different date or location to see available packages.
            </p>
            <button
              type="button"
              onClick={() => router.push(BOOKING_ROUTES.ROOT)}
              className="mt-4 inline-flex cursor-pointer items-center justify-center rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 transition hover:bg-slate-100"
            >
              Change Date or Location
            </button>
          </div>
        )}

        {/* Cards */}
        {!loadError && theatres.length > 0 && (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            {theatres.map((theatre) => (
              <TheatreCard
                key={theatre.id}
                theatre={theatre}
                onNextDayClick={() => {
                  void handleNextDayClick(theatre.id);
                }}
                nextDayCount={nextDaySlotCounts[theatre.id] ?? 0}
                hasNextDay={(nextDaySlotCounts[theatre.id] ?? 0) > 0}
                changingDate={changingDate}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

/* ---------------- Skeleton Card ---------------- */

function TheatreSkeleton() {
  return (
    <div className="relative rounded-2xl border border-gray-200 overflow-hidden bg-white">
      {/* Shimmer overlay */}
      <div className="absolute inset-0 animate-shimmer bg-gradient-to-r from-transparent via-gray-200/60 to-transparent" />
      <div className="h-44 bg-gray-100 sm:h-48" />
      <div className="space-y-3 p-4 sm:space-y-4 sm:p-5">
        <div className="h-5 bg-gray-200 rounded w-3/4" />
        <div className="h-4 bg-gray-200 rounded w-1/2" />
        <div className="mt-4 h-10 rounded bg-gray-300 sm:mt-6" />
      </div>
    </div>
  );
}
