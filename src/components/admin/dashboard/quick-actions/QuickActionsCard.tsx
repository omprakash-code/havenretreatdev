"use client";

import { Plus, AlertTriangle, Clock, Tag } from "@/components/icons";
import QuickActionButton from "./QuickActionButton";

export default function QuickActionsCard() {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-3 sm:p-4 lg:p-6">
      {/* Header */}
      <div className="mb-3 sm:mb-4">
        <h3 className="text-base font-semibold text-gray-900">
          Quick Actions
        </h3>
        <p className="text-sm text-gray-500 mt-1">
          Fast access to critical admin actions
        </p>
      </div>

      {/* Actions – Single Row */}
      <div className="flex flex-wrap gap-2 sm:gap-3 lg:gap-4">
        <QuickActionButton
          icon={<Plus size={18} />}
          title="Add Booking"
          desc="Create manual / offline booking"
          href="/admin/bookings?openAddBooking=1"
          variant="primary"
        />

        <QuickActionButton
          icon={<AlertTriangle size={18} />}
          title="Abandoned Bookings"
          desc="Recover incomplete payments"
          href="/admin/bookings/abandoned"
          variant="primary"
        />

        <QuickActionButton
          icon={<Clock size={18} />}
          title="Manage Slots"
          desc="Temporarily disable slot availability"
          href="/admin/slots"
          variant="primary"
        />

        <QuickActionButton
          icon={<Tag size={18} />}
          title="Create Coupon"
          desc="Generate discount codes for offers"
          href="/admin/coupons"
          variant="primary"
        />

      </div>
    </div>
  );
}
