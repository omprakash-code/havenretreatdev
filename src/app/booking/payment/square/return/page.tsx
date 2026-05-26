"use client";

import Image from "next/image";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { ShieldCheck } from "@/components/icons";
import { BOOKING_ROUTES } from "@/constants/routes";
import { useBooking } from "@/context/BookingContext";

type StatusResponse = {
  success?: boolean;
  status?: string;
  bookingRef?: string;
  successToken?: string;
  cancelledReason?: string;
  message?: string;
};

function SquarePaymentReturnContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { resetBooking } = useBooking();
  const bookingId = searchParams.get("bookingId");
  const [message, setMessage] = useState("Confirming your payment with Square...");

  useEffect(() => {
    if (!bookingId) {
      router.replace(BOOKING_ROUTES.ROOT);
      return;
    }

    let cancelled = false;
    let attempts = 0;

    const poll = async () => {
      attempts += 1;

      const res = await fetch(
        `/api/payments/square/status?bookingId=${encodeURIComponent(bookingId)}`,
        { cache: "no-store" }
      );
      const json = (await res.json().catch(() => null)) as StatusResponse | null;

      if (cancelled) return;

      if (res.ok && json?.status === "CONFIRMED" && json.successToken) {
        resetBooking();
        router.replace(`/booking/success?t=${encodeURIComponent(json.successToken)}`);
        return;
      }

      if (res.ok && json?.status === "PAID_EXPIRED") {
        toast.error("Payment was received, but the reservation could not be confirmed.");
        router.replace(BOOKING_ROUTES.ROOT);
        return;
      }

      if (attempts >= 20) {
        setMessage("Payment received. Confirmation is still syncing, please wait a moment and refresh.");
        return;
      }

      window.setTimeout(poll, 1500);
    };

    void poll();

    return () => {
      cancelled = true;
    };
  }, [bookingId, resetBooking, router]);

  return (
    <div className="min-h-screen bg-[#f6f8f7]">
      <main className="flex items-center justify-center px-6 py-24">
        <div className="w-full max-w-md border border-[#2f7e7a]/20 bg-white p-8 text-center space-y-6 shadow-sm">
          <div className="flex justify-center">
            <Image
              src="/assets/logo.png"
              alt="Haven Retreat Logo"
              width={140}
              height={40}
              priority
            />
          </div>

          <div className="flex justify-center">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#d7e4e1] border-t-[#347f7c]" />
          </div>

          <h2 className="text-lg font-semibold text-[#1f2937]">
            Finalizing Your Booking
          </h2>
          <p className="text-sm text-gray-600">{message}</p>

          <div className="flex items-center justify-center gap-2 text-xs text-gray-500">
            <ShieldCheck size={14} className="text-[#347f7c]" />
            SSL Secured · Square Hosted Checkout
          </div>
        </div>
      </main>
    </div>
  );
}

export default function SquarePaymentReturnPage() {
  return (
    <Suspense fallback={null}>
      <SquarePaymentReturnContent />
    </Suspense>
  );
}
