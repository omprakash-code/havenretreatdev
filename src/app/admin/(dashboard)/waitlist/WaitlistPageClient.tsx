"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import ConfirmActionModal from "@/components/admin/drawer/ConfirmActionModal";
import PageHeader from "@/components/admin/page/PageHeader";
import AdminCompactFilters from "@/components/admin/shared/AdminCompactFilters";
import AdminEmptyState from "@/components/admin/shared/AdminEmptyState";
import WaitlistTable from "@/components/admin/waitlist/WaitlistTable";
import WaitlistDetailsDrawer from "@/components/admin/waitlist/WaitlistDetailsDrawer";
import { List, Search } from "@/components/icons";
import type {
  AdminWaitlistEntry,
  AdminWaitlistResponse,
  AdminWaitlistUpdatePayload,
} from "@/types/admin/waitlist";

const PAGE_SIZE = 40;

export default function WaitlistPageClient() {
  const [rows, setRows] = useState<AdminWaitlistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);

  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<AdminWaitlistEntry | null>(null);
  const [drawerMode, setDrawerMode] = useState<"view" | "edit">("view");
  const [drawerSaving, setDrawerSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AdminWaitlistEntry | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const fetchWaitlist = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(PAGE_SIZE),
      });
      if (statusFilter) params.set("status", statusFilter);
      if (search.trim()) params.set("search", search.trim());

      const res = await fetch(`/api/admin/waitlist?${params.toString()}`);
      const json = (await res.json()) as
        | AdminWaitlistResponse
        | { success?: boolean; message?: string };

      if (!res.ok || !json.success || !("data" in json)) {
        throw new Error(
          "message" in json
            ? json.message || "Failed to fetch waitlist submissions."
            : "Failed to fetch waitlist submissions."
        );
      }

      setRows(json.data);
      setTotalPages(json.pagination.totalPages || 1);
      setTotalRecords(json.pagination.total || 0);
    } catch (fetchError) {
      setError(
        fetchError instanceof Error
          ? fetchError.message
          : "Failed to fetch waitlist submissions."
      );
      setRows([]);
      setTotalPages(1);
      setTotalRecords(0);
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter]);

  useEffect(() => {
    void fetchWaitlist();
  }, [fetchWaitlist]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, search]);

  const canPrev = page > 1;
  const canNext = page < totalPages;
  const serialStart = (page - 1) * PAGE_SIZE;
  const hasActiveFilters =
    statusFilter.trim().length > 0 || search.trim().length > 0;

  const summaryText = useMemo(() => {
    if (totalRecords === 0) return "No waitlist submissions found.";
    const start = serialStart + 1;
    const end = Math.min(page * PAGE_SIZE, totalRecords);
    return `Showing ${start}-${end} of ${totalRecords} waitlist submissions`;
  }, [page, serialStart, totalRecords]);

  function handleViewEntry(entry: AdminWaitlistEntry) {
    setSelectedEntry(entry);
    setDrawerMode("view");
    setDrawerOpen(true);
  }

  function handleEditEntry(entry: AdminWaitlistEntry) {
    setSelectedEntry(entry);
    setDrawerMode("edit");
    setDrawerOpen(true);
  }

  function clearFilters() {
    setStatusFilter("");
    setSearch("");
  }

  function openDeleteModal(entry: AdminWaitlistEntry) {
    setDeleteError(null);
    setDeleteTarget(entry);
  }

  function closeDeleteModal() {
    if (deleting) return;
    setDeleteError(null);
    setDeleteTarget(null);
  }

  async function handleDeleteEntry() {
    if (!deleteTarget) return;

    try {
      setDeleting(true);
      setDeleteError(null);

      const res = await fetch(`/api/admin/waitlist/${deleteTarget.id}`, {
        method: "DELETE",
      });
      const json = (await res.json().catch(() => null)) as
        | { success?: boolean; message?: string }
        | null;

      if (!res.ok || !json?.success) {
        setDeleteError(json?.message ?? "Failed to delete waitlist entry.");
        return;
      }

      toast.success("Waitlist entry deleted.");
      setDrawerOpen((prevOpen) => (selectedEntry?.id === deleteTarget.id ? false : prevOpen));
      setSelectedEntry((prev) => (prev?.id === deleteTarget.id ? null : prev));
      setDeleteTarget(null);
      await fetchWaitlist();
    } catch (deleteRequestError) {
      setDeleteError(
        deleteRequestError instanceof Error
          ? deleteRequestError.message
          : "Failed to delete waitlist entry."
      );
    } finally {
      setDeleting(false);
    }
  }

  async function handleSaveFromDrawer(payload: AdminWaitlistUpdatePayload) {
    if (!selectedEntry) return;

    setDrawerSaving(true);
    try {
      const res = await fetch(`/api/admin/waitlist/${selectedEntry.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...payload,
          email: payload.email || null,
          city: payload.city || null,
          locationPreference: payload.locationPreference || null,
          theatrePreference: payload.theatrePreference || null,
          preferredDate: payload.preferredDate || null,
          preferredTime: payload.preferredTime || null,
          peopleCount: payload.peopleCount ? Number(payload.peopleCount) : null,
          occasion: payload.occasion || null,
          notes: payload.notes || null,
        }),
      });
      const json = (await res.json()) as {
        success: boolean;
        message?: string;
        data?: AdminWaitlistEntry;
      };

      if (!res.ok || !json.success || !json.data) {
        throw new Error(json.message ?? "Failed to update waitlist status.");
      }
      const updated = json.data;

      setRows((prev) =>
        prev.map((row) => (row.id === updated.id ? updated : row))
      );
      setSelectedEntry((prev) =>
        prev && prev.id === updated.id ? updated : prev
      );
      toast.success("Waitlist entry updated.");

      if (statusFilter && updated.status !== statusFilter) {
        void fetchWaitlist();
      }
    } catch (updateError) {
      toast.error(
        updateError instanceof Error
          ? updateError.message
          : "Failed to update waitlist entry."
      );
    } finally {
      setDrawerSaving(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Waitlist"
        description="Review and manage waiting list submissions from the public site."
      />

      <AdminCompactFilters
        hasActiveFilters={hasActiveFilters}
        activeFilterCount={statusFilter.trim().length > 0 ? 1 : 0}
        onClearFilters={hasActiveFilters ? clearFilters : undefined}
        searchSlot={
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search reference, name, phone, email, city..."
            className="h-10 w-full rounded-md border border-neutral-200 px-3 text-sm"
          />
        }
        filterSlot={
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-10 w-full rounded-md border border-neutral-200 px-3 text-sm"
          >
            <option value="">All Status</option>
            <option value="NEW">NEW</option>
            <option value="CONTACTED">CONTACTED</option>
            <option value="CLOSED">CLOSED</option>
          </select>
        }
      />

      <div className="mt-4 text-sm text-neutral-500">{summaryText}</div>

      <div className="mt-4">
        {loading ? (
          <div className="rounded-xl border border-dashed border-neutral-300 bg-white p-8 text-sm text-neutral-500">
            Loading waitlist submissions...
          </div>
        ) : error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-5">
            <p className="text-sm font-medium text-red-700">{error}</p>
            <button
              type="button"
              onClick={() => void fetchWaitlist()}
              className="mt-3 rounded-md border border-red-200 bg-white px-3 py-1.5 text-sm text-red-700 hover:bg-red-100"
            >
              Retry
            </button>
          </div>
        ) : rows.length === 0 ? (
          <AdminEmptyState
            className="mt-0"
            title={
              hasActiveFilters
                ? "No waitlist submissions match your filters"
                : "No waitlist submissions found"
            }
            description={
              hasActiveFilters
                ? "Try clearing filters to view available waitlist entries."
                : "New waitlist requests from the website will appear here."
            }
            icon={hasActiveFilters ? <Search size={18} /> : <List size={18} />}
            actionLabel={hasActiveFilters ? "Clear Filters" : undefined}
            onAction={hasActiveFilters ? clearFilters : undefined}
          />
        ) : (
          <WaitlistTable
            data={rows}
            serialStart={serialStart}
            onView={handleViewEntry}
            onEdit={handleEditEntry}
            onDelete={openDeleteModal}
          />
        )}
      </div>

      {totalPages > 1 ? (
        <div className="mt-4 flex flex-col gap-3 rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
          <span className="text-neutral-500">
            Page {page} of {totalPages}
          </span>
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              disabled={!canPrev}
              onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
              className="rounded-md border border-neutral-200 px-3 py-1.5 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Prev
            </button>
            <button
              type="button"
              disabled={!canNext}
              onClick={() => setPage((prev) => prev + 1)}
              className="rounded-md border border-neutral-200 px-3 py-1.5 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      ) : null}

      <WaitlistDetailsDrawer
        key={selectedEntry ? `${selectedEntry.id}-${drawerMode}` : "waitlist-drawer"}
        open={drawerOpen}
        mode={drawerMode}
        saving={drawerSaving}
        onSave={(payload) => void handleSaveFromDrawer(payload)}
        onClose={() => {
          setDrawerOpen(false);
        }}
        entry={selectedEntry}
      />

      <ConfirmActionModal
        open={Boolean(deleteTarget)}
        title="Delete Waitlist Entry"
        description={
          <>
            You are about to delete waitlist entry{" "}
            <strong>{deleteTarget?.reference ?? "this submission"}</strong>. This action
            cannot be undone.
          </>
        }
        confirmLabel="Yes, Delete Entry"
        loadingLabel="Deleting..."
        loading={deleting}
        error={deleteError}
        onClose={closeDeleteModal}
        onConfirm={() => void handleDeleteEntry()}
      />
    </>
  );
}
