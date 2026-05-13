// src/components/admin/bookings/drawer/BookingDrawer.tsx
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import AdminDrawer from "@/components/admin/drawer/AdminDrawer";
import BookingDetails from "./BookingDetails";
import type { AdminBooking } from "@/types/admin/booking-admin";

type Props = {
  open: boolean;
  onClose: () => void;
  booking: AdminBooking | null;
};

export default function BookingDrawer({ open, onClose, booking }: Props) {
  const [bookingDetails, setBookingDetails] = useState<AdminBooking | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);
  const detailsCacheRef = useRef(new Map<string, AdminBooking>());
  const bookingId = booking?.id ?? null;

  const fetchBookingDetails = useCallback(async (options?: { force?: boolean }) => {
    if (!bookingId) return;
    const force = Boolean(options?.force);

    if (!force) {
      const cached = detailsCacheRef.current.get(bookingId);
      if (cached) {
        setBookingDetails(cached);
        setLoading(false);
        setError(null);
        return;
      }
    }

    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/admin/bookings/${bookingId}?view=drawer`, {
        cache: "no-store",
      });
      const json = await res.json().catch(() => null);

      if (requestId !== requestIdRef.current) return;

      if (!res.ok || !json?.success || !json?.data) {
        setBookingDetails(null);
        setError(json?.message ?? "Failed to load booking details.");
        return;
      }

      const details = json.data as AdminBooking;
      if (!details?.slot?.date || !details?.theatre?.name || !details?.pricing) {
        setBookingDetails(null);
        setError("Booking details response is invalid.");
        return;
      }

      detailsCacheRef.current.set(bookingId, details);
      setBookingDetails(details);
    } catch {
      if (requestId !== requestIdRef.current) return;
      setBookingDetails(null);
      setError("Failed to load booking details.");
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, [bookingId]);

  useEffect(() => {
    if (!open || !bookingId) {
      requestIdRef.current += 1;
      setBookingDetails(null);
      setError(null);
      setLoading(false);
      return;
    }

    // Always revalidate on open so recently updated pricing/payment
    // details are reflected immediately without requiring a page refresh.
    void fetchBookingDetails({ force: true });
  }, [open, bookingId, fetchBookingDetails]);

  return (
    <AdminDrawer
      open={open}
      onClose={onClose}
      title="Booking Details"
      description={booking ? `Reference: ${booking.bookingRef}` : undefined}
    >
      {!booking ? null : loading ? (
        <div className="py-10 text-sm text-slate-500">Loading booking details…</div>
      ) : error ? (
        <div className="space-y-3 py-4">
          <p className="text-sm text-red-600">{error}</p>
          <button
            type="button"
            onClick={() => void fetchBookingDetails({ force: true })}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Retry
          </button>
        </div>
      ) : bookingDetails ? (
        <BookingDetails
          key={bookingDetails.id}
          booking={bookingDetails}
        />
      ) : (
        <div className="py-10 text-sm text-slate-500">Booking details unavailable.</div>
      )}
    </AdminDrawer>
  );
}
