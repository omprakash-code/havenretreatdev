"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import PageHeader from "@/components/admin/page/PageHeader";
import PaymentsTable from "@/components/admin/payment/PaymentsTable";
import AdminEmptyState from "@/components/admin/shared/AdminEmptyState";
import AdminCompactFilters from "@/components/admin/shared/AdminCompactFilters";
import { Receipt, Search } from "@/components/icons";
import type { AdminPaymentRecord, AdminPaymentsResponse } from "@/types/payment";

const PAGE_SIZE = 40;

export default function PaymentsPageClient() {
  const [rows, setRows] = useState<AdminPaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);

  const [status, setStatus] = useState("");
  const [bookingRef, setBookingRef] = useState("");
  const [transactionId, setTransactionId] = useState("");

  const fetchPayments = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(PAGE_SIZE),
      });

      if (status) params.set("status", status);
      if (bookingRef.trim()) params.set("bookingRef", bookingRef.trim());
      if (transactionId.trim()) {
        params.set("transactionId", transactionId.trim());
      }

      const res = await fetch(`/api/admin/payments?${params.toString()}`);
      const json = (await res.json()) as
        | AdminPaymentsResponse
        | {
            success?: boolean;
            message?: string;
          };

      if (!res.ok || !json.success || !("data" in json)) {
        throw new Error(
          "message" in json
            ? json.message || "Failed to fetch payments."
            : "Failed to fetch payments."
        );
      }

      setRows(json.data);
      setTotalPages(json.pagination.totalPages || 1);
      setTotalRecords(json.pagination.total || 0);
    } catch (fetchError) {
      setError(
        fetchError instanceof Error
          ? fetchError.message
          : "Failed to fetch payments."
      );
      setRows([]);
      setTotalPages(1);
      setTotalRecords(0);
    } finally {
      setLoading(false);
    }
  }, [page, status, bookingRef, transactionId]);

  useEffect(() => {
    void fetchPayments();
  }, [fetchPayments]);

  useEffect(() => {
    setPage(1);
  }, [status, bookingRef, transactionId]);

  const canPrev = page > 1;
  const canNext = page < totalPages;
  const serialStart = (page - 1) * PAGE_SIZE;
  const hasActiveFilters =
    status.trim().length > 0 ||
    bookingRef.trim().length > 0 ||
    transactionId.trim().length > 0;

  const summaryText = useMemo(() => {
    if (totalRecords === 0) return "No payment attempts found.";
    const start = (page - 1) * PAGE_SIZE + 1;
    const end = Math.min(page * PAGE_SIZE, totalRecords);
    return `Showing ${start}-${end} of ${totalRecords} payment attempts`;
  }, [page, totalRecords]);

  function clearFilters() {
    setStatus("");
    setBookingRef("");
    setTransactionId("");
  }

  return (
    <>
      <PageHeader
        title="Payments"
        description="Review all payment attempts, outcomes, and transaction identifiers."
      />

      <AdminCompactFilters
        hasActiveFilters={hasActiveFilters}
        activeFilterCount={[status.trim().length > 0, bookingRef.trim().length > 0, transactionId.trim().length > 0].filter(Boolean).length}
        onClearFilters={hasActiveFilters ? clearFilters : undefined}
        searchSlot={
          <input
            value={bookingRef}
            onChange={(e) => setBookingRef(e.target.value)}
            placeholder="Search booking ref"
            className="h-10 w-full rounded-md border border-neutral-200 px-3 text-sm"
          />
        }
        filterSlot={
          <>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="h-10 w-full rounded-md border border-neutral-200 px-3 text-sm"
            >
              <option value="">All Status</option>
              <option value="PAID">PAID</option>
              <option value="FAILED">FAILED</option>
              <option value="CANCELLED">CANCELLED</option>
              <option value="INITIALIZED">INITIALIZED</option>
              <option value="AWAITING_PAYMENT">AWAITING_PAYMENT</option>
              <option value="EXPIRED">EXPIRED</option>
              <option value="OFFLINE">OFFLINE</option>
            </select>

            <input
              value={transactionId}
              onChange={(e) => setTransactionId(e.target.value)}
              placeholder="Search transaction ID"
              className="h-10 w-full rounded-md border border-neutral-200 px-3 text-sm"
            />
          </>
        }
      />

      <div className="mt-4 text-sm text-neutral-500">{summaryText}</div>

      <div className="mt-4">
        {loading ? (
          <div className="rounded-xl border border-dashed border-neutral-300 bg-white p-8 text-sm text-neutral-500">
            Loading payments...
          </div>
        ) : error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-5">
            <p className="text-sm font-medium text-red-700">{error}</p>
            <button
              type="button"
              onClick={() => void fetchPayments()}
              className="mt-3 rounded-md border border-red-200 bg-white px-3 py-1.5 text-sm text-red-700 hover:bg-red-100"
            >
              Retry
            </button>
          </div>
        ) : rows.length === 0 ? (
          <AdminEmptyState
            className="mt-0"
            title={hasActiveFilters ? "No payments match your filters" : "No payments found"}
            description={
              hasActiveFilters
                ? "Try clearing filters to view available payment attempts."
                : "Payment attempts will appear here once bookings reach payment stage."
            }
            icon={hasActiveFilters ? <Search size={18} /> : <Receipt size={18} />}
            actionLabel={hasActiveFilters ? "Clear Filters" : undefined}
            onAction={hasActiveFilters ? clearFilters : undefined}
          />
        ) : (
          <PaymentsTable data={rows} serialStart={serialStart} />
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
    </>
  );
}
