// src/hooks/booking/useContactSubmit.ts

"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useBooking } from "@/context/BookingContext";
import { handleBookingError } from "@/utils/handleBookingError";


export function useContactSubmit() {
  const router = useRouter();
  const {
    booking,
    resetBooking,
    setCouponState,
    clearCouponState,
  } = useBooking();

  const submitContact = async (
    contact: {
      name: string;
      phone: string;
      email?: string;
    },
    options?: {
      decorationRequired?: boolean;
    }
  ): Promise<{
    success: boolean;
    effectiveDecorationRequired?: boolean;
  }> => {

    if (
      !booking.bookingId ||
      !booking.package ||
      !booking.schedule
    ) {
      toast.error("Booking is incomplete. Please restart booking.");
      router.replace("/booking");
      return { success: false };
    }

    const res = await fetch("/api/bookings/update/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bookingId: booking.bookingId,

        name: contact.name,
        phone: contact.phone,
        email: contact.email,

        guestCount: booking.guestCount,
        decorationRequired:
          options?.decorationRequired ??
          booking.decorationRequired,
      }),
    });

    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.success) {
      handleBookingError(json, router, {
        resetBooking,
        fallbackMessage: "Failed to update booking.",
      });
      return { success: false };
    }

    const discountAmount = Number(json?.data?.discountAmount ?? 0);
    const appliedCoupons = Array.isArray(json?.data?.appliedCoupons)
      ? json.data.appliedCoupons
      : [];

    if (discountAmount > 0 && appliedCoupons.length > 0) {
      setCouponState({
        discount: discountAmount,
        coupons: appliedCoupons,
      });
    } else {
      clearCouponState();
    }

    return {
      success: true,
      effectiveDecorationRequired: Boolean(
        json?.data?.effectiveDecorationRequired
      ),
    };
  };

  return { submitContact };
}
