"use client";

import { useEffect, useState, useCallback } from "react";
import AdminTheatreCard from "./AdminTheatreCard";
import type { AdminTheatre } from "@/types/admin/theatre-admin";
import { toast } from "sonner";
import ConfirmActionModal from "@/components/admin/drawer/ConfirmActionModal";
import AdminEmptyState from "@/components/admin/shared/AdminEmptyState";
import { Monitor } from "@/components/icons";
import { invalidateCouponRuleOptionsCache } from "@/components/admin/coupons/CouponDrawer";

export default function AdminTheatreList({
  onEdit,
  onAdd,
}: {
  onEdit: (theatre: AdminTheatre) => void;
  onAdd?: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [theatres, setTheatres] = useState<AdminTheatre[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<AdminTheatre | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  /* =========================
     FETCH THEATRES
  ========================= */
  const fetchTheatres = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/theatres");
      const json = await res.json();

      if (json.success) {
        setTheatres(json.data);
      } else {
        toast.error("Failed to load theatres");
      }
    } catch (error) {
      console.error("FETCH_THEATRES_ERROR", error);
      toast.error("Something went wrong while loading theatres");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTheatres();
  }, [fetchTheatres]);

  /* =========================
     DELETE THEATRE
  ========================= */
  function openDeleteModal(theatre: AdminTheatre) {
    setDeleteError(null);
    setDeleteTarget(theatre);
  }

  function closeDeleteModal() {
    if (deleting) return;
    setDeleteError(null);
    setDeleteTarget(null);
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;

    try {
      setDeleting(true);
      setDeleteError(null);

      const res = await fetch(
        `/api/admin/theatres?id=${deleteTarget.id}`,
        { method: "DELETE" }
      );

      const data = await res.json();
      if (!res.ok) {
        setDeleteError(data?.message || "Delete failed");
        return;
      }

      toast.success("Theatre deleted successfully");
      invalidateCouponRuleOptionsCache();
      setDeleteTarget(null);
      await fetchTheatres();
    } catch (error) {
      console.error("DELETE_THEATRE_UI_ERROR", error);
      setDeleteError(
        error instanceof Error
          ? error.message
          : "Failed to delete theatre"
      );
    } finally {
      setDeleting(false);
    }
  }

  /* =========================
     TOGGLE ACTIVE (OPTIMISTIC)
  ========================= */
  async function handleToggleActive(theatre: AdminTheatre) {
    // Optimistic update
    setTheatres((prev) =>
      prev.map((t) =>
        t.id === theatre.id
          ? { ...t, isActive: !t.isActive }
          : t
      )
    );

    try {
      const res = await fetch("/api/admin/theatres/toggle", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: theatre.id,
          isActive: !theatre.isActive,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message);

      toast.success("Status updated");
      invalidateCouponRuleOptionsCache();
    } catch (error) {
      // Revert on failure
      setTheatres((prev) =>
        prev.map((t) =>
          t.id === theatre.id ? theatre : t
        )
      );

      console.error("TOGGLE_ACTIVE_ERROR", error);
      toast.error("Failed to update status");
    }
  }

  /* =========================
     UI STATES
  ========================= */
  let content: React.ReactNode;
  if (loading) {
    content = (
      <div className="col-span-full py-20 text-center text-sm text-neutral-500">
        Loading theatres…
      </div>
    );
  } else if (theatres.length === 0) {
    content = (
      <div className="col-span-full">
        <AdminEmptyState
          className="mt-0"
          title="No theatres created yet"
          description="Add your first theatre to configure pricing, slots and availability."
          icon={<Monitor size={18} />}
          actionLabel={onAdd ? "Add Theatre" : undefined}
          onAction={onAdd}
        />
      </div>
    );
  } else {
    content = theatres.map((theatre) => (
      <AdminTheatreCard
        key={theatre.id}
        theatre={theatre}
        onEdit={onEdit}
        onDelete={openDeleteModal}
        onToggleActive={handleToggleActive}
      />
    ));
  }

  /* =========================
     RENDER
  ========================= */
  return (
    <>
      {content}

      <ConfirmActionModal
        open={Boolean(deleteTarget)}
        title="Delete Theatre"
        description={
          <>
            You are about to delete theatre{" "}
            <strong>{deleteTarget?.name ?? "this theatre"}</strong>. This action
            cannot be undone.
          </>
        }
        confirmLabel="Yes, Delete Theatre"
        loadingLabel="Deleting..."
        loading={deleting}
        error={deleteError}
        onClose={closeDeleteModal}
        onConfirm={() => void handleDeleteConfirm()}
      />
    </>
  );
}
