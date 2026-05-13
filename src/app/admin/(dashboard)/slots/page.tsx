"use client";

import { useEffect, useMemo, useState } from "react";
import PageHeader from "@/components/admin/page/PageHeader";
import SlotFilters from "@/components/admin/slots/SlotFilters";
import SlotsTable from "@/components/admin/slots/SlotsTable";
import SlotDrawer from "@/components/admin/slots/read-drawer/SlotDetailsDrawer";
import type { AdminSlot } from "@/types/admin/slot-admin";
import type { SlotDatePreset } from "@/types/admin/slot-filters";
import SlotDetailsDrawer from "@/components/admin/slots/read-drawer/SlotDetailsDrawer";
import EditSlotDrawer from "@/components/admin/slots/edit-drawer/EditSlotDrawer";
import { toDateKey } from "@/lib/date";
import { formatSlotTime } from "@/lib/formatters";
import AdminEmptyState from "@/components/admin/shared/AdminEmptyState";
import { Calendar, Plus, Search } from "@/components/icons";
import AddSlotDrawer from "@/components/admin/slots/create-drawer/AddSlotDrawer";
import ConfirmActionModal from "@/components/admin/drawer/ConfirmActionModal";
import { toast } from "sonner";
import type {
  SlotCreateLocationOption,
  SlotCreateTheatreOption,
} from "@/components/admin/slots/create-drawer/AddSlotDetails";

/* -----------------------------
   Date preset helper
------------------------------ */
const applyDatePreset = (
  slotDate: string, // YYYY-MM-DD
  preset: SlotDatePreset,
  todayKey: number
) => {
  const slotKey = toDateKey(slotDate);
  const diff = (slotKey - todayKey) / 86400000;

  switch (preset) {
    case "TODAY":
      return diff === 0;
    case "TOMORROW":
      return diff === 1;
    case "NEXT_7":
      return diff >= 0 && diff <= 7;
    case "NEXT_30":
      return diff >= 0 && diff <= 30;
    default:
      return true;
  }
};


export default function SlotsPage() {
  const [slots, setSlots] = useState<AdminSlot[]>([]);
  const [locationOptions, setLocationOptions] = useState<SlotCreateLocationOption[]>([]);
  const [theatreOptions, setTheatreOptions] = useState<SlotCreateTheatreOption[]>([]);
  const [loading, setLoading] = useState(true);

  const [preset, setPreset] = useState<SlotDatePreset | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [theatre, setTheatre] = useState("");
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<AdminSlot | null>(null);

  const [viewSlot, setViewSlot] = useState<AdminSlot | null>(null);
  const [editSlot, setEditSlot] = useState<AdminSlot | null>(null);
  const [addSlotOpen, setAddSlotOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AdminSlot | null>(null);
  const [deletingSlot, setDeletingSlot] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);


  const handleViewSlot = (slot: AdminSlot) => {
    setSelectedSlot(slot);
    setDrawerOpen(true);
  };


  /* -----------------------------
     Fetch slots
  ------------------------------ */
  useEffect(() => {
    async function fetchSlots() {
      try {
        const todayKey = new Intl.DateTimeFormat("en-CA", {
          timeZone: "Asia/Kolkata",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(new Date());

        const [slotsRes, theatresRes, locationsRes] = await Promise.all([
          fetch(`/api/admin/slots?fromDate=${encodeURIComponent(todayKey)}`),
          fetch("/api/admin/theatres"),
          fetch("/api/admin/locations?page=1&pageSize=100&isActive=true"),
        ]);

        const slotsJson = await slotsRes.json();
        if (slotsJson.success) setSlots(slotsJson.data);

        const theatresJson = await theatresRes.json();
        if (theatresJson.success) {
          setTheatreOptions(
            (
              theatresJson.data as {
                id: string;
                name: string;
                location: { id: string; name: string };
              }[]
            ).map((theatre) => ({
              id: theatre.id,
              name: theatre.name,
              locationId: theatre.location.id,
              locationName: theatre.location.name,
            }))
          );
        }

        const locationsJson = await locationsRes.json();
        if (locationsJson.success) {
          setLocationOptions(
            (
              locationsJson.data as {
                id: string;
                name: string;
              }[]
            ).map((location) => ({
              id: location.id,
              name: location.name,
            }))
          );
        }
      } finally {
        setLoading(false);
      }
    }

    fetchSlots();
  }, []);

  /* -----------------------------
     Derived options
  ------------------------------ */
  const theatres = useMemo(
    () =>
      theatreOptions.length > 0
        ? theatreOptions.map((theatre) => theatre.name)
        : Array.from(new Set(slots.map((slot) => slot.theatre.name))),
    [slots, theatreOptions]
  );

  /* -----------------------------
     Apply filters + sorting
  ------------------------------ */
  const filteredSlots = useMemo(() => {
    // Single source of "today" (string-based)
    const todayKey = toDateKey(new Date());

    return slots
      .filter((s) => {
        const slotDate = s.date; // YYYY-MM-DD (string)

        // Highest priority: manually selected date
        if (selectedDate) {
          if (toDateKey(slotDate) !== toDateKey(selectedDate)) return false;
        }

        // Preset only when no manual date
        if (!selectedDate && preset) {
          if (!applyDatePreset(slotDate, preset, todayKey)) return false;
        }

        if (theatre && s.theatre.name !== theatre) return false;
        if (status && s.status !== status) return false;

        if (search) {
          const q = search.toLowerCase();
          const match =
            s.startTime.includes(q) ||
            s.endTime.includes(q) ||
            s.theatre.name.toLowerCase().includes(q);

          if (!match) return false;
        }

        return true;
      })
      .sort((a, b) => {
        // Date sort (safe string → Date conversion)
        const dateDiff = toDateKey(a.date) - toDateKey(b.date);

        if (dateDiff !== 0) return dateDiff;
        const theatreDiff = a.theatre.name.localeCompare(b.theatre.name, "en", {
          numeric: true,
          sensitivity: "base",
        });
        if (theatreDiff !== 0) return theatreDiff;
        return a.startTime.localeCompare(b.startTime);
      });
  }, [slots, preset, selectedDate, theatre, status, search]);


  const handleSlotUpdated = (updated: AdminSlot) => {
    setSlots((prev) =>
      prev.map((s) => (s.id === updated.id ? updated : s))
    );
  };

  const handleSlotCreated = (created: AdminSlot) => {
    setSlots((prev) => {
      if (prev.some((slot) => slot.id === created.id)) return prev;
      return [...prev, created];
    });
  };

  function clearAllFilters() {
    setPreset(null);
    setSelectedDate(null);
    setTheatre("");
    setStatus("");
    setSearch("");
  }

  const hasActiveFilters =
    Boolean(preset) ||
    Boolean(selectedDate) ||
    theatre.trim().length > 0 ||
    status.trim().length > 0 ||
    search.trim().length > 0;

  function openDeleteModal(slot: AdminSlot) {
    setDeleteTarget(slot);
    setDeleteError(null);
  }

  function closeDeleteModal() {
    if (deletingSlot) return;
    setDeleteTarget(null);
    setDeleteError(null);
  }

  async function handleDeleteSlot() {
    if (!deleteTarget) return;

    setDeletingSlot(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/admin/slots/${deleteTarget.id}`, {
        method: "DELETE",
      });
      const json = await res.json();

      if (!res.ok || !json?.success) {
        throw new Error(json?.message || "Failed to delete slot");
      }

      setSlots((prev) => prev.filter((slot) => slot.id !== deleteTarget.id));
      toast.success("Slot deleted successfully");
      closeDeleteModal();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to delete slot";
      setDeleteError(message);
      toast.error("Failed to delete slot", { description: message });
    } finally {
      setDeletingSlot(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Slots"
        description="Manage generated slots, availability, and status."
        inlineActions
        actions={
          <button
            type="button"
            onClick={() => setAddSlotOpen(true)}
            className="inline-flex items-center justify-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            <Plus size={16} />
            Add Slot
          </button>
        }
      />

      <SlotFilters
        preset={preset}
        setPreset={(p) => {
          setPreset(p);
          if (p) setSelectedDate(null); // clear manual date
        }}
        selectedDate={selectedDate}
        setSelectedDate={setSelectedDate}
        theatre={theatre}
        setTheatre={setTheatre}
        status={status}
        setStatus={setStatus}
        search={search}
        setSearch={setSearch}
        theatres={theatres}
        onClearFilters={clearAllFilters}
      />

      {loading ? (
        <div className="py-10 text-sm text-neutral-500">
          Loading slots…
        </div>
      ) : filteredSlots.length === 0 ? (
        <AdminEmptyState
          title={hasActiveFilters ? "No slots match your filters" : "No slots available"}
          description={
            hasActiveFilters
              ? "Try clearing filters to see available slot records."
              : "No generated slots found yet. Generate or sync slots to list them here."
          }
          icon={hasActiveFilters ? <Search size={18} /> : <Calendar size={18} />}
          actionLabel={hasActiveFilters ? "Clear Filters" : undefined}
          onAction={hasActiveFilters ? clearAllFilters : undefined}
        />
      ) : (
        <SlotsTable
          data={filteredSlots}
          onView={handleViewSlot}
          onEdit={(slot) => setEditSlot(slot)}
          onDelete={openDeleteModal}
        />
      )}

      <SlotDrawer
        open={drawerOpen}
        onClose={() => {
          setDrawerOpen(false);
          setSelectedSlot(null);
        }}
        slot={selectedSlot}
      />

      {/* View Slot Drawer */}
      <SlotDetailsDrawer
        open={!!viewSlot}
        slot={viewSlot}
        onClose={() => setViewSlot(null)}
      />

      {/* Edit Slot Drawer */}
      <EditSlotDrawer
        open={!!editSlot}
        slotId={editSlot ? editSlot.id : null}
        slot={editSlot}
        onClose={() => setEditSlot(null)}
        onUpdated={handleSlotUpdated}
      />

      <AddSlotDrawer
        open={addSlotOpen}
        onClose={() => setAddSlotOpen(false)}
        locations={locationOptions}
        theatres={theatreOptions}
        onCreated={handleSlotCreated}
      />

      <ConfirmActionModal
        open={Boolean(deleteTarget)}
        title="Confirm Slot Deletion"
        description={
          <>
            You are about to delete this custom slot for{" "}
            <strong>{deleteTarget?.theatre.name ?? "selected theatre"}</strong>{" "}
            on <strong>{deleteTarget?.date ?? "--"}</strong> at{" "}
            <strong>
              {deleteTarget
                ? formatSlotTime(deleteTarget.startTime, deleteTarget.endTime)
                : "--"}
            </strong>
            . This action cannot be undone.
          </>
        }
        confirmLabel="Yes, Delete Slot"
        loadingLabel="Deleting..."
        loading={deletingSlot}
        error={deleteError}
        onClose={closeDeleteModal}
        onConfirm={() => void handleDeleteSlot()}
      />
    </>
  );
}
