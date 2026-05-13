import { Suspense } from "react";
import CouponsPageClient from "./CouponsPageClient";

export default function CouponsPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm">Loading coupons...</div>}>
      <CouponsPageClient />
    </Suspense>
  );
}
