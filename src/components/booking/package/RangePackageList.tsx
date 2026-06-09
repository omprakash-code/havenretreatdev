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
      <div className="flex min-h-[50vh] items-center justify-center text-sm text-gray-500">
        Loading packages...
      </div>
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
      </div>
    </section>
  );
}
