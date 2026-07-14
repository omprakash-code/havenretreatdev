"use client";

import { useState } from "react";
import { toast } from "sonner";

import ReviewSlaBadge from "@/components/admin/bookings/ReviewSlaBadge";
import ReviewDecisionModal, {
  type ReviewDecision,
} from "@/components/admin/bookings/drawer/ReviewDecisionModal";
import { derivePaymentLifecycle } from "@/lib/booking-status";
import type { AdminBooking } from "@/types/admin/booking-admin";

/**
 * One-click "Mark Completed" bar for an approved booking whose event has
 * ended. Completion only advances the lifecycle — payment, stock, and coupons
 * are untouched.
 */
function BookingCompleteAction({
  booking,
  onCompleted,
}: {
  booking: AdminBooking;
  onCompleted?: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const markCompleted = async () => {
    if (loading) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/admin/bookings/${booking.id}/complete`, {
        method: "POST",
      });
      const json = await res.json().catch(() => null);

      if (!res.ok || !json?.success) {
        setError(
          json?.message ?? "Unable to complete this booking. Please try again."
        );
        return;
      }

      toast.success(`Booking ${booking.bookingRef} marked completed.`);
      onCompleted?.();
    } catch {
      setError("Unable to complete this booking. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">
            Event finished
          </h3>
          <p className="mt-0.5 text-xs text-slate-500">
            Mark this booking completed to close out its lifecycle. Payment
            records stay as they are.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void markCompleted()}
          disabled={loading}
          className="h-9 shrink-0 cursor-pointer rounded-md border border-[#347f7c] bg-[#347f7c] px-3 text-sm font-medium text-white transition hover:bg-[#2f7370] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Completing..." : "Mark Completed"}
        </button>
      </div>
      {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
    </section>
  );
}

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

  const eventEnded = booking.endsAtUtc
    ? new Date(booking.endsAtUtc).getTime() <= Date.now()
    : false;

  if (booking.bookingStatus === "APPROVED" && eventEnded) {
    return <BookingCompleteAction booking={booking} onCompleted={onReviewed} />;
  }

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
      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-slate-900">
            Waiting for your decision
          </h3>
          <ReviewSlaBadge
            submittedAt={booking.reviewSubmittedAt}
            className="shrink-0"
          />
        </div>

        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => setDecision("reject")}
            className="h-9 cursor-pointer rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 transition hover:border-red-300 hover:text-red-700"
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
