"use client";

import { Check, ShieldCheck } from "@/components/icons";
import {
  BOOKING_APPROVED_MESSAGE,
  BOOKING_APPROVED_TITLE,
  BOOKING_NO_PAYMENT_DUE_MESSAGE,
  BOOKING_REJECTED_MESSAGE,
  BOOKING_REJECTED_TITLE,
  BOOKING_REVIEW_MESSAGE,
  BOOKING_REVIEW_TITLE,
} from "@/constants/booking-status-copy";
import type { BookingSuccessData } from "@/components/booking/success/types";

type TimelineStep = {
  label: string;
  state: "done" | "current" | "upcoming";
};

/**
 * Progress for a submitted booking. Submitted and Under Review are the states a
 * customer can reach today; Approved appears once an admin decides. Payment and
 * Event Day are future customer-experience work and are deliberately not shown.
 */
function buildTimeline(bookingStatus?: string | null): TimelineStep[] {
  const isApproved =
    bookingStatus === "APPROVED" || bookingStatus === "COMPLETED";

  if (isApproved) {
    return [
      { label: "Booking Submitted", state: "done" },
      { label: "Under Review", state: "done" },
      { label: "Approved", state: "current" },
    ];
  }

  return [
    { label: "Booking Submitted", state: "done" },
    { label: "Under Review", state: "current" },
  ];
}

function resolveCopy(data: BookingSuccessData) {
  if (data.bookingStatus === "REJECTED") {
    return {
      title: BOOKING_REJECTED_TITLE,
      message: data.rejectionReason
        ? `${BOOKING_REJECTED_MESSAGE} Reason: ${data.rejectionReason}`
        : BOOKING_REJECTED_MESSAGE,
      tone: "rose" as const,
    };
  }

  if (data.bookingStatus === "APPROVED" || data.bookingStatus === "COMPLETED") {
    return {
      title: BOOKING_APPROVED_TITLE,
      message: BOOKING_APPROVED_MESSAGE,
      tone: "emerald" as const,
    };
  }

  return {
    title: BOOKING_REVIEW_TITLE,
    message: BOOKING_REVIEW_MESSAGE,
    tone: "teal" as const,
  };
}

const TONE_STYLES = {
  teal: "border-[#b9d8d3] bg-[#f2f8f6]",
  emerald: "border-emerald-200 bg-emerald-50",
  rose: "border-rose-200 bg-rose-50",
} as const;

const TITLE_STYLES = {
  teal: "text-[#245e5b]",
  emerald: "text-emerald-800",
  rose: "text-rose-800",
} as const;

export default function ReviewStatusCard({
  data,
}: {
  data: BookingSuccessData;
}) {
  const copy = resolveCopy(data);
  const steps = buildTimeline(data.bookingStatus);
  const isRejected = data.bookingStatus === "REJECTED";
  const hasNoPaymentCollected = (data.advancePaid ?? 0) <= 0;

  return (
    <section
      className={`border p-4 sm:p-5 ${TONE_STYLES[copy.tone]}`}
      aria-label="Booking review status"
    >
      <h2 className={`text-sm font-bold sm:text-base ${TITLE_STYLES[copy.tone]}`}>
        {copy.title}
      </h2>
      <p className="mt-1 text-xs leading-6 text-slate-600 sm:text-sm">
        {copy.message}
      </p>

      {!isRejected && (
        <ol className="mt-4 space-y-2.5">
          {steps.map((step) => (
            <li key={step.label} className="flex items-center gap-2.5">
              <span
                aria-hidden="true"
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-white ${
                  step.state === "done"
                    ? "border-[#347f7c] bg-[#347f7c]"
                    : step.state === "current"
                      ? "border-[#347f7c] bg-white"
                      : "border-slate-300 bg-white"
                }`}
              >
                {step.state === "done" ? (
                  <Check size={12} />
                ) : (
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      step.state === "current" ? "bg-[#347f7c]" : "bg-slate-300"
                    }`}
                  />
                )}
              </span>
              <span
                className={`text-xs sm:text-sm ${
                  step.state === "upcoming"
                    ? "text-slate-400"
                    : "font-medium text-slate-700"
                }`}
              >
                {step.label}
              </span>
              {step.state === "current" && (
                <span className="ml-auto border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-900">
                  In progress
                </span>
              )}
            </li>
          ))}
        </ol>
      )}

      {hasNoPaymentCollected && !isRejected && (
        <div className="mt-4 flex items-start gap-2 border-t border-white/70 pt-3">
          <ShieldCheck
            size={15}
            className="mt-0.5 shrink-0 text-[#2f7e7a]"
            aria-hidden="true"
          />
          <p className="text-[11px] leading-5 text-slate-600 sm:text-xs">
            {BOOKING_NO_PAYMENT_DUE_MESSAGE}
          </p>
        </div>
      )}
    </section>
  );
}
