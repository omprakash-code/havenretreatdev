"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import KpiGrid from "@/components/admin/dashboard/kpi/KpiGrid";
import RevenueChartCard from "@/components/admin/dashboard/revenue-chart/RevenueChartCard";
import LiveBookingsCard from "@/components/admin/dashboard/live-bookings/LiveBookingsCard";
import PageHeader from "@/components/admin/page/PageHeader";

import { getSLA } from "@/lib/admin/sla";
import type { AdminBooking } from "@/types/admin/booking-admin";

/* -----------------------------
   Page
------------------------------ */
export default function AdminDashboardPage() {
  const [bookings, setBookings] = useState<AdminBooking[]>([]);
  const [loading, setLoading] = useState(true);

  /* -----------------------------
     Fetch latest bookings
  ------------------------------ */
  useEffect(() => {
    async function fetchBookings() {
      try {
        const res = await fetch("/api/admin/bookings");
        const json = await res.json();

        if (json.success) {
          setBookings(json.data);
        }
      } catch (error) {
        console.error("DASHBOARD_BOOKINGS_ERROR", error);
      } finally {
        setLoading(false);
      }
    }

    fetchBookings();
  }, []);

  /* -----------------------------
     Inject SLA (safe for reuse)
  ------------------------------ */
  const enrichedBookings = useMemo(() => {
    return bookings.map((b) => ({
      ...b,
      sla: getSLA(b.createdAt),
    }));
  }, [bookings]);

  return (
    <div className="min-h-screen">
      {/* Page Container */}
      <div className="max-w-[1600px] mx-auto">
        {/* Page Header */}
        <PageHeader
          title="Dashboard"
          description="Business performance overview and operational insights"
          actions={(
            <div className="grid w-full grid-cols-2 gap-2 xl:grid-cols-4">
              <Link
                href="/admin/bookings?openAddBooking=1"
                className="inline-flex min-h-10 w-full items-center justify-center rounded-md bg-neutral-900 px-3 py-2 text-center text-sm font-medium leading-tight text-white transition hover:bg-neutral-800 active:scale-[0.98]"
              >
                + New Booking
              </Link>

              <Link
                href="/admin/bookings/abandoned"
                className="inline-flex min-h-10 w-full items-center justify-center rounded-md border border-slate-300 bg-white px-3 py-2 text-center text-sm font-medium leading-tight text-slate-700 transition hover:bg-slate-50 active:scale-[0.98]"
              >
                View Abandonment
              </Link>

              <Link
                href="/admin/slots"
                className="inline-flex min-h-10 w-full items-center justify-center rounded-md border border-slate-300 bg-white px-3 py-2 text-center text-sm font-medium leading-tight text-slate-700 transition hover:bg-slate-50 active:scale-[0.98]"
              >
                Slot Management
              </Link>

              <Link
                href="/admin/coupons"
                className="inline-flex min-h-10 w-full items-center justify-center rounded-md border border-slate-300 bg-white px-3 py-2 text-center text-sm font-medium leading-tight text-slate-700 transition hover:bg-slate-50 active:scale-[0.98]"
              >
                + Create Coupon
              </Link>
            </div>
          )}
        />

        {/* Full-width Stack */}
        <div className="mt-6 space-y-4 sm:space-y-5 lg:space-y-6">
          {/* KPI Cards */}
          <KpiGrid />

          {/* Revenue Chart */}
          <RevenueChartCard />

          {/* Latest Bookings */}
          {loading ? (
            <div className="bg-white rounded-xl border px-4 py-8 sm:px-5 sm:py-9 lg:px-6 lg:py-10 text-sm text-gray-500">
              Loading latest bookings…
            </div>
          ) : (
            <LiveBookingsCard
              data={enrichedBookings}
              showSLA={false}
            />
          )}
        </div>
      </div>
    </div>
  );
}
