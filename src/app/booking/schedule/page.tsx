"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useBooking } from "@/context/BookingContext";
import SelectLocationScreen from "@/components/booking/location/SelectLocationScreen";
import { BOOKING_ROUTES } from "@/constants/routes";
import { toDateKeyString } from "@/lib/date";

function ScheduleContent() {
  const router = useRouter();
  const { booking, refreshBooking } = useBooking();
  const [selectedPackageRate, setSelectedPackageRate] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const pendingPackageId = sessionStorage.getItem("hr_pending_package_id");
    if (!pendingPackageId) {
      router.replace(BOOKING_ROUTES.PACKAGE);
      return;
    }
    const rate = Number(sessionStorage.getItem("hr_pending_package_rate") || "0");
    if (rate > 0) setSelectedPackageRate(rate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const canContinue = Boolean(
    booking.location &&
      booking.date &&
      booking.startTime &&
      booking.endTime &&
      booking.durationHours
  );

  const handleContinue = async () => {
    if (!canContinue || !booking.location || !booking.date || isSubmitting) return;

    const packageId = sessionStorage.getItem("hr_pending_package_id");
    if (!packageId) {
      router.replace(BOOKING_ROUTES.PACKAGE);
      return;
    }

    setIsSubmitting(true);
    try {
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

      const theatreRes = await fetch(
        `/api/theatres?locationId=${encodeURIComponent(booking.location.id)}&catalog=1`,
        { credentials: "include", cache: "no-store" }
      );
      const theatreResult = await theatreRes.json().catch(() => null);
      const theatre = theatreResult?.data?.theatres?.[0];
      if (!theatre) {
        toast.error("Unable to load venue details. Please try again.");
        return;
      }

      const lockRes = await fetch("/api/booking-locks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          theatreId: theatre.id,
          packageId,
          eventDate: toDateKeyString(booking.date),
          startTime: booking.startTime,
          endTime: booking.endTime,
        }),
      });
      const lockResult = await lockRes.json().catch(() => null);
      if (!lockRes.ok || !lockResult?.success) {
        toast.error(lockResult?.message || "This time is no longer available.");
        return;
      }

      sessionStorage.removeItem("hr_pending_package_id");
      await refreshBooking();
      router.push(BOOKING_ROUTES.CONTACT);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-[calc(100vh-160px)]">
      <SelectLocationScreen
        onContinue={handleContinue}
        selectedHourlyRate={selectedPackageRate ?? undefined}
        continueLabel={isSubmitting ? "Please wait..." : "Confirm Date & Time"}
        continueDisabled={isSubmitting}
      />
    </main>
  );
}

function LoadingFallback() {
  return (
    <main className="min-h-[calc(100vh-160px)] flex items-center justify-center">
      <div className="animate-pulse text-gray-500">Loading...</div>
    </main>
  );
}

export default function BookingSchedulePage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <ScheduleContent />
    </Suspense>
  );
}
