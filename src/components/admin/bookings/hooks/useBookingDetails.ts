// src/components/admin/bookings/hooks/useBookingDetails.ts
"use client";

import { useState, useCallback } from "react";
import type { AdminBooking } from "@/types/admin/booking-admin";
import { toast } from "sonner";

type UseBookingDetailsReturn = {
  booking: AdminBooking | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
};

export function useBookingDetails(
  initialBooking: AdminBooking | null = null
): UseBookingDetailsReturn {
  const [booking, setBooking] = useState<AdminBooking | null>(initialBooking);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!booking?.id) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/admin/bookings/${booking.id}?view=drawer`, {
        cache: "no-store",
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.message || "Failed to fetch booking details");
      }

      if (data.success) {
        setBooking(data.data);
      } else {
        throw new Error(data?.message || "Failed to fetch booking details");
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unable to load booking details";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [booking?.id]);

  return {
    booking,
    loading,
    error,
    refetch,
  };
}
