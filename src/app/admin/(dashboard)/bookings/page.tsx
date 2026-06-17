import { Suspense } from "react";
import BookingsPageClient from "./BookingsPageClient";
import BookingTableSkeleton from "@/components/admin/bookings/BookingTableSkeleton";

export default function BookingsPage() {
  return (
    <Suspense fallback={<BookingTableSkeleton />}>
      <BookingsPageClient />
    </Suspense>
  );
}
