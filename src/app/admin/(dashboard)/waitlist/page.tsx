import { Suspense } from "react";
import WaitlistPageClient from "./WaitlistPageClient";

export default function WaitlistPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm">Loading waitlist...</div>}>
      <WaitlistPageClient />
    </Suspense>
  );
}
