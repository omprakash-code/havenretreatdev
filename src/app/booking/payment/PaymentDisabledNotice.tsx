"use client";

import { useRouter } from "next/navigation";

import { ShieldCheck } from "@/components/icons";
import { BOOKING_NO_PAYMENT_DUE_MESSAGE } from "@/constants/booking-status-copy";
import { BOOKING_ROUTES } from "@/constants/routes";

/**
 * Shown when a customer lands on the payment step directly (old link, bookmark,
 * browser history). Nothing is charged here anymore; the booking journey ends at
 * the agreement step with a request for review.
 */
export default function PaymentDisabledNotice() {
  const router = useRouter();

  return (
    <div className="flex min-h-[70vh] w-full items-center justify-center bg-[#f6f8f7] px-4 py-12">
      <div className="w-full max-w-md border border-[#2f7e7a]/20 bg-white p-6 text-center">
        <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-[#edf3f1]">
          <ShieldCheck size={20} className="text-[#2f7e7a]" aria-hidden="true" />
        </div>

        <h1 className="text-lg font-semibold text-[#1f2937]">
          No payment is due right now
        </h1>

        <p className="mt-2 text-sm leading-6 text-gray-500">
          {BOOKING_NO_PAYMENT_DUE_MESSAGE}
        </p>

        <div className="mt-6 flex flex-col gap-2">
          <button
            type="button"
            onClick={() => router.push(BOOKING_ROUTES.ROOT)}
            className="inline-flex h-10 w-full cursor-pointer items-center justify-center bg-[#347f7c] px-4 text-sm font-medium text-white transition hover:bg-[#2f7370]"
          >
            Back to booking
          </button>
          <button
            type="button"
            onClick={() => router.push("/contact")}
            className="inline-flex h-10 w-full cursor-pointer items-center justify-center border border-[#2f7e7a]/35 bg-white px-4 text-sm font-medium text-[#245e5b] transition hover:bg-[#f2f7f6]"
          >
            Contact Haven Retreat
          </button>
        </div>
      </div>
    </div>
  );
}
