"use client";

import PageHeader from "@/components/admin/page/PageHeader";
import { AdminAddBookingForm } from "@/components/admin/bookings/add/AdminAddBookingForm";

export default function AdminAddBookingPage() {
  return (
    <>
      <PageHeader
        title="Add Booking"
        description="Create a booking with customer details, selected add-ons, and payment details."
      />
      <AdminAddBookingForm />
    </>
  );
}
