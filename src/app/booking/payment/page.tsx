// Legacy route. Public booking submits for admin review and collects no payment,
// so this page is unreachable from the active journey. It stays mounted for
// direct visits and old links, and renders the original provider checkout again
// as soon as PUBLIC_BOOKING_PAYMENTS_ENABLED is turned on.
import { isPublicBookingPaymentsEnabled } from "@/lib/booking-feature-flags";
import LegacyPaymentClient from "./LegacyPaymentClient";
import PaymentDisabledNotice from "./PaymentDisabledNotice";

// Read the flag per request: prerendering would bake today's value into the
// build and make re-enabling payments require a redeploy.
export const dynamic = "force-dynamic";

export default function PaymentPage() {
  if (!isPublicBookingPaymentsEnabled()) {
    return <PaymentDisabledNotice />;
  }

  return <LegacyPaymentClient />;
}
