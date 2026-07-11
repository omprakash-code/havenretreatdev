import { getPaymentLifecycleDisplay } from "@/lib/admin-booking-status";

/**
 * Shows how much money has been collected, independently of whether the booking
 * is approved. An approved booking can legitimately be Unpaid.
 */
export default function PaymentLifecycleBadge({
  paymentStatus,
  advancePaid,
  remainingPayable,
  className = "",
}: {
  paymentStatus?: string | null;
  advancePaid?: number | null;
  remainingPayable?: number | null;
  className?: string;
}) {
  const display = getPaymentLifecycleDisplay({
    paymentStatus,
    advancePaid,
    remainingPayable,
  });

  return (
    <span
      className={`inline-flex h-6 items-center rounded-full px-2.5 py-1 text-xs font-medium ${display.className} ${className}`}
      title={display.title}
    >
      {display.label}
    </span>
  );
}
