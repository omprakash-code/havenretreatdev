"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import VenueBookingLayout from "@/components/venue-booking/VenueBookingLayout";
import { useVenueBooking } from "@/context/VenueBookingContext";
import { HAVEN_BOOKING_ROUTES } from "@/constants/haven-booking-routes";

export default function HavenBookingPaymentPage() {
  const router = useRouter();
  const { booking, hydrated, applyPersistedDraft } = useVenueBooking();
  const [payload, setPayload] = useState<null | {
    advancePayable: number;
    totalAmount: number;
    remainingPayable: number;
  }>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (hydrated && !booking.packageSnapshot) {
      router.replace(HAVEN_BOOKING_ROUTES.PACKAGE);
    }
    if (hydrated && !booking.bookingId) {
      router.replace(HAVEN_BOOKING_ROUTES.DETAILS);
    }
  }, [booking.bookingId, booking.packageSnapshot, hydrated, router]);

  useEffect(() => {
    if (!hydrated || !booking.bookingId) return;

    let isActive = true;

    void (async () => {
      const response = await fetch("/api/venue-bookings/prepare-payment", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          bookingId: booking.bookingId,
        }),
      });

      const json = await response.json().catch(() => null);
      if (!isActive) return;

      if (!response.ok || !json?.success) {
        setErrorMessage(json?.message || "Unable to prepare payment.");
        return;
      }

      if (json.data?.draft) {
        applyPersistedDraft(json.data.draft);
      }

      setPayload({
        advancePayable: json.data.advancePayable,
        totalAmount: json.data.totalAmount,
        remainingPayable: json.data.remainingPayable,
      });
    })();

    return () => {
      isActive = false;
    };
  }, [applyPersistedDraft, booking.bookingId, hydrated]);

  if (!hydrated || !booking.packageSnapshot) {
    return null;
  }

  return (
    <VenueBookingLayout
      currentStep={6}
      title="Payment Handoff"
      description="This step now prepares a real venue booking draft for payment using a Haven-specific adapter, while still leaving the legacy Razorpay runtime untouched."
    >
      <div className="rounded-3xl border border-[#d8e4e2] bg-white p-6 shadow-[0_20px_45px_rgba(15,23,42,0.06)]">
        {payload ? (
          <div className="space-y-3">
            <p className="text-base text-[#344054]">
              This venue booking is now payment-ready in the database.
            </p>
            <div className="rounded-2xl bg-[#f5f8f7] p-4 text-sm text-[#101828]">
              <p>Total Amount: ₹{payload.totalAmount}</p>
              <p className="mt-2">Advance Payable: ₹{payload.advancePayable}</p>
              <p className="mt-2">Remaining After Deposit: ₹{payload.remainingPayable}</p>
            </div>
          </div>
        ) : errorMessage ? (
          <p className="text-sm text-[#b42318]">{errorMessage}</p>
        ) : (
          <p className="text-base text-[#344054]">Preparing payment...</p>
        )}
        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={() => router.push(HAVEN_BOOKING_ROUTES.SUCCESS)}
            className="inline-flex items-center justify-center rounded-full bg-[#347f7c] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#245e5b]"
          >
            View Success Placeholder
          </button>
        </div>
      </div>
    </VenueBookingLayout>
  );
}
