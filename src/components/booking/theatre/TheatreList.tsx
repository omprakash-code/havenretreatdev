"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useBooking } from "@/context/BookingContext";
import TheatreCard from "./TheatreCard";
import type { Theatre } from "@/types/theatre";
import type { Location as BookingLocation } from "@/context/BookingContext";
import { BOOKING_ROUTES } from "@/constants/routes";
import { AlertTriangle, Calendar, Clock } from "@/components/icons";
import { formatDuration, formatISTTime } from "@/lib/formatters";

export default function TheatreList() {
  const { booking, hydrated } = useBooking();
  const router = useRouter();

  const [theatres, setTheatres] = useState<Theatre[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const fetchTheatres = useCallback(async (
    location: BookingLocation
  ) => {
    try {
      setLoading(true);
      setLoadError(null);

      const res = await fetch(
        `/api/theatres?locationId=${location.id}&catalog=1`,
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
  }, []);

  useEffect(() => {
    if (!hydrated) return;

    const location = booking.location;
    const date = booking.date;

    if (!location || !date || !booking.startTime || !booking.endTime) {
      setLoading(false);
      setLoadError(null);
      router.replace(BOOKING_ROUTES.ROOT);
      return;
    }

    void fetchTheatres(location);
  }, [
    hydrated,
    booking.location,
    booking.date,
    booking.startTime,
    booking.endTime,
    fetchTheatres,
    router,
  ]);

  function handleRetry() {
    if (!booking.location) return;
    void fetchTheatres(booking.location);
  }

  /* ---------------- Skeleton Loader ---------------- */

  if (loading) {
    return (
      <section className="bg-white px-3.5 py-8 pb-24 sm:px-4 sm:py-10 md:px-6 lg:py-14 lg:pb-14">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 items-start gap-5 md:grid-cols-2 lg:grid-cols-3">
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
        <div className="mb-8 px-3 py-4 text-center sm:mb-10 sm:px-8 lg:mb-14">
          <div>
            <p className="mb-3 text-[0.7rem] font-bold uppercase tracking-[0.32em] text-[#347f7c]">
              Haven Retreat
            </p>
            <h2 className="font-playfair text-[1.4rem] font-semibold leading-none tracking-[-0.045em] text-[#101828] sm:text-[2.6rem] lg:text-[3.25rem]">
              Premium Package Selection
            </h2>
          </div>

          {booking.startTime && booking.endTime && booking.durationHours && (
            <div className="mt-5 inline-flex max-w-full items-center justify-center gap-2 overflow-hidden border border-[#c6ddcf] bg-white px-3 py-2.5 text-xs font-semibold text-[#245e5b] shadow-[0_14px_34px_rgba(16,24,40,0.06)] sm:mt-6 sm:gap-4 sm:px-5 sm:py-3 sm:text-sm">
              <span className="inline-flex min-w-0 items-center gap-1.5 whitespace-nowrap sm:gap-2">
                <Clock size={14} className="shrink-0 sm:size-[15px]" />
                {formatISTTime(booking.startTime)} - {formatISTTime(booking.endTime)}
              </span>
              <span className="shrink-0 text-[#98a2b3]">|</span>
              <span className="shrink-0 whitespace-nowrap">
                {formatDuration(booking.durationHours * 60)}
              </span>
            </div>
          )}
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
              No packages available for this location
            </h3>
            <p className="mt-1 text-sm text-slate-600">
              Try a different location to see available packages.
            </p>
            <button
              type="button"
              onClick={() => router.push(BOOKING_ROUTES.ROOT)}
              className="mt-4 inline-flex cursor-pointer items-center justify-center rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 transition hover:bg-slate-100"
            >
              Change Location
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
