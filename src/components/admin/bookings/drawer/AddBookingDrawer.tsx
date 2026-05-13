"use client";

import AdminDrawer from "@/components/admin/drawer/AdminDrawer";
import { AdminAddBookingForm } from "@/components/admin/bookings/add/AdminAddBookingForm";

type AddBookingDrawerProps = {
  open: boolean;
  onClose: () => void;
  mode?: "create" | "edit";
  bookingId?: string | null;
  onCreated?: (bookingRef: string) => void;
  onUpdated?: (bookingId: string) => void;
};

export default function AddBookingDrawer({
  open,
  onClose,
  mode = "create",
  bookingId = null,
  onCreated,
  onUpdated,
}: AddBookingDrawerProps) {
  const isEditMode = mode === "edit";
  const editButtonCursorClass = isEditMode
    ? "[&_button:not(:disabled)]:cursor-pointer"
    : "";

  return (
    <AdminDrawer
      open={open}
      onClose={onClose}
      title={isEditMode ? "Edit Booking" : "Add Booking"}
      description={
        isEditMode
          ? "Update booking details, slot, products, and payment status."
          : "Create a booking with customer details, selected add-ons, and payment details."
      }
      width={1180}
    >
      <div className={editButtonCursorClass}>
        <AdminAddBookingForm
          embedded
          mode={mode}
          bookingId={bookingId}
          onCreated={onCreated}
          onUpdated={onUpdated}
        />
      </div>
    </AdminDrawer>
  );
}
