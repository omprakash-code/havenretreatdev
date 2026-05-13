import { Suspense } from "react";
import BookingsPageClient from "./BookingsPageClient";

export default function BookingsPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm">Loading bookings…</div>}>
      <BookingsPageClient />
    </Suspense>
  );
}
