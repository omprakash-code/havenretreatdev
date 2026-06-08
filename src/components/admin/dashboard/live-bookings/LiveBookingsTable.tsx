"use client";

import { useMemo } from "react";
import BookingRow from "@/components/admin/bookings/BookingRow";
import type { AdminBooking } from "@/types/admin/booking-admin";

type Props = {
  data: AdminBooking[];
  showContact?: boolean;
  showSLA?: boolean;
  onView?: (booking: AdminBooking) => void;
};

const MAX_ROWS = 10;

export default function LiveBookingsTable({
  data,
  showContact = false,
  showSLA = false,
  onView,
}: Props) {
  const tableMinWidth = showContact
    ? "min-w-[1100px]"
    : "min-w-[980px]";

  const rows = useMemo(() => {
    return [...data]
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() -
          new Date(a.createdAt).getTime()
      )
      .slice(0, MAX_ROWS);
  }, [data]);

  if (rows.length === 0) {
    return (
      <div className="px-6 py-10 text-center text-sm text-gray-500">
        No recent bookings found
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className={`${tableMinWidth} w-full border-collapse`}>
        <thead className="bg-neutral-50 text-[#111827] text-[12px] uppercase tracking-wide">
          <tr className="h-14">
            <th className="pl-5 pr-3 text-left">#</th>
            <th className="px-3 text-left">Reference</th>
            <th className="px-3 text-left">Customer</th>
            <th className="px-3 text-left">Phone</th>
            <th className="px-3 text-left">Package</th>
            <th className="px-3 text-left">Event Date &amp; Time</th>
            <th className="px-3 text-left">Amount</th>
            <th className="px-3 text-left w-[165px]">Status</th>
            <th className="px-3 text-left">Booking Date</th>

            {showContact && <th className="px-3 text-left">Contact</th>}

            <th className="w-[60px] pl-2 pr-5 text-left">Action</th>
          </tr>
        </thead>

        <tbody>
          {rows.map((booking, index) => (
            <BookingRow
              key={booking.id}
              booking={booking}
              selected={false}
              onSelect={() => {}}
              srNo={index + 1}
              showContact={showContact}
              showSLA={showSLA}
              showSelection={false} // ✅ IMPORTANT
              onView={onView}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
