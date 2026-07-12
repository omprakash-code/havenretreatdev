"use client";

import type { ReactNode } from "react";

import ConfirmActionModal from "@/components/admin/drawer/ConfirmActionModal";
import type { AdminBooking } from "@/types/admin/booking-admin";

/** Delete confirmation shared by every admin booking list. */
export default function BookingDeleteModal({
  booking,
  open,
  loading,
  error,
  onClose,
  onConfirm,
}: {
  booking: AdminBooking | null;
  open: boolean;
  loading: boolean;
  error: ReactNode;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <ConfirmActionModal
      open={open}
      title="Delete Booking"
      description={
        <>
          You are about to delete booking{" "}
          <strong>{booking?.bookingRef ?? "this booking"}</strong>. This action
          cannot be undone.
        </>
      }
      confirmLabel="Yes, Delete Booking"
      loadingLabel="Deleting..."
      loading={loading}
      error={error}
      onClose={onClose}
      onConfirm={onConfirm}
    />
  );
}
