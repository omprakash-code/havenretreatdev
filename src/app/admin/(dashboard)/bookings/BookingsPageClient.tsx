"use client";

import { useCallback, useEffect, useState } from "react";
import PageHeader from "@/components/admin/page/PageHeader";
import BookingsFilters from "@/components/admin/bookings/BookingFilters";
import BookingsTable from "@/components/admin/bookings/BookingTable";
import BookingTableSkeleton from "@/components/admin/bookings/BookingTableSkeleton";
import BookingDrawer from "@/components/admin/bookings/drawer/BookingDrawer";
import AddBookingDrawer from "@/components/admin/bookings/drawer/AddBookingDrawer";
import BookingDeleteModal from "@/components/admin/bookings/BookingDeleteModal";
import useAdminBookingActions from "@/components/admin/bookings/useAdminBookingActions";
import type { AdminBooking } from "@/types/admin/booking-admin";
import type { DatePreset } from "@/types/admin/filters";
import { CalendarCheck, Plus, Search } from "@/components/icons";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { BOOKING_TIME_ZONE } from "@/lib/booking-policy";
import AdminEmptyState from "@/components/admin/shared/AdminEmptyState";

const PAGE_SIZE = 40;

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
    BOOKING_TIME_ZONE
  );
  const endUtc = fromZonedTime(
    new Date(year, month - 1, day + 1, 0, 0, 0, 0),
    BOOKING_TIME_ZONE
  );
  return {
    dateFrom: startUtc.toISOString(),
    dateTo: endUtc.toISOString(),
  };
}

function getPresetRange(preset: DatePreset) {
  if (preset === "CUSTOM") return null;
  const todayKey = formatInTimeZone(new Date(), BOOKING_TIME_ZONE, "yyyy-MM-dd");

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
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

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

  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<AdminBooking | null>(null);

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
      // Filter options are only returned on the first page; preserve existing
      // options on later pages instead of clearing the dropdowns.
      if (json?.meta?.filterOptions) {
        setPackageOptions(json.meta.filterOptions.packages ?? []);
        setTimeRangeOptions(json.meta.filterOptions.timeRanges ?? []);
      }

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

  const refresh = useCallback(
    (options?: { resetToFirstPage?: boolean }) => {
      if (options?.resetToFirstPage) {
        setPage(1);
        return fetchBookings({ pageOverride: 1 });
      }
      return fetchBookings();
    },
    [fetchBookings]
  );

  const {
    tableActionProps,
    formDrawerProps,
    deleteModalProps,
    deleteTarget,
    openCreateForm,
  } = useAdminBookingActions({
    refresh,
    onBookingSaved: (booking) => {
      setSelectedBooking(booking);
      setDrawerOpen(true);
    },
    onBookingDeleted: () => {
      setSelectedBooking(null);
      setDrawerOpen(false);
    },
  });

  useEffect(() => {
    if (openAddBookingFromUrl !== "1") return;

    openCreateForm();

    const params = new URLSearchParams(searchParams.toString());
    params.delete("openAddBooking");
    const nextQuery = params.toString();
    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, {
      scroll: false,
    });
  }, [openAddBookingFromUrl, openCreateForm, pathname, router, searchParams]);

  useEffect(() => {
    if (!bookingRefFromUrl || bookings.length === 0) return;

    const match = bookings.find((b) => b.bookingRef === bookingRefFromUrl);

    if (match) {
      setSelectedBooking(match);
      setDrawerOpen(true);
    }
  }, [bookingRefFromUrl, bookings]);

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
            onClick={openCreateForm}
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

      {loading && bookings.length === 0 ? (
        <BookingTableSkeleton />
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
          onAction={hasActiveFilters ? clearAllFilters : openCreateForm}
        />
      ) : (
        <BookingsTable
          data={bookings}
          onView={handleViewBooking}
          {...tableActionProps}
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
        onReviewed={() => {
          // An approved booking leaves the pending tab; refresh so the list
          // reflects the decision.
          void fetchBookings();
        }}
      />

      <AddBookingDrawer {...formDrawerProps} />

      <BookingDeleteModal booking={deleteTarget} {...deleteModalProps} />
    </>
  );
}
