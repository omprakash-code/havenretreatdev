import { Suspense } from "react";
import LocationsPageClient from "./LocationsPageClient";

export default function LocationsPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm">Loading locations...</div>}>
      <LocationsPageClient />
    </Suspense>
  );
}
