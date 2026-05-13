"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import SignaturePad from "@/components/venue-booking/SignaturePad";
import VenueBookingLayout from "@/components/venue-booking/VenueBookingLayout";
import { useVenueBooking } from "@/context/VenueBookingContext";
import { HAVEN_BOOKING_ROUTES } from "@/constants/haven-booking-routes";

type AgreementTemplateSummary = {
  title: string;
  content: string;
  version: string;
} | null;

export default function VenueBookingAgreementForm({
  template,
}: {
  template: AgreementTemplateSummary;
}) {
  const router = useRouter();
  const { booking, hydrated, setAgreement, applyPersistedDraft } = useVenueBooking();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (hydrated && !booking.packageSnapshot) {
      router.replace(HAVEN_BOOKING_ROUTES.PACKAGE);
    }
    if (hydrated && !booking.bookingId) {
      router.replace(HAVEN_BOOKING_ROUTES.DETAILS);
    }
  }, [booking.bookingId, booking.packageSnapshot, hydrated, router]);

  if (!hydrated || !booking.packageSnapshot) {
    return null;
  }

  const canContinue =
    booking.agreementAccepted &&
    Boolean(booking.signerName.trim()) &&
    Boolean(booking.signatureImage);

  return (
    <VenueBookingLayout
      currentStep={5}
      title="Agreement Review"
      description="This is the new agreement foundation only. We’re storing acceptance, signer name, and a signature image in the new venue-booking state before wiring persistence later."
    >
      <div className="space-y-6 rounded-3xl border border-[#d8e4e2] bg-white p-6 shadow-[0_20px_45px_rgba(15,23,42,0.06)]">
        <div className="rounded-2xl border border-[#eaecf0] bg-[#fcfcfd] p-5">
          <p className="text-sm font-semibold tracking-[0.12em] text-[#347f7c] uppercase">
            {template?.title || "Agreement Preview"}
          </p>
          <p className="mt-2 text-xs text-[#667085]">
            Version {template?.version || "draft"}
          </p>
          <div className="mt-4 whitespace-pre-wrap text-sm leading-7 text-[#344054]">
            {template?.content ||
              "No active agreement template is seeded yet. This page is ready for template-driven content once the agreement record exists."}
          </div>
        </div>

        <label className="block">
          <span className="text-sm font-medium text-[#344054]">
            Typed Full Name
          </span>
          <input
            value={booking.signerName}
            onChange={(event) =>
              setAgreement({ signerName: event.target.value })
            }
            className="mt-2 w-full rounded-2xl border border-[#d0d5dd] px-4 py-3 text-sm text-[#101828] outline-none transition focus:border-[#347f7c]"
            placeholder="Type the signer name exactly as it should appear on the agreement"
          />
        </label>

        <div>
          <p className="mb-2 text-sm font-medium text-[#344054]">
            Signature
          </p>
          <SignaturePad
            value={booking.signatureImage}
            onChange={(value) => setAgreement({ signatureImage: value })}
          />
        </div>

        <label className="flex items-start gap-3 rounded-2xl border border-[#d0d5dd] p-4">
          <input
            type="checkbox"
            checked={booking.agreementAccepted}
            onChange={(event) =>
              setAgreement({ agreementAccepted: event.target.checked })
            }
            className="mt-1"
          />
          <span className="text-sm text-[#344054]">
            I have reviewed the agreement terms and I’m ready to continue to the
            payment handoff step.
          </span>
        </label>

        <div className="flex justify-end">
          <button
            type="button"
            disabled={!canContinue}
            onClick={async () => {
              if (!booking.bookingId || !canContinue) return;

              setIsSubmitting(true);
              setErrorMessage(null);
              try {
                const response = await fetch("/api/venue-bookings/agreement", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({
                    bookingId: booking.bookingId,
                    signerName: booking.signerName,
                    signatureImage: booking.signatureImage,
                  }),
                });

                const json = await response.json().catch(() => null);
                if (!response.ok || !json?.success || !json?.data?.draft) {
                  setErrorMessage(
                    json?.message || "Unable to save signed agreement."
                  );
                  return;
                }

                applyPersistedDraft(json.data.draft);
                router.push(HAVEN_BOOKING_ROUTES.PAYMENT);
              } finally {
                setIsSubmitting(false);
              }
            }}
            className="inline-flex items-center justify-center rounded-full bg-[#347f7c] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#245e5b] disabled:cursor-not-allowed disabled:bg-[#98a2b3]"
          >
            {isSubmitting ? "Saving..." : "Continue to Payment"}
          </button>
        </div>
        {errorMessage ? (
          <p className="text-sm text-[#b42318]">{errorMessage}</p>
        ) : null}
      </div>
    </VenueBookingLayout>
  );
}
