"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useBooking } from "@/context/BookingContext";
import { BOOKING_ROUTES } from "@/constants/routes";

function BookingRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { resetBooking } = useBooking();

  useEffect(() => {
    if (searchParams.get("fresh") === "1") {
      resetBooking();
    }
    router.replace(BOOKING_ROUTES.PACKAGE);
  }, [searchParams, resetBooking, router]);

  return null;
}

export default function BookingPage() {
  return (
    <Suspense>
      <BookingRedirect />
    </Suspense>
  );
}
