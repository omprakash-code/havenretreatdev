"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";

import { downloadBookingTicketPdf } from "@/components/booking/success/pdf/downloadBookingTicketPdf";
import { mapAdminBookingToSuccessData } from "@/components/booking/success/mapAdminBookingToSuccessData";
import type { AdminBooking } from "@/types/admin/booking-admin";

type RefreshOptions = { resetToFirstPage?: boolean };

type UseAdminBookingActionsOptions = {
  /** Reloads the list and returns the fresh rows, so a saved booking can be reopened. */
  refresh: (options?: RefreshOptions) => Promise<AdminBooking[]>;
  /** Reopens the details drawer on the booking that was just created or edited. */
  onBookingSaved?: (booking: AdminBooking) => void;
  /** Closes the details drawer for a booking that no longer exists. */
  onBookingDeleted?: () => void;
};

/**
 * Row actions shared by every admin booking list: edit, soft delete, and PDF
 * download. A pending request is editable like any other booking — the admin
 * often has to move a date or time before they can approve it.
 */
export default function useAdminBookingActions({
  refresh,
  onBookingSaved,
  onBookingDeleted,
}: UseAdminBookingActionsOptions) {
  const [downloadingBookingId, setDownloadingBookingId] = useState<string | null>(
    null
  );
  const [formDrawerOpen, setFormDrawerOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [editingBookingId, setEditingBookingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminBooking | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleDownloadPdf = useCallback(
    async (booking: AdminBooking) => {
      if (downloadingBookingId) return;

      setDownloadingBookingId(booking.id);
      try {
        const res = await fetch(
          `/api/admin/bookings/${booking.id}?view=drawer`,
          { cache: "no-store" }
        );
        const json = (await res.json().catch(() => null)) as
          | {
              success?: boolean;
              data?:
                | (AdminBooking & {
                    locationName: string;
                    theatreImage?: string | null;
                    decorationRequired?: boolean;
                  })
                | null;
            }
          | null;

        if (!res.ok || !json?.success || !json.data) {
          throw new Error("Failed to load booking PDF data.");
        }

        await downloadBookingTicketPdf(mapAdminBookingToSuccessData(json.data));
        toast.success("Booking PDF downloaded.");
      } catch {
        toast.error("Unable to download booking PDF right now.");
      } finally {
        setDownloadingBookingId(null);
      }
    },
    [downloadingBookingId]
  );

  const openCreateForm = useCallback(() => {
    setFormMode("create");
    setEditingBookingId(null);
    setFormDrawerOpen(true);
  }, []);

  const openEditForm = useCallback((booking: AdminBooking) => {
    setFormMode("edit");
    setEditingBookingId(booking.id);
    setFormDrawerOpen(true);
  }, []);

  const closeForm = useCallback(() => {
    setFormDrawerOpen(false);
    setFormMode("create");
    setEditingBookingId(null);
  }, []);

  const openDeleteModal = useCallback((booking: AdminBooking) => {
    setDeleteError(null);
    setDeleteTarget(booking);
  }, []);

  const closeDeleteModal = useCallback(() => {
    if (deleting) return;
    setDeleteError(null);
    setDeleteTarget(null);
  }, [deleting]);

  const handleCreated = useCallback(
    async (bookingRef: string) => {
      closeForm();
      const rows = await refresh({ resetToFirstPage: true });
      const created = rows.find((row) => row.bookingRef === bookingRef);
      if (created) onBookingSaved?.(created);
    },
    [closeForm, onBookingSaved, refresh]
  );

  const handleUpdated = useCallback(
    async (bookingId: string) => {
      closeForm();
      const rows = await refresh();
      const updated = rows.find((row) => row.id === bookingId);
      if (updated) onBookingSaved?.(updated);
    },
    [closeForm, onBookingSaved, refresh]
  );

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return;

    try {
      setDeleting(true);
      setDeleteError(null);

      const res = await fetch(`/api/admin/bookings/${deleteTarget.id}`, {
        method: "DELETE",
      });
      const json = (await res.json().catch(() => null)) as
        | { success?: boolean; message?: string }
        | null;

      if (!res.ok || !json?.success) {
        setDeleteError(json?.message ?? "Failed to delete booking.");
        return;
      }

      toast.success("Booking deleted.");
      await refresh();
      setDeleteTarget(null);
      onBookingDeleted?.();
    } catch (error) {
      setDeleteError(
        error instanceof Error ? error.message : "Failed to delete booking."
      );
    } finally {
      setDeleting(false);
    }
  }, [deleteTarget, onBookingDeleted, refresh]);

  return {
    /** Spread onto BookingsTable. */
    tableActionProps: {
      onEdit: openEditForm,
      onDelete: openDeleteModal,
      onDownloadPdf: handleDownloadPdf,
      downloadingBookingId,
    },
    /** Spread onto AddBookingDrawer. */
    formDrawerProps: {
      open: formDrawerOpen,
      mode: formMode,
      bookingId: editingBookingId,
      onClose: closeForm,
      onCreated: handleCreated,
      onUpdated: handleUpdated,
    },
    /** Spread onto the delete ConfirmActionModal, minus its copy. */
    deleteModalProps: {
      open: Boolean(deleteTarget),
      loading: deleting,
      error: deleteError,
      onClose: closeDeleteModal,
      onConfirm: () => void handleDelete(),
    },
    deleteTarget,
    openCreateForm,
  };
}
