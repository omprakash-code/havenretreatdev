"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import PageHeader from "@/components/admin/page/PageHeader";
import BookingsFilters from "@/components/admin/bookings/BookingFilters";
import BookingsTable from "@/components/admin/bookings/BookingTable";
import BookingDrawer from "@/components/admin/bookings/drawer/BookingDrawer";
import AddBookingDrawer from "@/components/admin/bookings/drawer/AddBookingDrawer";
import ConfirmActionModal from "@/components/admin/drawer/ConfirmActionModal";
import type { AdminBooking } from "@/types/admin/booking-admin";
import type { DatePreset } from "@/types/admin/filters";
import { CalendarCheck, Plus, Search } from "@/components/icons";
import { downloadBookingTicketPdf } from "@/components/booking/success/pdf/downloadBookingTicketPdf";
import { mapAdminBookingToSuccessData } from "@/components/booking/success/mapAdminBookingToSuccessData";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import AdminEmptyState from "@/components/admin/shared/AdminEmptyState";

const PAGE_SIZE = 40;
const ET_TIMEZONE = "America/New_York";

function shiftDateKey(dateKey: string, deltaDays: number) {
  const [year, month, day] = dateKey.split("-").map(Number);
  if (!year || !month || !day) return dateKey;
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + deltaDays);
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function getEtDayRange(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  if (!year || !month || !day) return null;
  const startUtc = fromZonedTime(
    new Date(year, month - 1, day, 0, 0, 0, 0),
    ET_TIMEZONE
  );
  const endUtc = fromZonedTime(
    new Date(year, month - 1, day + 1, 0, 0, 0, 0),
    ET_TIMEZONE
  );
  return {
    dateFrom: startUtc.toISOString(),
    dateTo: endUtc.toISOString(),
  };
}

function getPresetRange(preset: DatePreset) {
  if (preset === "CUSTOM") return null;
  const todayKey = formatInTimeZone(new Date(), ET_TIMEZONE, "yyyy-MM-dd");

  if (preset === "YESTERDAY") {
    const fromKey = shiftDateKey(todayKey, -1);
    const toKey = todayKey;
    const fromRange = getEtDayRange(fromKey);
    const toRange = getEtDayRange(toKey);
    if (!fromRange || !toRange) return null;
    return { dateFrom: fromRange.dateFrom, dateTo: toRange.dateFrom };
  }

  const lookbackDaysMap: Partial<Record<DatePreset, number>> = {
    TODAY: 0,
    YESTERDAY: 1,
    LAST_3: 3,
    LAST_7: 7,
    LAST_15: 15,
    LAST_30: 30,
  };
  const lookbackDays = lookbackDaysMap[preset];
  if (lookbackDays == null) return null;
  const fromKey = shiftDateKey(todayKey, -lookbackDays);
  const toKey = shiftDateKey(todayKey, 1);
  const fromRange = getEtDayRange(fromKey);
  const toRange = getEtDayRange(toKey);
  if (!fromRange || !toRange) return null;
  return { dateFrom: fromRange.dateFrom, dateTo: toRange.dateFrom };
}

type BookingsListResponse = {
  success?: boolean;
  data?: AdminBooking[];
  meta?: {
    pagination?: {
      page?: number;
      pageSize?: number;
      total?: number;
      totalPages?: number;
    };
    filterOptions?: {
      packages?: string[];
      timeRanges?: string[];
    };
  };
};

export default function BookingsPage() {
  const [bookings, setBookings] = useState<AdminBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingBookingId, setDownloadingBookingId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [addBookingDrawerOpen, setAddBookingDrawerOpen] = useState(false);
  const [bookingFormMode, setBookingFormMode] = useState<"create" | "edit">("create");
  const [editingBookingId, setEditingBookingId] = useState<string | null>(null);

  const [preset, setPreset] = useState<DatePreset | null>(null);
  const [customDate, setCustomDate] = useState("");
  const [packageName, setPackageName] = useState("");
  const [timeRange, setTimeRange] = useState("");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [packageOptions, setPackageOptions] = useState<string[]>([]);
  const [timeRangeOptions, setTimeRangeOptions] = useState<string[]>([]);

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const bookingRefFromUrl = searchParams.get("ref");
  const openAddBookingFromUrl = searchParams.get("openAddBooking");

  useEffect(() => {
    if (openAddBookingFromUrl !== "1") return;

    setBookingFormMode("create");
    setEditingBookingId(null);
    setAddBookingDrawerOpen(true);

    const params = new URLSearchParams(searchParams.toString());
    params.delete("openAddBooking");
    const nextQuery = params.toString();
    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, {
      scroll: false,
    });
  }, [openAddBookingFromUrl, pathname, router, searchParams]);

  useEffect(() => {
    if (!bookingRefFromUrl || bookings.length === 0) return;

    const match = bookings.find(
      (b) => b.bookingRef === bookingRefFromUrl
    );

    if (match) {
      setSelectedBooking(match);
      setDrawerOpen(true);
    }
  }, [bookingRefFromUrl, bookings]);


  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<AdminBooking | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminBooking | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleDownloadBookingPdf = useCallback(async (booking: AdminBooking) => {
    if (downloadingBookingId) return;

    setDownloadingBookingId(booking.id);
    try {
      const res = await fetch(`/api/admin/bookings/${booking.id}?view=drawer`, {
        cache: "no-store",
      });
      const json = (await res.json().catch(() => null)) as
        | {
            success?: boolean;
            data?: (AdminBooking & {
              locationName: string;
              theatreImage?: string | null;
              decorationRequired?: boolean;
            }) | null;
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
  }, [downloadingBookingId]);

  function closeBookingFormDrawer() {
    setAddBookingDrawerOpen(false);
    setBookingFormMode("create");
    setEditingBookingId(null);
  }

  /* -----------------------------
     Fetch admin bookings
  ------------------------------ */
  const fetchBookings = useCallback(async (options?: { pageOverride?: number }) => {
    const targetPage = Math.max(options?.pageOverride ?? page, 1);
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(targetPage));
      params.set("pageSize", String(PAGE_SIZE));

      if (debouncedSearch.trim()) {
        params.set("search", debouncedSearch.trim());
      }
      if (packageName.trim()) {
        params.set("package", packageName.trim());
      }
      if (timeRange.trim()) {
        params.set("timeRange", timeRange.trim());
      }

      if (customDate) {
        const range = getEtDayRange(customDate);
        if (range) {
          params.set("dateFrom", range.dateFrom);
          params.set("dateTo", range.dateTo);
        }
      } else if (preset) {
        const range = getPresetRange(preset);
        if (range) {
          params.set("dateFrom", range.dateFrom);
          params.set("dateTo", range.dateTo);
        }
      }

      const res = await fetch(`/api/admin/bookings?${params.toString()}`, {
        cache: "no-store",
      });
      const json = (await res.json().catch(() => null)) as BookingsListResponse | null;
      const nextBookings = json?.success && Array.isArray(json.data) ? json.data : [];
      setBookings(nextBookings);
      setPackageOptions(json?.meta?.filterOptions?.packages ?? []);
      setTimeRangeOptions(json?.meta?.filterOptions?.timeRanges ?? []);

      const meta = json?.meta?.pagination;
      const nextPage = Math.max(Number(meta?.page ?? targetPage), 1);
      const nextTotalPages = Math.max(Number(meta?.totalPages ?? 1), 1);
      const nextTotalCount = Math.max(Number(meta?.total ?? nextBookings.length), 0);
      setPage(nextPage);
      setTotalPages(nextTotalPages);
      setTotalCount(nextTotalCount);
      return nextBookings as AdminBooking[];
    } finally {
      setLoading(false);
    }
  }, [customDate, debouncedSearch, packageName, page, preset, timeRange]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearch(search);
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [search]);

  useEffect(() => {
    void fetchBookings();
  }, [fetchBookings]);

  // Handle view booking
  const handleViewBooking = (booking: AdminBooking) => {
    setSelectedBooking(booking);
    setDrawerOpen(true);
  };

  function handleEditBooking(booking: AdminBooking) {
    setBookingFormMode("edit");
    setEditingBookingId(booking.id);
    setAddBookingDrawerOpen(true);
  }

  function openDeleteModal(booking: AdminBooking) {
    setDeleteError(null);
    setDeleteTarget(booking);
  }

  function closeDeleteModal() {
    if (deleting) return;
    setDeleteError(null);
    setDeleteTarget(null);
  }

  async function handleDeleteBooking() {
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
      await fetchBookings();
      setSelectedBooking(null);
      setDrawerOpen(false);
      setDeleteTarget(null);
    } catch (deleteRequestError) {
      setDeleteError(
        deleteRequestError instanceof Error
          ? deleteRequestError.message
          : "Failed to delete booking."
      );
    } finally {
      setDeleting(false);
    }
  }

  async function handleBookingCreated(bookingRef: string) {
    closeBookingFormDrawer();
    setPage(1);
    const refreshed = await fetchBookings({ pageOverride: 1 });
    const createdBooking = refreshed.find((booking) => booking.bookingRef === bookingRef) ?? null;
    if (createdBooking) {
      setSelectedBooking(createdBooking);
      setDrawerOpen(true);
    }
  }

  async function handleBookingUpdated(updatedBookingId: string) {
    closeBookingFormDrawer();
    const refreshed = await fetchBookings();
    const updatedBooking = refreshed.find((booking) => booking.id === updatedBookingId) ?? null;
    if (updatedBooking) {
      setSelectedBooking(updatedBooking);
      setDrawerOpen(true);
    }
  }

  function clearAllFilters() {
    setPage(1);
    setPreset(null);
    setCustomDate("");
    setPackageName("");
    setTimeRange("");
    setSearch("");
  }

  const hasActiveFilters =
    Boolean(preset) ||
    Boolean(customDate) ||
    packageName.trim().length > 0 ||
    timeRange.trim().length > 0 ||
    search.trim().length > 0;

  return (
    <>
      <PageHeader
        title="Bookings"
        description="Manage all bookings, filter by package, time range, date, and status."
        inlineActions
        actions={
          <button
            type="button"
            onClick={() => {
              setBookingFormMode("create");
              setEditingBookingId(null);
              setAddBookingDrawerOpen(true);
            }}
            className="inline-flex cursor-pointer items-center gap-2 rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-800 active:scale-[0.98]"
          >
            <Plus size={16} />
            Add Booking
          </button>
        }
      />


      <BookingsFilters
        search={search}
        setSearch={(value) => {
          setSearch(value);
          setPage(1);
        }}
        preset={preset}
        setPreset={(value) => {
          setPreset(value);
          setPage(1);
        }}
        customDate={customDate}
        setCustomDate={(value) => {
          setCustomDate(value);
          setPage(1);
        }}
        showCustomDate
        packageName={packageName}
        setPackageName={(value) => {
          setPackageName(value);
          setPage(1);
        }}
        timeRange={timeRange}
        setTimeRange={(value) => {
          setTimeRange(value);
          setPage(1);
        }}
        status=""
        setStatus={() => {}}
        packages={packageOptions}
        timeRanges={timeRangeOptions}
        showStatus={false}
        onClearFilters={clearAllFilters}
      />

      {loading ? (
        <div className="py-10 text-sm text-neutral-500">
          Loading bookings…
        </div>
      ) : bookings.length === 0 ? (
        <AdminEmptyState
          title={hasActiveFilters ? "No bookings match your filters" : "No bookings yet"}
          description={
            hasActiveFilters
              ? "Try clearing filters or search to view more booking records."
              : "Create your first booking to start tracking bookings here."
          }
          icon={
            hasActiveFilters ? <Search size={18} /> : <CalendarCheck size={18} />
          }
          actionLabel={hasActiveFilters ? "Clear Filters" : "Add Booking"}
          onAction={
            hasActiveFilters
              ? clearAllFilters
              : () => {
                  setBookingFormMode("create");
                  setEditingBookingId(null);
                  setAddBookingDrawerOpen(true);
                }
          }
        />
      ) : (
        <BookingsTable
          data={bookings}
          onView={handleViewBooking}
          onEdit={handleEditBooking}
          onDelete={openDeleteModal}
          onDownloadPdf={handleDownloadBookingPdf}
          downloadingBookingId={downloadingBookingId}
          serverPagination={{
            page,
            totalPages,
            totalCount,
            onPageChange: setPage,
          }}
        />
      )}

      {/* Booking Details Drawer */}
      <BookingDrawer
        open={drawerOpen}
        onClose={() => {
          setDrawerOpen(false);
          setSelectedBooking(null);
        }}
        booking={selectedBooking}
      />

      <AddBookingDrawer
        open={addBookingDrawerOpen}
        onClose={closeBookingFormDrawer}
        mode={bookingFormMode}
        bookingId={editingBookingId}
        onCreated={handleBookingCreated}
        onUpdated={handleBookingUpdated}
      />

      <ConfirmActionModal
        open={Boolean(deleteTarget)}
        title="Delete Booking"
        description={
          <>
            You are about to delete booking{" "}
            <strong>{deleteTarget?.bookingRef ?? "this booking"}</strong>. This action
            cannot be undone.
          </>
        }
        confirmLabel="Yes, Delete Booking"
        loadingLabel="Deleting..."
        loading={deleting}
        error={deleteError}
        onClose={closeDeleteModal}
        onConfirm={() => void handleDeleteBooking()}
      />
    </>
  );
}
