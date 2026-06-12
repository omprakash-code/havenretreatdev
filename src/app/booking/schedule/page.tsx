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
  const { booking, refreshBooking, hydrated } = useBooking();
  const [selectedPackageRate, setSelectedPackageRate] = useState<number | null>(null);
  const [selectedPackageName, setSelectedPackageName] = useState<string | null>(null);
  const [selectedPackageBasePrice, setSelectedPackageBasePrice] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!hydrated) return;

    const pendingPackageId = sessionStorage.getItem("hr_pending_package_id");
    // Returning from a later step: the pending keys are cleared once the lock
    // is created, but the active booking session still identifies the package.
    const activePackage = booking.bookingId ? booking.package : null;

    if (!pendingPackageId && !activePackage) {
      router.replace(BOOKING_ROUTES.PACKAGE);
      return;
    }

    const rate = Number(sessionStorage.getItem("hr_pending_package_rate") || "0");
    if (rate > 0) setSelectedPackageRate(rate);
    else if (activePackage?.hourlyRate) setSelectedPackageRate(activePackage.hourlyRate);

    const name = sessionStorage.getItem("hr_pending_package_name") || "";
    if (name) setSelectedPackageName(name);
    else if (activePackage?.name) setSelectedPackageName(activePackage.name);

    const basePrice = Number(sessionStorage.getItem("hr_pending_package_base_price") || "0");
    const snapshotPackageAmount = Number(booking.rangePricingSnapshot?.packageAmount ?? 0);
    if (basePrice > 0) setSelectedPackageBasePrice(basePrice);
    else if (snapshotPackageAmount > 0) setSelectedPackageBasePrice(snapshotPackageAmount);
    else if (activePackage?.basePrice) setSelectedPackageBasePrice(activePackage.basePrice);
  }, [
    hydrated,
    booking.bookingId,
    booking.package,
    booking.rangePricingSnapshot,
    router,
  ]);

  const canContinue = Boolean(
    booking.date &&
      booking.startTime &&
      booking.endTime &&
      booking.durationHours
  );

  const handleContinue = async () => {
    if (!canContinue || !booking.date || isSubmitting) return;

    const packageId =
      sessionStorage.getItem("hr_pending_package_id") ??
      (booking.bookingId ? booking.package?.id ?? null : null);
    if (!packageId) {
      router.replace(BOOKING_ROUTES.PACKAGE);
      return;
    }

    setIsSubmitting(true);
    try {
      const eventDate = toDateKeyString(booking.date);

      const lockRes = await fetch("/api/booking-locks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          packageId,
          eventDate,
          startTime: booking.startTime,
          endTime: booking.endTime,
        }),
      });
      const lockResult = await lockRes.json().catch(() => null);

      if (!lockRes.ok || !lockResult?.success) {
        if (lockResult?.code === "BOOKING_DISABLED") {
          toast.error("Online booking is currently unavailable. Please contact us.");
        } else if (lockResult?.code === "BOOKING_CONFLICT") {
          toast.error("This time is no longer available. Please choose a different time.");
        } else if (lockResult?.code === "PAYMENT_IN_PROGRESS") {
          toast.error("A payment is already in progress for this booking.");
        } else {
          toast.error(lockResult?.message || "Unable to reserve this time. Please try again.");
        }
        return;
      }

      sessionStorage.removeItem("hr_pending_package_id");
      sessionStorage.removeItem("hr_pending_package_name");
      sessionStorage.removeItem("hr_pending_package_rate");
      sessionStorage.removeItem("hr_pending_package_base_price");
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
        selectedPackageName={selectedPackageName ?? undefined}
        selectedPackageBasePrice={selectedPackageBasePrice ?? undefined}
        selectedHourlyRate={selectedPackageRate ?? undefined}
        continueLabel={isSubmitting ? "Please wait..." : "Reserve This Date"}
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
