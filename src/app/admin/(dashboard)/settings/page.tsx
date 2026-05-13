import { Suspense } from "react";
import SettingsPageClient from "./SettingsPageClient";

export default function SettingsPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm">Loading settings...</div>}>
      <SettingsPageClient />
    </Suspense>
  );
}
