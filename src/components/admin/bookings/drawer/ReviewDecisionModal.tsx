"use client";

import { useState } from "react";

import ConfirmActionModal from "@/components/admin/drawer/ConfirmActionModal";
import {
  REJECTION_REASON_MAX_LENGTH,
  REJECTION_REASON_MIN_LENGTH,
} from "@/lib/booking-status";

export type ReviewDecision = "approve" | "reject";

type ReviewDecisionModalProps = {
  open: boolean;
  decision: ReviewDecision;
  bookingRef: string;
  /** Drives the "approval does not record payment" warning. */
  isUnpaid?: boolean;
  loading?: boolean;
  error?: string | null;
  onClose: () => void;
  /** Reason is always present for a rejection and always empty for an approval. */
  onConfirm: (input: { reason: string; approvalNotes: string }) => void;
};

/**
 * The caller remounts this with a fresh `key` per decision, so a reason typed
 * for one booking never carries into the next modal.
 */
export default function ReviewDecisionModal({
  open,
  decision,
  bookingRef,
  isUnpaid = false,
  loading = false,
  error,
  onClose,
  onConfirm,
}: ReviewDecisionModalProps) {
  const [reason, setReason] = useState("");
  const [approvalNotes, setApprovalNotes] = useState("");

  const isReject = decision === "reject";
  const trimmedReason = reason.trim();
  const reasonTooShort = trimmedReason.length < REJECTION_REASON_MIN_LENGTH;

  return (
    <ConfirmActionModal
      open={open}
      tone={isReject ? "destructive" : "primary"}
      title={isReject ? "Reject booking request" : "Approve booking request"}
      description={
        isReject
          ? `Reject ${bookingRef}. This releases the reserved date and any applied coupons.`
          : `Approve ${bookingRef}. The date stays reserved and the customer is notified.`
      }
      confirmLabel={isReject ? "Reject request" : "Approve request"}
      loadingLabel={isReject ? "Rejecting..." : "Approving..."}
      cancelLabel="Keep pending"
      loading={loading}
      confirmDisabled={isReject && reasonTooShort}
      error={error}
      onClose={onClose}
      onConfirm={() =>
        onConfirm({ reason: trimmedReason, approvalNotes: approvalNotes.trim() })
      }
    >
      {isReject ? (
        <div>
          <label
            htmlFor="reject-reason"
            className="block text-sm font-medium text-slate-700"
          >
            Reason <span className="text-red-600">*</span>
          </label>
          <textarea
            id="reject-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            maxLength={REJECTION_REASON_MAX_LENGTH}
            rows={4}
            disabled={loading}
            aria-required="true"
            aria-invalid={reasonTooShort}
            aria-describedby="reject-reason-help"
            className="mt-1.5 w-full rounded-md border border-neutral-200 px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-[#347f7c] focus:ring-1 focus:ring-[#347f7c] disabled:cursor-not-allowed disabled:opacity-50"
            placeholder="Explain why this request cannot be accepted."
          />
          <p
            id="reject-reason-help"
            className="mt-1.5 flex items-center justify-between gap-2 text-xs text-slate-500"
          >
            <span>
              This reason may be shared with the customer. Keep it clear and
              professional.
            </span>
            <span className="shrink-0 tabular-nums">
              {trimmedReason.length}/{REJECTION_REASON_MAX_LENGTH}
            </span>
          </p>
        </div>
      ) : (
        <div>
          <label
            htmlFor="approval-notes"
            className="block text-sm font-medium text-slate-700"
          >
            Notes <span className="text-slate-400">(optional)</span>
          </label>
          <textarea
            id="approval-notes"
            value={approvalNotes}
            onChange={(event) => setApprovalNotes(event.target.value)}
            rows={3}
            disabled={loading}
            className="mt-1.5 w-full rounded-md border border-neutral-200 px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-[#347f7c] focus:ring-1 focus:ring-[#347f7c] disabled:cursor-not-allowed disabled:opacity-50"
            placeholder="Internal context for this approval."
          />

          {isUnpaid && (
            <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">
              Approval does not record payment. This booking stays{" "}
              <span className="font-semibold">Unpaid</span> until you record a
              payment separately.
            </p>
          )}
        </div>
      )}
    </ConfirmActionModal>
  );
}
