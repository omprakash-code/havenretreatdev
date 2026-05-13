import { Suspense } from "react";
import PaymentsPageClient from "./PaymentsPageClient";

export default function PaymentsPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm">Loading payments…</div>}>
      <PaymentsPageClient />
    </Suspense>
  );
}
