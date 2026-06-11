"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import PageHeader from "@/components/admin/page/PageHeader";
import BookingsFilters from "@/components/admin/bookings/BookingFilters";
import BookingsTable from "@/components/admin/bookings/BookingTable";
import type { AdminBooking } from "@/types/admin/booking-admin";
import type { DatePreset } from "@/types/admin/filters";
import BookingDrawer from "@/components/admin/bookings/drawer/BookingDrawer";
import ConfirmActionModal from "@/components/admin/drawer/ConfirmActionModal";
import { formatInTimeZone } from "date-fns-tz";
import AdminEmptyState from "@/components/admin/shared/AdminEmptyState";
import { Search, ShoppingCart } from "@/components/icons";

const applyDatePreset = (date: Date, preset: DatePreset) => {
  const istDateKey = formatInTimeZone(date, "Asia/Kolkata", "yyyy-MM-dd");
  const todayDateKey = formatInTimeZone(new Date(), "Asia/Kolkata", "yyyy-MM-dd");
  const diffDays = Math.floor(
    (new Date(`${todayDateKey}T00:00:00`).getTime() -
      new Date(`${istDateKey}T00:00:00`).getTime()) /
      (1000 * 60 * 60 * 24)
  );

  switch (preset) {
    case "TODAY":
      return diffDays === 0;
    case "YESTERDAY":
      return diffDays === 1;
    case "LAST_3":
      return diffDays <= 3;
    case "LAST_7":
      return diffDays <= 7;
    case "LAST_15":
      return diffDays <= 15;
    case "LAST_30":
      return diffDays <= 30;
    default:
      return true;
  }
};


export default function CartAbandonmentPage() {
  const [bookingRefFromUrl, setBookingRefFromUrl] = useState("");
  const autoOpenedFromUrlRef = useRef(false);
  const [data, setData] = useState<AdminBooking[]>([]);
  const [loading, setLoading] = useState(true);

  const [preset, setPreset] = useState<DatePreset | null>(null);
  const [customDate, setCustomDate] = useState("");
  const [search, setSearch] = useState("");
  const [packageName, setPackageName] = useState("");
  const [timeRange, setTimeRange] = useState("");
  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<AdminBooking | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminBooking | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleViewBooking = (booking: AdminBooking) => {
    setSelectedBooking(booking);
    setDrawerOpen(true);
  };

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
      setData((prev) => prev.filter((booking) => booking.id !== deleteTarget.id));
      setSelectedBooking((prev) => (prev?.id === deleteTarget.id ? null : prev));
      setDrawerOpen((prevOpen) => (selectedBooking?.id === deleteTarget.id ? false : prevOpen));
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
    async function fetchAbandoned() {
      try {
        const res = await fetch("/api/admin/bookings?type=abandoned");
        const json = await res.json();
        if (json.success) setData(json.data);
      } finally {
        setLoading(false);
      }
    }

    fetchAbandoned();
  }, []);

  useEffect(() => {
    if (!bookingRefFromUrl || data.length === 0 || autoOpenedFromUrlRef.current) return;

    const normalizedRef = bookingRefFromUrl.toLowerCase();
    const match = data.find(
      (booking) => booking.bookingRef.trim().toLowerCase() === normalizedRef
    );
    if (!match) return;

    autoOpenedFromUrlRef.current = true;
    setSelectedBooking(match);
    setDrawerOpen(true);
  }, [bookingRefFromUrl, data]);

  /* -----------------------------
     Derived filter options
  ------------------------------ */
  const packages = useMemo(
    () =>
      Array.from(new Set(data.map((b) => b.package?.name).filter(Boolean))) as string[],
    [data]
  );

  const timeRanges = useMemo(
    () =>
      Array.from(
        new Set(
          data.map(
            (b) =>
              `${b.schedule?.startTime || b.slot.startTime} - ${
                b.schedule?.endTime || b.slot.endTime
              }`
          )
        )
      ),
    [data]
  );

  /* -----------------------------
     Apply filters
  ------------------------------ */
  const filteredData = useMemo(() => {
    return data.filter((b) => {
      if (customDate) {
        const bookingDateKey = formatInTimeZone(
          new Date(b.createdAt),
          "Asia/Kolkata",
          "yyyy-MM-dd"
        );
        if (bookingDateKey !== customDate) return false;
      } else if (preset) {
        const created = new Date(b.createdAt);
        if (!applyDatePreset(created, preset)) return false;
      }

      if (packageName && b.package?.name !== packageName) return false;

      if (
        timeRange &&
        `${b.schedule?.startTime || b.slot.startTime} - ${
          b.schedule?.endTime || b.slot.endTime
        }` !== timeRange
      )
        return false;

      if (search) {
        const q = search.toLowerCase();
        const match =
          b.bookingRef.toLowerCase().includes(q) ||
          b.customer?.name?.toLowerCase().includes(q) ||
          b.customer?.phone?.includes(q) ||
          b.package?.name.toLowerCase().includes(q);

        if (!match) return false;
      }

      return true;
    });
  }, [data, customDate, packageName, preset, search, timeRange]);

  function clearAllFilters() {
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
        title="Cart Abandonment"
        description="Bookings where users started but did not complete payment."
      />

      <BookingsFilters
        preset={preset}
        setPreset={setPreset}
        customDate={customDate}
        setCustomDate={setCustomDate}
        showCustomDate
        status=""
        setStatus={() => { }}
        search={search}
        setSearch={setSearch}
        packageName={packageName}
        setPackageName={setPackageName}
        timeRange={timeRange}
        setTimeRange={setTimeRange}
        packages={packages}
        timeRanges={timeRanges}
        showStatus={false}
        onClearFilters={clearAllFilters}
      />

      {loading ? (
        <div className="py-10 text-sm text-neutral-500">
          Loading abandoned bookings…
        </div>
      ) : filteredData.length === 0 ? (
        <AdminEmptyState
          title={hasActiveFilters ? "No abandoned bookings match your filters" : "No abandoned bookings found"}
          description={
            hasActiveFilters
              ? "Try clearing filters or search to view more records."
              : "Incomplete sessions that do not finish payment will appear here."
          }
          icon={
            hasActiveFilters ? <Search size={18} /> : <ShoppingCart size={18} />
          }
          actionLabel={hasActiveFilters ? "Clear Filters" : undefined}
          onAction={hasActiveFilters ? clearAllFilters : undefined}
        />
      ) : (
        <BookingsTable
          data={filteredData}
          view="abandoned"
          onView={handleViewBooking}
          onDelete={openDeleteModal}
        />
      )}


      <BookingDrawer
        open={drawerOpen}
        onClose={() => {
          setDrawerOpen(false);
          setSelectedBooking(null);
        }}
        booking={selectedBooking}
      />

      <ConfirmActionModal
        open={Boolean(deleteTarget)}
        title="Delete Abandoned Booking"
        description={
          <>
            You are about to delete abandoned booking{" "}
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
