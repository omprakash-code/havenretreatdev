"use client";

import { useState } from "react";
import Link from "next/link";
import LiveBookingsTable from "./LiveBookingsTable";
import BookingDrawer from "@/components/admin/bookings/drawer/BookingDrawer";
import type { AdminBooking } from "@/types/admin/booking-admin";

type Props = {
  data: AdminBooking[];
  showContact?: boolean;
  showSLA?: boolean;
};

export default function LiveBookingsCard({
  data,
  showContact = false,
  showSLA = false,
}: Props) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] =
    useState<AdminBooking | null>(null);

  const handleViewBooking = (booking: AdminBooking) => {
    setSelectedBooking(booking);
    setDrawerOpen(true);
  };

  const handleCloseDrawer = () => {
    setDrawerOpen(false);
    setSelectedBooking(null);
  };

  return (
    <>
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
        {/* Header */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between px-3 sm:px-4 lg:px-6 py-3 sm:py-4 border-b border-gray-100">
          <div>
            <h3 className="text-base font-semibold text-gray-900">
              Latest Bookings
            </h3>
            <p className="text-sm text-gray-500 mt-0.5">
              Most recent confirmed bookings (latest 10)
            </p>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/admin/bookings"
              className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
            >
              View all →
            </Link>
          </div>
        </div>

        {/* Table */}
        <LiveBookingsTable
          data={data}
          showContact={showContact}
          showSLA={showSLA}
          onView={handleViewBooking}
        />
      </div>

      <BookingDrawer
        open={drawerOpen}
        onClose={handleCloseDrawer}
        booking={selectedBooking}
      />
    </>
  );
}
