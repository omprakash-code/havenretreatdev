"use client";

import { useState } from "react";
import { toast } from "sonner";

import PaymentLifecycleBadge from "@/components/admin/bookings/PaymentLifecycleBadge";
import ReviewSlaBadge from "@/components/admin/bookings/ReviewSlaBadge";
import ReviewDecisionModal, {
  type ReviewDecision,
} from "@/components/admin/bookings/drawer/ReviewDecisionModal";
import { derivePaymentLifecycle } from "@/lib/booking-status";
import type { AdminBooking } from "@/types/admin/booking-admin";

/**
 * Approve/reject bar for a booking awaiting review. Approving and rejecting are
 * the only two decisions here; recording payment stays in the payment section,
 * because approval and payment are independent.
 */
export default function BookingReviewActions({
  booking,
  onReviewed,
}: {
  booking: AdminBooking;
  onReviewed?: () => void;
}) {
  const [decision, setDecision] = useState<ReviewDecision | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (booking.bookingStatus !== "PENDING_REVIEW") return null;

  const isUnpaid =
    derivePaymentLifecycle({
      paymentStatus: booking.paymentStatus,
      advancePaid: booking.pricing.advancePaid,
      remainingPayable: booking.pricing.remainingPayable,
    }) === "UNPAID";

  const submitDecision = async (input: {
    reason: string;
    approvalNotes: string;
  }) => {
    if (!decision) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/admin/bookings/${booking.id}/${decision}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            decision === "reject"
              ? { reason: input.reason }
              : { approvalNotes: input.approvalNotes }
          ),
        }
      );

      const json = await res.json().catch(() => null);

      if (!res.ok || !json?.success) {
        setError(
          json?.message ??
            `Unable to ${decision} this booking. Please try again.`
        );
        return;
      }

      toast.success(
        decision === "approve"
          ? `Booking ${booking.bookingRef} approved.`
          : `Booking ${booking.bookingRef} rejected.`
      );
      setDecision(null);
      onReviewed?.();
    } catch {
      setError(`Unable to ${decision} this booking. Please try again.`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <section className="rounded-lg border border-amber-200 bg-amber-50/60 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              Waiting for your decision
            </h3>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <ReviewSlaBadge submittedAt={booking.reviewSubmittedAt} />
              <PaymentLifecycleBadge
                paymentStatus={booking.paymentStatus}
                advancePaid={booking.pricing.advancePaid}
                remainingPayable={booking.pricing.remainingPayable}
              />
              <span
                className={`inline-flex h-6 items-center rounded-full px-2.5 py-1 text-xs font-medium ${
                  booking.agreementSigned
                    ? "border border-emerald-300 bg-emerald-50 text-emerald-800"
                    : "border border-rose-300 bg-rose-50 text-rose-800"
                }`}
              >
                {booking.agreementSigned
                  ? "Agreement signed"
                  : "Agreement missing"}
              </span>
            </div>
          </div>

          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={() => setDecision("reject")}
              className="h-9 cursor-pointer rounded-md border border-red-200 bg-red-50 px-3 text-sm font-medium text-red-700 transition hover:bg-red-100"
            >
              Reject
            </button>
            <button
              type="button"
              onClick={() => setDecision("approve")}
              className="h-9 cursor-pointer rounded-md border border-[#347f7c] bg-[#347f7c] px-3 text-sm font-medium text-white transition hover:bg-[#2f7370]"
            >
              Approve
            </button>
          </div>
        </div>
      </section>

      <ReviewDecisionModal
        // Fresh state per decision: a typed reason never leaks into the next modal.
        key={`${booking.id}-${decision ?? "closed"}`}
        open={decision !== null}
        decision={decision ?? "approve"}
        bookingRef={booking.bookingRef}
        isUnpaid={isUnpaid}
        loading={loading}
        error={error}
        onClose={() => {
          if (loading) return;
          setDecision(null);
          setError(null);
        }}
        onConfirm={submitDecision}
      />
    </>
  );
}
