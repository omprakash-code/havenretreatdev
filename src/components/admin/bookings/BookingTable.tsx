
//src/components/admin/bookings/BookingTable.tsx
"use client";

import { useMemo, useState } from "react";
import BookingRow from "./BookingRow";
import type { AdminBooking } from "@/types/admin/booking-admin";

const PAGE_SIZE = 40;

type Props = {
  data: AdminBooking[];
  view?: "default" | "abandoned" | "live";
  showContact?: boolean;
  showSLA?: boolean;
  onView?: (booking: AdminBooking) => void;
  onEdit?: (booking: AdminBooking) => void;
  onDelete?: (booking: AdminBooking) => void;
  onDownloadPdf?: (booking: AdminBooking) => void;
  downloadingBookingId?: string | null;
  serverPagination?: {
    page: number;
    totalPages: number;
    totalCount: number;
    onPageChange: (nextPage: number) => void;
  };
};

export default function BookingsTable({
  data,
  view = "default",
  showContact = false,
  showSLA = false,
  onView,
  onEdit,
  onDelete,
  onDownloadPdf,
  downloadingBookingId,
  serverPagination,
}: Props) {
  const [selected, setSelected] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const showSelection = !showSLA;
  const hideSelectionColumn = true;
  const isServerPaginationEnabled = Boolean(serverPagination);

  /* -----------------------------
     Sort: latest first
  ------------------------------ */
  const sorted = useMemo(() => {
    return [...data].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() -
        new Date(a.createdAt).getTime()
    );
  }, [data]);

  /* -----------------------------
     Pagination
  ------------------------------ */
  const clientTotalPages = Math.max(Math.ceil(sorted.length / PAGE_SIZE), 1);
  const totalPages = isServerPaginationEnabled
    ? Math.max(serverPagination?.totalPages ?? 1, 1)
    : clientTotalPages;
  const currentPage = isServerPaginationEnabled
    ? Math.max(serverPagination?.page ?? 1, 1)
    : page;
  const paginated = isServerPaginationEnabled
    ? sorted
    : sorted.slice(
        (currentPage - 1) * PAGE_SIZE,
        currentPage * PAGE_SIZE
      );
  const totalCount = isServerPaginationEnabled
    ? Math.max(serverPagination?.totalCount ?? paginated.length, 0)
    : sorted.length;

  const toggleAll = () =>
    setSelected(
      selected.length === paginated.length
        ? []
        : paginated.map((b) => b.id)
    );

  const toggleOne = (id: string) =>
    setSelected((prev) =>
      prev.includes(id)
        ? prev.filter((i) => i !== id)
        : [...prev, id]
    );

  const tableMinWidth = showSLA ? "min-w-[900px]" : "min-w-[940px]";

  return (
    <div className="bg-white rounded-xl border border-neutral-200 overflow-x-auto overscroll-x-contain">
      <table className={`${tableMinWidth} w-full border-collapse`}>
        {/* Header */}
        <thead className="bg-neutral-50 text-[#111827] text-[12px] uppercase tracking-wide">
          <tr className="h-14">
            {showSelection && (
              <th className={`w-10 pl-5 pr-2 ${hideSelectionColumn ? "hidden" : ""}`}>
                <div className="flex items-center justify-center">
                  <input
                    type="checkbox"
                    checked={
                      selected.length === paginated.length &&
                      paginated.length > 0
                    }
                    onChange={toggleAll}
                    className="h-4 w-4 rounded-sm border-neutral-300 accent-neutral-900 focus:ring-0"
                  />
                </div>
              </th>
            )}

            <th
              className={`text-left ${
                showSelection && !hideSelectionColumn ? "px-3" : "pl-5 pr-3"
              }`}
            >
              #
            </th>
            <th className="px-3 text-left">Booking ID</th>

            <th className="px-3 text-left">Customer</th>
            <th className="px-3 text-left">Phone</th>
            <th className="px-3 w-[130px] text-left">Package</th>
            <th className="px-3 text-left">Event Date &amp; Time</th>
            <th className="px-3 text-left">Amount</th>
            <th className="px-3 text-left w-[120px]">Status</th>
            <th className="px-3 text-left">Booking Date</th>

            {showContact && (
              <th className="px-3 text-left">Contact</th>
            )}

            <th className="w-[76px] pl-1.5 pr-4 text-left">Action</th>
          </tr>
        </thead>

        {/* Body */}
        <tbody>
          {paginated.map((b, index) => (
            <BookingRow
              key={b.id}
              booking={b}
              view={view}
              selected={selected.includes(b.id)}
              onSelect={() => toggleOne(b.id)}
              srNo={(currentPage - 1) * PAGE_SIZE + index + 1}
              showSLA={showSLA}
              showSelection={showSelection}
              hideSelectionColumn={hideSelectionColumn}
              showContact={showContact}
              onView={onView}
              onEdit={onEdit}
              onDelete={onDelete}
              onDownloadPdf={onDownloadPdf}
              isDownloadingPdf={downloadingBookingId === b.id}
            />
          ))}
        </tbody>
      </table>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between px-3 sm:px-4 py-3 border-t border-neutral-200 text-sm">
          <span className="text-neutral-500">
            Page {currentPage} of {totalPages} ({totalCount} bookings)
          </span>

          <div className="flex gap-2">
            <button
              disabled={currentPage === 1}
              onClick={() => {
                const nextPage = Math.max(currentPage - 1, 1);
                if (isServerPaginationEnabled) {
                  serverPagination?.onPageChange(nextPage);
                  return;
                }
                setPage(nextPage);
              }}
              className="rounded-md border border-neutral-200 px-3 py-1 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
            >
              Prev
            </button>
            <button
              disabled={currentPage === totalPages}
              onClick={() => {
                const nextPage = Math.min(currentPage + 1, totalPages);
                if (isServerPaginationEnabled) {
                  serverPagination?.onPageChange(nextPage);
                  return;
                }
                setPage(nextPage);
              }}
              className="rounded-md border border-neutral-200 px-3 py-1 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
