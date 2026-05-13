import { Suspense } from "react";
import ContactPageClient from "./ContactPageClient";

export default function ContactPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm">Loading contact inquiries...</div>}>
      <ContactPageClient />
    </Suspense>
  );
}
