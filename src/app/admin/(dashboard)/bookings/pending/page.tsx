"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import PageHeader from "@/components/admin/page/PageHeader";
import BookingsFilters from "@/components/admin/bookings/BookingFilters";
import BookingsTable from "@/components/admin/bookings/BookingTable";
import BookingDrawer from "@/components/admin/bookings/drawer/BookingDrawer";
import AdminEmptyState from "@/components/admin/shared/AdminEmptyState";
import { ClipboardCheck, Search } from "@/components/icons";
import type { AdminBooking } from "@/types/admin/booking-admin";

/**
 * Booking requests waiting for an admin decision. Reuses the standard booking
 * table and drawer; the approve/reject actions live in the drawer.
 *
 * Oldest submission first: the longest-waiting customer is decided first.
 */
export default function PendingReviewBookingsPage() {
  const [bookingRefFromUrl, setBookingRefFromUrl] = useState("");
  const autoOpenedFromUrlRef = useRef(false);
  const [data, setData] = useState<AdminBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [packageName, setPackageName] = useState("");
  const [timeRange, setTimeRange] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<AdminBooking | null>(
    null
  );

  const fetchPending = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/bookings?type=pending", {
        cache: "no-store",
      });
      const json = await res.json();
      if (json?.success) setData(json.data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchPending();
  }, [fetchPending]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    setBookingRefFromUrl(
      (
        params.get("ref") ??
        params.get("bookingRef") ??
        params.get("booking_ref") ??
        ""
      ).trim()
    );
  }, []);

  useEffect(() => {
    if (!bookingRefFromUrl || data.length === 0 || autoOpenedFromUrlRef.current) {
      return;
    }

    const normalizedRef = bookingRefFromUrl.toLowerCase();
    const match = data.find(
      (booking) => booking.bookingRef.trim().toLowerCase() === normalizedRef
    );
    if (!match) return;

    autoOpenedFromUrlRef.current = true;
    setSelectedBooking(match);
    setDrawerOpen(true);
  }, [bookingRefFromUrl, data]);

  const oldestFirst = useMemo(
    () =>
      [...data].sort((a, b) => {
        const left = new Date(a.reviewSubmittedAt ?? a.createdAt).getTime();
        const right = new Date(b.reviewSubmittedAt ?? b.createdAt).getTime();
        return left - right;
      }),
    [data]
  );

  const packages = useMemo(
    () =>
      Array.from(
        new Set(data.map((booking) => booking.package?.name).filter(Boolean))
      ) as string[],
    [data]
  );

  const timeRanges = useMemo(
    () =>
      Array.from(
        new Set(
          data.map(
            (booking) =>
              `${booking.schedule?.startTime || booking.slot.startTime} - ${
                booking.schedule?.endTime || booking.slot.endTime
              }`
          )
        )
      ),
    [data]
  );

  const filteredBookings = useMemo(() => {
    return oldestFirst.filter((booking) => {
      if (packageName && booking.package?.name !== packageName) return false;

      if (
        timeRange &&
        `${booking.schedule?.startTime || booking.slot.startTime} - ${
          booking.schedule?.endTime || booking.slot.endTime
        }` !== timeRange
      ) {
        return false;
      }

      if (search.trim()) {
        const query = search.trim().toLowerCase();
        const matches =
          booking.bookingRef.toLowerCase().includes(query) ||
          booking.customer?.name?.toLowerCase().includes(query) ||
          booking.customer?.phone?.includes(query) ||
          booking.package?.name.toLowerCase().includes(query);

        if (!matches) return false;
      }

      return true;
    });
  }, [oldestFirst, packageName, search, timeRange]);

  const hasActiveFilters =
    search.trim().length > 0 || packageName.length > 0 || timeRange.length > 0;

  function clearAllFilters() {
    setSearch("");
    setPackageName("");
    setTimeRange("");
  }

  return (
    <>
      <PageHeader
        title={`Pending Review (${filteredBookings.length})`}
        description={
          filteredBookings.length === 0
            ? "No booking requests waiting for review."
            : "Signed booking requests awaiting approval. No payment has been collected."
        }
      />

      <BookingsFilters
        preset={null}
        setPreset={() => {}}
        search={search}
        setSearch={setSearch}
        packageName={packageName}
        setPackageName={setPackageName}
        timeRange={timeRange}
        setTimeRange={setTimeRange}
        status=""
        setStatus={() => {}}
        packages={packages}
        timeRanges={timeRanges}
        showPreset={false}
        showStatus={false}
        onClearFilters={clearAllFilters}
      />

      {loading ? (
        <div className="mt-4 rounded-xl border border-neutral-200 bg-white px-4 py-8 text-sm text-neutral-500 sm:px-5 sm:py-10">
          Loading booking requests…
        </div>
      ) : filteredBookings.length === 0 ? (
        <AdminEmptyState
          title={
            hasActiveFilters
              ? "No booking requests match your filters"
              : "No booking requests waiting for review"
          }
          description={
            hasActiveFilters
              ? "Try clearing filters or search to view pending requests."
              : "Submitted booking requests will appear here for approval."
          }
          icon={
            hasActiveFilters ? <Search size={18} /> : <ClipboardCheck size={18} />
          }
          actionLabel={hasActiveFilters ? "Clear Filters" : undefined}
          onAction={hasActiveFilters ? clearAllFilters : undefined}
        />
      ) : (
        <div className="mt-4 -mx-1 sm:mx-0">
          <BookingsTable
            data={filteredBookings}
            onView={(booking) => {
              setSelectedBooking(booking);
              setDrawerOpen(true);
            }}
          />
        </div>
      )}

      <BookingDrawer
        open={drawerOpen}
        onClose={() => {
          setDrawerOpen(false);
          setSelectedBooking(null);
        }}
        booking={selectedBooking}
        onReviewed={() => {
          // A decided booking leaves this list.
          void fetchPending();
          setDrawerOpen(false);
          setSelectedBooking(null);
        }}
      />
    </>
  );
}
