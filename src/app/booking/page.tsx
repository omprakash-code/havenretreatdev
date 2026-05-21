"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useBooking } from "@/context/BookingContext";
import SelectLocationScreen from "@/components/booking/location/SelectLocationScreen";
import { BOOKING_ROUTES } from "@/constants/routes";

function BookingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { booking, resetBooking } = useBooking();

  /**
   * Reset ONLY if explicitly requested
   * Example: /booking?fresh=1
   */
  useEffect(() => {
    if (searchParams.get("fresh") === "1") {
      resetBooking();
    }
  }, [searchParams, resetBooking]);
  
  const canContinue = Boolean(
    booking.location &&
      booking.date &&
      booking.startTime &&
      booking.endTime &&
      booking.durationHours
  );

  const handleContinue = async () => {
    if (!canContinue || !booking.location || !booking.date) return;

    // Persist prebooking to signed cookie
    await fetch("/api/prebooking/set", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        locationId: booking.location.id,
        locationName: booking.location.name,
        city: booking.location.city,
        date: booking.date.toISOString(),
        startTime: booking.startTime,
        endTime: booking.endTime,
        durationHours: booking.durationHours,
      }),
    });

    router.push(BOOKING_ROUTES.PACKAGE);
  };

  return (
    <>
      <main className="min-h-[calc(100vh-160px)]">
        <SelectLocationScreen onContinue={handleContinue} />
      </main>
    </>
  );
}

function LoadingFallback() {
  return (
    <main className="min-h-[calc(100vh-160px)] flex items-center justify-center">
      <div className="animate-pulse text-gray-500">Loading...</div>
    </main>
  );
}

export default function BookingLocationPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <BookingContent />
    </Suspense>
  );
}
