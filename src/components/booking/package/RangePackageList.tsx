"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Clock } from "@/components/icons";
import PackageCard from "@/components/packages/PackageCard";
import { BOOKING_ROUTES } from "@/constants/routes";
import { useBooking } from "@/context/BookingContext";
import { formatDuration, formatISTTime } from "@/lib/formatters";
import type { EventPackageSummary } from "@/types/venue-package";

export default function RangePackageList() {
  const router = useRouter();
  const { booking, hydrated } = useBooking();
  const [packages, setPackages] = useState<EventPackageSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [navigating, setNavigating] = useState(false);

  useEffect(() => {
    if (!hydrated) return;

    let cancelled = false;
    fetch("/api/packages", { cache: "no-store" })
      .then((res) => res.json())
      .then((result) => {
        if (cancelled) return;
        setPackages(Array.isArray(result?.data) ? result.data : []);
      })
      .catch(() => {
        if (!cancelled) toast.error("Unable to load packages.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [hydrated]);

  function selectPackage(eventPackage: EventPackageSummary) {
    if (navigating) return;
    setNavigating(true);
    sessionStorage.setItem("hr_pending_package_id", eventPackage.id);
    sessionStorage.setItem("hr_pending_package_rate", String(eventPackage.hourlyRate ?? 0));
    router.push(BOOKING_ROUTES.SCHEDULE);
  }

  if (loading) {
    return (
      <section className="bg-white">
        <div className="px-4 py-10 text-center sm:py-8 lg:py-12">
          <div className="mx-auto max-w-5xl">
            <div className="mx-auto h-8 w-72 animate-pulse rounded bg-gray-200 sm:h-10 sm:w-96" />
          </div>
        </div>
        <div className="mx-auto max-w-7xl px-4 pb-12 sm:pb-16 lg:pb-20">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex flex-col bg-white shadow-[0_18px_50px_rgba(16,24,40,0.08)]">
                {/* card header */}
                <div className="min-h-[180px] animate-pulse bg-gray-200 px-3 pb-5 pt-3">
                  <div className="h-5 w-24 rounded bg-gray-300" />
                  <div className="mt-auto flex flex-col items-center justify-end pt-16">
                    <div className="h-7 w-40 rounded bg-gray-300" />
                    <div className="mt-2 h-9 w-28 rounded bg-gray-300" />
                    <div className="mt-2 h-4 w-36 rounded bg-gray-300" />
                  </div>
                </div>
                {/* card body */}
                <div className="flex flex-1 flex-col p-5">
                  <div className="h-3.5 w-16 animate-pulse rounded bg-gray-200" />
                  <div className="mt-3 space-y-2">
                    {[0, 1, 2, 3].map((j) => (
                      <div key={j} className="flex items-center gap-2">
                        <div className="h-4 w-4 animate-pulse rounded-full bg-gray-200" />
                        <div className="h-3.5 animate-pulse rounded bg-gray-200" style={{ width: `${60 + j * 8}%` }} />
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 h-10 w-full animate-pulse rounded bg-gray-100" />
                </div>
                {/* card button */}
                <div className="mx-6 mb-6 h-10 animate-pulse rounded bg-gray-200" />
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (packages.length === 0) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-sm text-gray-500">
        No active packages are available.
      </div>
    );
  }

  return (
    <section className="bg-white">
      <div className="px-4 py-10 text-center sm:py-8 lg:py-12">
        <div className="mx-auto max-w-5xl">
          <h1 className="font-playfair text-[1.35rem] font-semibold leading-none tracking-[-0.045em] text-[#101828] sm:text-[2.5rem] lg:text-[2.5rem]">
            Premium Package Selection
          </h1>

          {booking.startTime && booking.endTime && booking.durationHours && (
            <div className="mt-8 inline-flex max-w-full items-center justify-center gap-3 border border-[#c6ddcf] bg-white px-3 py-2 text-xs font-semibold text-[#245e5b] shadow-[0_14px_34px_rgba(16,24,40,0.06)] sm:gap-5 sm:px-3 sm:px-1.5 sm:text-sm">
              <span className="inline-flex min-w-0 items-center gap-2 whitespace-nowrap">
                <Clock size={16} className="shrink-0" />
                {formatISTTime(booking.startTime)} -{" "}
                {formatISTTime(booking.endTime)}
              </span>
              <span className="h-6 w-px shrink-0 bg-[#98a2b3]" />
              <span className="shrink-0 whitespace-nowrap">
                {formatDuration(booking.durationHours * 60)}
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 pb-12 sm:pb-16 lg:pb-20">
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {packages.map((eventPackage) => (
            <PackageCard
              key={eventPackage.id}
              eventPackage={eventPackage}
              onBook={selectPackage}
              bookLabel={
                navigating ? "Just a moment..." : "Continue with This Package"
              }
            />
          ))}
        </div>

        <div className="mt-8 border border-[#d7e4e1] bg-white px-6 py-6 text-center">
          <p className="text-base font-semibold text-[#1f2937]">
            Don&apos;t see exactly what you need?
          </p>
          <p className="mt-1 text-sm text-[#667085]">
            Every package is fully customizable - guest count, décor, timing, and more.
            We&apos;ll build the perfect setup for your event.
          </p>
          <a
            href="https://havenretreatmiami.com/contact-us/"
            target="_blank"
            rel="noopener noreferrer"
            className="group mt-4 inline-flex items-center border border-[#2f7e7a]/40 bg-[#edf3f1] px-5 py-2.5 text-sm font-semibold text-[#245e5b] transition hover:bg-[#dceee9]"
          >
            Contact us to customize
            <span
              aria-hidden="true"
              className="ml-1.5 inline-block translate-x-[-6px] opacity-0 transition-all duration-200 ease-out group-hover:translate-x-0 group-hover:opacity-100"
            >
              →
            </span>
          </a>
        </div>
      </div>
    </section>
  );
}
