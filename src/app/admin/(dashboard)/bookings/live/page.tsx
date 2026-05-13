"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import PageHeader from "@/components/admin/page/PageHeader";
import BookingsFilters from "@/components/admin/bookings/BookingFilters";
import BookingsTable from "@/components/admin/bookings/BookingTable";
import { getSLA, type SLAStatus } from "@/lib/admin/sla";
import type { AdminBooking } from "@/types/admin/booking-admin";
import BookingDrawer from "@/components/admin/bookings/drawer/BookingDrawer";
import AdminEmptyState from "@/components/admin/shared/AdminEmptyState";
import { Activity, Search } from "@/components/icons";


/* -----------------------------
   SLA priority order
------------------------------ */
const PRIORITY: Record<SLAStatus, number> = {
  HOT: 1,
  WARM: 2,
  COOLING: 3,
  EXPIRED: 4,
};

type BookingWithSLA = AdminBooking & {
  sla: ReturnType<typeof getSLA>;
};

export default function LiveBookingsPage() {
  const [bookingRefFromUrl, setBookingRefFromUrl] = useState("");
  const autoOpenedFromUrlRef = useRef(false);
  const [data, setData] = useState<AdminBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [theatre, setTheatre] = useState("");
  const [slot, setSlot] = useState("");
  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<AdminBooking | null>(null);

  const handleViewBooking = (booking: AdminBooking) => {
    setSelectedBooking(booking);
    setDrawerOpen(true);
  };


  /* -----------------------------
     Fetch live bookings
  ------------------------------ */
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
    let cancelled = false;

    async function fetchLiveInitial() {
      try {
        const res = await fetch("/api/admin/bookings?type=live");
        const json = await res.json();
        if (!cancelled && json.success) setData(json.data);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void fetchLiveInitial();
    return () => {
      cancelled = true;
    };
  }, []);

  const hasActiveFilters =
    search.trim().length > 0 || theatre.length > 0 || slot.length > 0;

  useEffect(() => {
    let disposed = false;
    let timerId: ReturnType<typeof setTimeout> | null = null;

    const poll = async () => {
      if (disposed) return;

      if (typeof document !== "undefined" && document.hidden) {
        timerId = setTimeout(poll, 15_000);
        return;
      }

      try {
        const res = await fetch("/api/admin/bookings?type=live", {
          cache: "no-store",
        });
        const json = await res.json();
        if (!disposed && json.success) {
          setData(json.data);
        }
      } finally {
        if (!disposed) {
          timerId = setTimeout(poll, 15_000);
        }
      }
    };

    // Pause background polling while user is filtering/searching.
    if (!hasActiveFilters) {
      timerId = setTimeout(poll, 0);
    }

    return () => {
      disposed = true;
      if (timerId) clearTimeout(timerId);
    };
  }, [hasActiveFilters]);

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
     Inject SLA + sort
  ------------------------------ */
  const enrichedAndSorted = useMemo<BookingWithSLA[]>(() => {
    const enriched = data.map((b) => ({
      ...b,
      sla: getSLA(b.createdAt),
    }));

    return enriched.sort(
      (a, b) =>
        PRIORITY[a.sla.label] -
        PRIORITY[b.sla.label]
    );
  }, [data]);

  const theatres = useMemo(
    () => Array.from(new Set(data.map((booking) => booking.theatre.name))),
    [data]
  );

  const slots = useMemo(
    () =>
      Array.from(
        new Set(
          data.map((booking) => `${booking.slot.startTime} - ${booking.slot.endTime}`)
        )
      ),
    [data]
  );

  const filteredBookings = useMemo(() => {
    return enrichedAndSorted.filter((booking) => {
      if (theatre && booking.theatre.name !== theatre) return false;

      if (slot && `${booking.slot.startTime} - ${booking.slot.endTime}` !== slot) return false;

      if (search.trim()) {
        const query = search.trim().toLowerCase();
        const matches =
          booking.bookingRef.toLowerCase().includes(query) ||
          booking.customer?.name?.toLowerCase().includes(query) ||
          booking.customer?.phone?.includes(query) ||
          booking.theatre.name.toLowerCase().includes(query);

        if (!matches) return false;
      }

      return true;
    });
  }, [enrichedAndSorted, search, slot, theatre]);

  const liveDescription =
    filteredBookings.length === 0
      ? "No active booking sessions right now."
      : "Users currently in booking flow.";

  function clearAllFilters() {
    setSearch("");
    setTheatre("");
    setSlot("");
  }

  return (
    <>
      <PageHeader
        title={`Live Bookings (${filteredBookings.length})`}
        description={liveDescription}
      />

      <BookingsFilters
        preset={null}
        setPreset={() => {}}
        search={search}
        setSearch={setSearch}
        theatre={theatre}
        setTheatre={setTheatre}
        slot={slot}
        setSlot={setSlot}
        status=""
        setStatus={() => {}}
        theatres={theatres}
        slots={slots}
        showPreset={false}
        showStatus={false}
        onClearFilters={clearAllFilters}
      />

      {loading ? (
        <div className="mt-4 rounded-xl border border-neutral-200 bg-white px-4 py-8 sm:px-5 sm:py-10 text-sm text-neutral-500">
          Loading live bookings…
        </div>
      ) : filteredBookings.length === 0 ? (
        <AdminEmptyState
          title={hasActiveFilters ? "No live bookings match your filters" : "No live bookings right now"}
          description={
            hasActiveFilters
              ? "Try clearing filters or search to view active sessions."
              : "This page will show users currently in the booking flow."
          }
          icon={
            hasActiveFilters ? <Search size={18} /> : <Activity size={18} />
          }
          actionLabel={hasActiveFilters ? "Clear Filters" : undefined}
          onAction={hasActiveFilters ? clearAllFilters : undefined}
        />
      ) : (
        <div className="mt-4 -mx-1 sm:mx-0">
          <BookingsTable
            data={filteredBookings}
            showSLA
            onView={handleViewBooking}
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
      />
    </>
  );
}
