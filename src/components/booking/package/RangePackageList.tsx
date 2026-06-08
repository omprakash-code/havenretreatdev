"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import PackageCard from "@/components/packages/PackageCard";
import { BOOKING_ROUTES } from "@/constants/routes";
import { useBooking } from "@/context/BookingContext";
import { toDateKeyString } from "@/lib/date";
import type { Theatre } from "@/types/theatre";
import type { EventPackageSummary } from "@/types/venue-package";

export default function RangePackageList() {
  const router = useRouter();
  const { booking, hydrated, refreshBooking } = useBooking();
  const [packages, setPackages] = useState<EventPackageSummary[]>([]);
  const [theatre, setTheatre] = useState<Theatre | null>(null);
  const [loading, setLoading] = useState(true);
  const [lockingPackageId, setLockingPackageId] = useState<string | null>(null);

  useEffect(() => {
    if (!hydrated) return;
    if (
      !booking.location ||
      !booking.date ||
      !booking.startTime ||
      !booking.endTime
    ) {
      router.replace(BOOKING_ROUTES.ROOT);
      return;
    }

    let cancelled = false;
    void Promise.all([
      fetch("/api/packages", { cache: "no-store" }).then((res) => res.json()),
      fetch(
        `/api/theatres?locationId=${encodeURIComponent(
          booking.location.id
        )}&catalog=1`,
        { credentials: "include", cache: "no-store" }
      ).then((res) => res.json()),
    ])
      .then(([packageResult, theatreResult]) => {
        if (cancelled) return;
        setPackages(
          Array.isArray(packageResult?.data) ? packageResult.data : []
        );
        setTheatre(theatreResult?.data?.theatres?.[0] ?? null);
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
  }, [
    booking.date,
    booking.endTime,
    booking.location,
    booking.startTime,
    hydrated,
    router,
  ]);

  async function selectPackage(eventPackage: EventPackageSummary) {
    if (
      lockingPackageId ||
      !theatre ||
      !booking.date ||
      !booking.startTime ||
      !booking.endTime
    ) {
      return;
    }

    setLockingPackageId(eventPackage.id);
    try {
      const res = await fetch("/api/booking-locks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          theatreId: theatre.id,
          packageId: eventPackage.id,
          eventDate: toDateKeyString(booking.date),
          startTime: booking.startTime,
          endTime: booking.endTime,
        }),
      });
      const result = await res.json().catch(() => null);
      if (!res.ok || !result?.success) {
        toast.error(
          result?.message || "This time is no longer available."
        );
        return;
      }

      await refreshBooking();
      router.push("/booking/contact");
    } finally {
      setLockingPackageId(null);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-sm text-gray-500">
        Loading packages...
      </div>
    );
  }

  if (!theatre || packages.length === 0) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-sm text-gray-500">
        No active packages are available.
      </div>
    );
  }

  return (
    <section className="bg-white px-4 py-10">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-[#347f7c]">
            Haven Retreat
          </p>
          <h1 className="mt-2 font-playfair text-4xl font-semibold text-[#101828]">
            Select Your Package
          </h1>
        </div>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {packages.map((eventPackage) => (
            <PackageCard
              key={eventPackage.id}
              eventPackage={eventPackage}
              onBook={selectPackage}
              bookLabel={
                lockingPackageId === eventPackage.id
                  ? "Reserving..."
                  : "Continue with This Package"
              }
            />
          ))}
        </div>
      </div>
    </section>
  );
}
