"use client";

import { Check } from "@/components/icons";

type TrailStep = {
  label: string;
  state: "done" | "current";
};

/**
 * The review progress, on one line under the booking reference. A rejected
 * booking has no progress to show — its outcome and reason are reported on the
 * status card instead — so this renders nothing for it.
 */
function buildTrail(bookingStatus?: string | null): TrailStep[] {
  if (bookingStatus === "APPROVED" || bookingStatus === "CONFIRMED") {
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

export default function ReviewStatusTrail({
  bookingStatus,
}: {
  bookingStatus?: string | null;
}) {
  const isPendingReview = bookingStatus === "PENDING_REVIEW";
  const isApproved =
    bookingStatus === "APPROVED" || bookingStatus === "CONFIRMED";

  if (!isPendingReview && !isApproved) return null;

  const steps = buildTrail(bookingStatus);

  return (
    // Fills the width left of the reference so the first step sits beside the
    // copy button and the last one ends flush with the action row below. Its
    // height matches the copy button, so centring inside it puts the steps on
    // the reference's centre line without the reference having to move.
    <ol
      aria-label="Booking review progress"
      className="flex w-full flex-wrap items-center gap-2 sm:h-8 sm:min-w-0 sm:flex-1 sm:flex-nowrap sm:gap-x-2.5"
    >
      {steps.map((step, index) => (
        <li
          key={step.label}
          className={`min-w-0 flex items-center gap-2 ${
            index < steps.length - 1
              ? "sm:flex-1"
              : "ml-auto shrink-0 sm:ml-auto"
          }`}
        >
          <span
            aria-hidden="true"
            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-white ${
              step.state === "done"
                ? "border-[#347f7c] bg-[#347f7c]"
                : "border-[#347f7c] bg-white"
            }`}
          >
            {step.state === "done" ? (
              <Check size={12} />
            ) : (
              <span className="h-1.5 w-1.5 rounded-full bg-[#347f7c]" />
            )}
          </span>

          <span className="whitespace-nowrap text-[11px] font-medium text-slate-700 sm:text-sm">
            {step.label}
          </span>

          {step.state === "current" && isPendingReview && (
            <span className="shrink-0 border border-[#b9d8d3] bg-[#f2f8f6] px-2 py-0.5 text-[10px] font-medium tracking-wide text-[#245e5b] uppercase">
              In progress
            </span>
          )}

          {index < steps.length - 1 && (
            <span
              aria-hidden="true"
              className="hidden h-px min-w-6 flex-1 bg-[#b9d8d3] sm:block"
            />
          )}
        </li>
      ))}
    </ol>
  );
}
