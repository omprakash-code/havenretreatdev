"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import ContactDetailsDrawer from "@/components/admin/contact/ContactDetailsDrawer";
import ContactEditDrawer from "@/components/admin/contact/ContactEditDrawer";
import ContactTable from "@/components/admin/contact/ContactTable";
import ConfirmActionModal from "@/components/admin/drawer/ConfirmActionModal";
import PageHeader from "@/components/admin/page/PageHeader";
import AdminCompactFilters from "@/components/admin/shared/AdminCompactFilters";
import AdminEmptyState from "@/components/admin/shared/AdminEmptyState";
import { MessageCircle, Search } from "@/components/icons";
import type {
  AdminContactInquiry,
  AdminContactInquiryEditPayload,
  AdminContactInquiryResponse,
  AdminContactInquiryUpdatePayload,
} from "@/types/admin/contact";

const PAGE_SIZE = 40;

export default function ContactPageClient() {
  const [rows, setRows] = useState<AdminContactInquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);

  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<"view" | "edit">("view");
  const [drawerSession, setDrawerSession] = useState(0);
  const [selectedInquiry, setSelectedInquiry] = useState<AdminContactInquiry | null>(
    null
  );
  const [drawerSaving, setDrawerSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AdminContactInquiry | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const fetchInquiries = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(PAGE_SIZE),
      });
      if (statusFilter) params.set("status", statusFilter);
      if (search.trim()) params.set("search", search.trim());

      const res = await fetch(`/api/admin/contact?${params.toString()}`);
      const json = (await res.json()) as
        | AdminContactInquiryResponse
        | { success?: boolean; message?: string };

      if (!res.ok || !json.success || !("data" in json)) {
        throw new Error(
          "message" in json
            ? json.message || "Failed to fetch contact inquiries."
            : "Failed to fetch contact inquiries."
        );
      }

      setRows(json.data);
      setTotalPages(json.pagination.totalPages || 1);
      setTotalRecords(json.pagination.total || 0);
    } catch (fetchError) {
      setError(
        fetchError instanceof Error
          ? fetchError.message
          : "Failed to fetch contact inquiries."
      );
      setRows([]);
      setTotalPages(1);
      setTotalRecords(0);
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter]);

  useEffect(() => {
    void fetchInquiries();
  }, [fetchInquiries]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, search]);

  const canPrev = page > 1;
  const canNext = page < totalPages;
  const serialStart = (page - 1) * PAGE_SIZE;
  const hasActiveFilters =
    statusFilter.trim().length > 0 || search.trim().length > 0;

  const summaryText = useMemo(() => {
    if (totalRecords === 0) return "No contact inquiries found.";
    const start = serialStart + 1;
    const end = Math.min(page * PAGE_SIZE, totalRecords);
    return `Showing ${start}-${end} of ${totalRecords} contact inquiries`;
  }, [page, serialStart, totalRecords]);

  function handleViewInquiry(inquiry: AdminContactInquiry) {
    setSelectedInquiry(inquiry);
    setDrawerMode("view");
    setDrawerSession((prev) => prev + 1);
    setDrawerOpen(true);
  }

  function handleEditInquiry(inquiry: AdminContactInquiry) {
    setSelectedInquiry(inquiry);
    setDrawerMode("edit");
    setDrawerSession((prev) => prev + 1);
    setDrawerOpen(true);
  }

  function clearFilters() {
    setStatusFilter("");
    setSearch("");
  }

  function openDeleteModal(inquiry: AdminContactInquiry) {
    setDeleteError(null);
    setDeleteTarget(inquiry);
  }

  function closeDeleteModal() {
    if (deleting) return;
    setDeleteError(null);
    setDeleteTarget(null);
  }

  async function handleDeleteInquiry() {
    if (!deleteTarget) return;

    try {
      setDeleting(true);
      setDeleteError(null);

      const res = await fetch(`/api/admin/contact/${deleteTarget.id}`, {
        method: "DELETE",
      });
      const json = (await res.json().catch(() => null)) as
        | { success?: boolean; message?: string }
        | null;

      if (!res.ok || !json?.success) {
        setDeleteError(json?.message ?? "Failed to delete contact inquiry.");
        return;
      }

      toast.success("Contact inquiry deleted.");
      setDrawerOpen((prevOpen) => (selectedInquiry?.id === deleteTarget.id ? false : prevOpen));
      setSelectedInquiry((prev) => (prev?.id === deleteTarget.id ? null : prev));
      setDeleteTarget(null);
      await fetchInquiries();
    } catch (deleteRequestError) {
      setDeleteError(
        deleteRequestError instanceof Error
          ? deleteRequestError.message
          : "Failed to delete contact inquiry."
      );
    } finally {
      setDeleting(false);
    }
  }

  async function handleSaveFromDrawer(payload: AdminContactInquiryEditPayload) {
    if (!selectedInquiry) return;

    const requestPayload: AdminContactInquiryUpdatePayload = {
      name: payload.name,
      mobile: payload.mobile,
      message: payload.message,
      status: payload.status,
    };

    setDrawerSaving(true);
    try {
      const res = await fetch(`/api/admin/contact/${selectedInquiry.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestPayload),
      });
      const json = (await res.json()) as {
        success: boolean;
        message?: string;
        data?: AdminContactInquiry;
      };

      if (!res.ok || !json.success || !json.data) {
        throw new Error(json.message ?? "Failed to update contact inquiry.");
      }

      const updated = json.data;
      setRows((prev) => prev.map((row) => (row.id === updated.id ? updated : row)));
      setSelectedInquiry((prev) => (prev && prev.id === updated.id ? updated : prev));
      toast.success("Contact inquiry updated.");

      if (statusFilter && updated.status !== statusFilter) {
        setDrawerOpen(false);
        void fetchInquiries();
      }
    } catch (updateError) {
      toast.error(
        updateError instanceof Error
          ? updateError.message
          : "Failed to update contact inquiry."
      );
    } finally {
      setDrawerSaving(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Contact Inquiries"
        description="Review and manage inquiries submitted from the public contact form."
      />

      <AdminCompactFilters
        hasActiveFilters={hasActiveFilters}
        activeFilterCount={statusFilter.trim().length > 0 ? 1 : 0}
        onClearFilters={hasActiveFilters ? clearFilters : undefined}
        searchSlot={
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search ID, name, mobile, message..."
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
            Loading contact inquiries...
          </div>
        ) : error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-5">
            <p className="text-sm font-medium text-red-700">{error}</p>
            <button
              type="button"
              onClick={() => void fetchInquiries()}
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
                ? "No contact inquiries match your filters"
                : "No contact inquiries found"
            }
            description={
              hasActiveFilters
                ? "Try clearing filters to view more inquiries."
                : "New customer inquiries from the contact page will appear here."
            }
            icon={hasActiveFilters ? <Search size={18} /> : <MessageCircle size={18} />}
            actionLabel={hasActiveFilters ? "Clear Filters" : undefined}
            onAction={hasActiveFilters ? clearFilters : undefined}
          />
        ) : (
          <ContactTable
            data={rows}
            serialStart={serialStart}
            onView={handleViewInquiry}
            onEdit={handleEditInquiry}
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

      {drawerMode === "view" ? (
        <ContactDetailsDrawer
          key={
            selectedInquiry
              ? `contact-view-${selectedInquiry.id}-${drawerSession}`
              : "contact-view-drawer"
          }
          open={drawerOpen}
          inquiry={selectedInquiry}
          onClose={() => {
            setDrawerOpen(false);
          }}
        />
      ) : (
        <ContactEditDrawer
          key={
            selectedInquiry
              ? `contact-edit-${selectedInquiry.id}-${drawerSession}`
              : "contact-edit-drawer"
          }
          open={drawerOpen}
          inquiry={selectedInquiry}
          saving={drawerSaving}
          onSave={(payload) => void handleSaveFromDrawer(payload)}
          onClose={() => {
            setDrawerOpen(false);
          }}
        />
      )}

      <ConfirmActionModal
        open={Boolean(deleteTarget)}
        title="Delete Contact Inquiry"
        description={
          <>
            You are about to delete inquiry from{" "}
            <strong>{deleteTarget?.name ?? "this contact"}</strong>. This action
            cannot be undone.
          </>
        }
        confirmLabel="Yes, Delete Inquiry"
        loadingLabel="Deleting..."
        loading={deleting}
        error={deleteError}
        onClose={closeDeleteModal}
        onConfirm={() => void handleDeleteInquiry()}
      />
    </>
  );
}
