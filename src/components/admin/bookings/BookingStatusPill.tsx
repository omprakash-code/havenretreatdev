//src/components/admin/bookings/BookingStatusPill.tsx
import { BookingStatus } from "@prisma/client";
import { getAdminBookingStatusDisplay } from "@/lib/admin-booking-status";

function getCompactStatusLabel(label: string) {
  switch (label) {
    case "PAID - EXPIRED":
      return "Paid Exp.";
    case "PAY ABANDONED":
      return "Pay Aband.";
    case "PAYMENT_PROCESSING":
      return "Processing";
    default:
      return label;
  }
}

export default function BookingStatusPill({
  status,
  paymentStatus,
  cancelledReason,
  isPaidExpired = false,
}: {
  status: BookingStatus | string;
  paymentStatus?: string | null;
  cancelledReason?: string | null;
  isPaidExpired?: boolean;
}) {
  const derivedDisplay = getAdminBookingStatusDisplay({
    bookingStatus: status,
    paymentStatus,
    cancelledReason,
  });
  const baseClassName =
    "inline-flex h-6 w-[96px] items-center rounded-full px-2.5 py-1 text-xs font-medium";

  if (derivedDisplay) {
    return (
      <span
        className={`${baseClassName} ${derivedDisplay.className}`}
        title={derivedDisplay.title}
      >
        <span className="block w-full truncate text-center">
          {getCompactStatusLabel(derivedDisplay.label)}
        </span>
      </span>
    );
  }

  if (isPaidExpired || status === "PAID_EXPIRED") {
    return (
      <span
        className={`${baseClassName} border border-amber-300 bg-amber-50 text-amber-900`}
        title="PAID - EXPIRED"
      >
        <span className="block w-full truncate text-center">
          {getCompactStatusLabel("PAID - EXPIRED")}
        </span>
      </span>
    );
  }

  const isPaymentProcessing = status === "PAYMENT_PROCESSING";
  const displayStatus = getCompactStatusLabel(
    isPaymentProcessing ? "PAYMENT_PROCESSING" : String(status)
  );
  const base =
    baseClassName;

  const cls =
  status === "CONFIRMED"
    ? "bg-emerald-50 text-emerald-800 border border-emerald-300"
    : status === "AWAITING_PAYMENT"
    ? "bg-amber-50 text-amber-800 border border-amber-300"
    : status === "INCOMPLETE"
    ? "bg-slate-50 text-slate-700 border border-slate-300"
    : status === "ABANDONED"
    ? "bg-indigo-50 text-indigo-800 border border-indigo-300"
    : status === "CANCELLED"
    ? "bg-rose-50 text-rose-700 border border-rose-300"
    : "bg-gray-100 text-gray-700 border border-gray-300";

  return (
    <span className={`${base} ${cls}`} title={status}>
      <span className="block w-full truncate text-center">{displayStatus}</span>
    </span>
  );
}
