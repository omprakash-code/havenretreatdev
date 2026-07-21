// src/components/admin/bookings/drawer/BookingDetails.tsx
"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { formatCalendarDate, formatVenueDateTime } from "@/lib/formatters";
import BookingReviewActions from "@/components/admin/bookings/drawer/BookingReviewActions";
import type { AdminBooking } from "@/types/admin/booking-admin";
import Image from "next/image";
import {
  Calendar,
  Clock,
  Gift,
  Users,
  CheckCircle,
  FileText,
  X,
  CreditCard,
  Download,
  ExternalLink,
} from "lucide-react";
import { getNumberDecorationLabel } from "@/lib/product-numbering";
import {
  humanizePaymentCaptureFailureReason,
  isPaymentCapturedBookingFailure,
} from "@/lib/payment-capture-failure";
import {
  getAdminBookingStatusDisplay,
  getReviewStatusDisplay,
} from "@/lib/admin-booking-status";
import { HAVEN_AGREEMENT_TOTAL_CLAUSES } from "@/constants/haven-agreement-content";

function formatOccasionFieldLabel(key: string) {
  const normalized = key
    .replace(/[_-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/([a-zA-Z])(\d)/g, "$1 $2")
    .replace(/(\d)([a-zA-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();

  return normalized.replace(/\b\w/g, (char) => char.toUpperCase());
}

function toOccasionDisplayValue(value: unknown) {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    const items = value
      .map((item) => String(item ?? "").trim())
      .filter((item) => item.length > 0);
    return items.join(", ");
  }
  return "";
}

function resolvePaymentMethod(
  provider: string,
  method: string | null
): { label: string; isOffline: boolean } {
  if (provider === "OFFLINE") {
    if (method === "CASH") return { label: "Cash", isOffline: true };
    if (method === "BANK") return { label: "Bank Transfer", isOffline: true };
    return { label: "Manual / Offline", isOffline: true };
  }
  if (method?.startsWith("CHECKOUT_DISMISSED")) {
    const parts = method.split("|");
    const source = parts.find((p) => p.startsWith("SRC:"));
    const reason = parts.find((p) => p.startsWith("RSN:"));
    const normalize = (tag: string | undefined) =>
      tag?.split(":")[1]?.toLowerCase().split("_").filter(Boolean).join(" ") ?? "";
    const sourceText = normalize(source);
    const reasonText = normalize(reason);
    if (sourceText && reasonText) return { label: `Checkout dismissed (${sourceText}, ${reasonText})`, isOffline: false };
    if (reasonText) return { label: `Checkout dismissed (${reasonText})`, isOffline: false };
    return { label: "Checkout dismissed", isOffline: false };
  }
  return { label: "Online Payment", isOffline: false };
}

function resolvePaymentProvider(provider: string): string {
  const map: Record<string, string> = {
    OFFLINE: "Manual",
    RAZORPAY: "Razorpay",
    STRIPE: "Stripe",
    SQUARE: "Square",
  };
  return map[provider] ?? provider;
}

function FieldRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-xs text-slate-500">{label}</span>
      <span className="text-sm font-medium text-slate-900 text-right">
        {children}
      </span>
    </div>
  );
}

function MonoValue({ children }: { children: React.ReactNode }) {
  return (
    <span className="max-w-[260px] break-all rounded bg-slate-100 px-2 py-1 text-right font-mono text-xs text-slate-700">
      {children}
    </span>
  );
}

function toTitleCase(label: string) {
  return label
    .toLowerCase()
    .replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
}

/**
 * How much money has actually been collected. PAID means captured, and
 * `advancePaid` then holds what was taken — on an uncaptured booking the same
 * field only holds what is *payable*, so it cannot be read on its own. A capture
 * that still leaves a balance is Partial, not Paid.
 */
function resolveCollectedPaymentDisplay(input: {
  paymentStatus?: string | null;
  advancePaid?: number | null;
  remainingPayable?: number | null;
}) {
  const captured = input.paymentStatus === "PAID";
  const collected = captured ? Math.max(Number(input.advancePaid ?? 0), 0) : 0;
  const remaining = Math.max(Number(input.remainingPayable ?? 0), 0);

  if (collected <= 0) {
    return { label: "Pending", className: "border border-amber-200 bg-white text-amber-700" };
  }
  if (remaining > 0) {
    return { label: "Partially Paid", className: "border border-blue-200 bg-white text-blue-700" };
  }
  return { label: "Fully Paid", className: "border border-emerald-200 bg-white text-emerald-700" };
}

/** Provider outcomes that describe an attempt, not a collected balance. */
const PAYMENT_ATTEMPT_STATUSES = ["FAILED", "REFUNDED", "EXPIRED", "CANCELLED"];

function getDrawerBookingStatusClassName(status: string) {
  const classNames: Record<string, string> = {
    PENDING_REVIEW: "border border-amber-200 bg-white text-amber-700",
    APPROVED: "border border-emerald-200 bg-white text-emerald-700",
    REJECTED: "border border-rose-200 bg-white text-rose-700",
    PAID_EXPIRED: "border border-amber-200 bg-white text-amber-800",
  };

  return classNames[status] ?? "border border-slate-200 bg-white text-slate-700";
}

// Status Badge Component
function StatusBadge({
  status,
  cancelledReason,
  paymentStatus,
  advancePaid,
  remainingPayable,
  type = "booking"
}: {
  status: string;
  cancelledReason?: string | null;
  paymentStatus?: string | null;
  advancePaid?: number | null;
  remainingPayable?: number | null;
  type?: "booking" | "payment";
}) {
  if (type === "payment" && !PAYMENT_ATTEMPT_STATUSES.includes(status)) {
    const collectedDisplay = resolveCollectedPaymentDisplay({
      paymentStatus: status,
      advancePaid,
      remainingPayable,
    });

    return (
      <span
        className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium ${collectedDisplay.className}`}
      >
        {collectedDisplay.label}
      </span>
    );
  }

  const derivedBookingDisplay =
    type === "booking"
      ? getAdminBookingStatusDisplay({
          bookingStatus: status,
          paymentStatus,
          cancelledReason,
        }) ?? getReviewStatusDisplay(status)
      : null;

  if (derivedBookingDisplay) {
    return (
      <span
        className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium ${getDrawerBookingStatusClassName(status)}`}
        title={derivedBookingDisplay.title}
      >
        {/* The list pill shouts its status; inside the drawer every other badge
            is title case, so the shared label is softened here. */}
        {toTitleCase(derivedBookingDisplay.label)}
      </span>
    );
  }

  const bookingConfig: Record<string, { label: string; className: string }> = {
    INCOMPLETE: { label: "Incomplete", className: "border border-slate-200 bg-white text-slate-700" },
    AWAITING_PAYMENT: { label: "Awaiting Payment", className: "border border-amber-200 bg-white text-amber-700" },
    PAYMENT_PROCESSING: { label: "Payment Processing", className: "border border-sky-200 bg-white text-sky-700" },
    COMPLETED: { label: "Completed", className: "border border-slate-300 bg-white text-slate-700" },
    CANCELLED: { label: "Cancelled", className: "border border-red-200 bg-white text-red-700" },
    ABANDONED: { label: "Abandoned", className: "border border-slate-200 bg-white text-slate-600" },
    PAID_EXPIRED: { label: "PAID - EXPIRED", className: "border border-amber-200 bg-white text-amber-800" },
  };

  const paymentConfig: Record<string, { label: string; className: string }> = {
    // No payment is taken during booking any more; it is collected after review.
    INITIALIZED: { label: "Pending", className: "border border-amber-200 bg-white text-amber-700" },
    AWAITING_PAYMENT: { label: "Awaiting Payment", className: "border border-amber-200 bg-white text-amber-700" },
    PENDING: { label: "Pending", className: "border border-amber-200 bg-white text-amber-700" },
    PAID: { label: "Paid", className: "border border-emerald-200 bg-white text-emerald-700" },
    FAILED: { label: "Failed", className: "border border-red-200 bg-white text-red-700" },
    PARTIAL: { label: "Partial", className: "border border-blue-200 bg-white text-blue-700" },
    REFUNDED: { label: "Refunded", className: "border border-slate-200 bg-white text-slate-700" },
    EXPIRED: { label: "Expired", className: "border border-slate-200 bg-white text-slate-600" },
  };

  const config = type === "booking" ? bookingConfig : paymentConfig;
  const { label, className } = config[status] || { label: status, className: "border border-slate-200 bg-white text-slate-700" };

  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium ${className}`}>
      {label}
    </span>
  );
}

/**
 * Whether an email in the booking's lifecycle has gone out. `pending` marks a
 * send that is not due yet, so a not-yet-sent email never reads as a failure.
 */
function EmailStatus({
  sent = false,
  pending = false,
}: {
  sent?: boolean;
  pending?: boolean;
}) {
  if (sent) {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-slate-200 bg-white text-xs font-medium text-slate-700">
        <CheckCircle size={12} />
        Yes
      </span>
    );
  }

  if (pending) {
    return (
      <span className="inline-flex items-center px-2.5 py-1 rounded-md border border-amber-200 bg-white text-xs font-medium text-amber-700">
        Pending
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-slate-100 text-slate-600">
      <X size={12} />
      No
    </span>
  );
}

// Tab Button Component with animation
function TabButton({
  active,
  onClick,
  label,
  icon: Icon,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  icon?: React.ComponentType<{ size?: number }>;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        relative px-4 py-2.5 text-sm font-medium transition-colors
        ${active
          ? "text-slate-900"
          : "text-slate-500 hover:text-slate-700"}
      `}
    >
      {active && (
        <motion.div
          layoutId="activeTab"
          className="absolute inset-0 border-b-2 border-black -mx-px"
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
        />
      )}
      <span className="relative flex items-center gap-2">
        {Icon && <Icon size={16} />}
        {label}
      </span>
    </button>
  );
}

// Product Card Component
function ProductCard({ item }: { item: AdminBooking["items"][0] }) {
  return (
    <div className="flex items-center gap-3 bg-white rounded-lg p-2 border border-slate-200">
      {/* Product Image */}
      <div className="relative w-14 h-14 rounded-lg overflow-hidden bg-slate-100 flex-shrink-0">
        {item.image ? (
          <Image
            src={item.image}
            alt={item.productName}
            fill
            className="object-cover"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src = "/placeholder-product.png";
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Gift size={24} className="text-slate-400" />
          </div>
        )}
      </div>

      {/* Product Info */}
      <div className="flex-1 min-w-0">
        <p className="text-[10px] bg-slate-100 inline-block text-slate-800 uppercase px-1 py-0.5 rounded mb-1">
          {item.category}
        </p>
        <p className="text-sm font-medium text-slate-900 truncate">
          {item.productName}
        </p>
        <p className="text-xs text-slate-500">
          {item.variantLabel} × {item.quantity}
        </p>
        {item.ledNumber ? (
          <p className="text-xs font-medium text-slate-700">
            {getNumberDecorationLabel({
              slug: undefined,
              name: item.productName,
            })}
            : {item.ledNumber}
          </p>
        ) : null}
      </div>

      {/* Price */}
        <span className={`text-sm font-semibold ${item.totalPrice <= 0 ? "text-slate-400" : "text-slate-900"}`}>
          {item.totalPrice <= 0 ? "Included" : `$${item.totalPrice.toLocaleString()}`}
        </span>
    </div>
  );
}

type BookingDetailsProps = {
  booking: AdminBooking;
  /** Called after an approve/reject so the drawer and list can revalidate. */
  onReviewed?: () => void;
};

export default function BookingDetails({
  booking,
  onReviewed,
}: BookingDetailsProps) {
  const [activeTab, setActiveTab] = useState<"overview" | "payment">("overview");
  const scheduleDateLabel =
    booking.schedule?.dateLabel || formatCalendarDate(booking.slot.date);
  const scheduleTimeLabel =
    booking.schedule?.timeLabel ||
    `${booking.slot.startTime} - ${booking.slot.endTime}`;

  // Calculate products total
  const productsTotal = booking.items.reduce((sum, item) => sum + item.totalPrice, 0);
  const lockedAdvanceAmount = Math.max(booking.pricing.advancePaid, 0);
  const hasCapturedAdvance = booking.paymentStatus === "PAID";
  const totalPaid = hasCapturedAdvance ? lockedAdvanceAmount : 0;
  const isFullyPaid =
    hasCapturedAdvance &&
    totalPaid >= Math.max(booking.pricing.total, 0);
  const balanceDueAmount = Math.max(booking.pricing.remainingPayable, 0);
  const paymentSummaryStatus = booking.paymentStatus ?? "INITIALIZED";
  const isPaymentCapturedFailure = isPaymentCapturedBookingFailure({
    bookingStatus: booking.bookingStatus,
    paymentStatus: booking.paymentStatus,
    cancelledReason: booking.cancelledReason,
  });
  const paymentCapturedFailureReason = humanizePaymentCaptureFailureReason(
    booking.cancelledReason
  );
  const isReviewBooking = Boolean(booking.reviewSubmittedAt);
  const statusOverviewItems = [
    {
      key: "booking",
      label: "Booking",
      content: (
        <StatusBadge
          status={
            booking.bookingStatus === "PAID_EXPIRED" || isPaymentCapturedFailure
              ? "PAID_EXPIRED"
              : booking.bookingStatus ?? "INCOMPLETE"
          }
          paymentStatus={booking.paymentStatus}
          cancelledReason={booking.cancelledReason}
          type="booking"
        />
      ),
    },
    {
      key: "payment",
      label: "Payment",
      content: (
        <StatusBadge
          status={booking.paymentStatus ?? "INITIALIZED"}
          advancePaid={booking.pricing.advancePaid}
          remainingPayable={booking.pricing.remainingPayable}
          type="payment"
        />
      ),
    },
    // A booking that reached review was emailed to the customer and the admin on
    // submission, and is emailed again once a decision is made. The confirmation
    // email is a later, separate send, so it only appears once it has gone out.
    ...(isReviewBooking && booking.bookingStatus !== "ABANDONED"
      ? [
          {
            key: "submission-email",
            label: "Submission Email",
            content: <EmailStatus sent />,
          },
          {
            key: "decision-email",
            label: "Decision Email",
            content: booking.reviewedAt ? (
              <EmailStatus sent />
            ) : (
              <EmailStatus pending />
            ),
          },
          ...(booking.confirmationEmailSent
            ? [{
                key: "confirmation-email",
                label: "Confirmation Email",
                content: <EmailStatus sent />,
              }]
            : []),
        ]
      : []),
    ...(!isReviewBooking && booking.bookingStatus !== "ABANDONED"
      ? [{
          key: "confirmation-email",
          label: "Confirmation Email",
          content: <EmailStatus sent={booking.confirmationEmailSent} />,
        }]
      : []),
    ...(booking.bookingStatus === "ABANDONED"
      ? [{
          key: "abandonment-email",
          label: "Abandonment Email",
          content: (
            <EmailStatus
              sent={Boolean(
                booking.abandonmentCustomerEmailSentAt ||
                  booking.abandonmentAdminEmailSentAt
              )}
            />
          ),
        }]
      : []),
  ];

  const occasionEntries = Object.entries(booking.occasionData ?? {})
    .map(([key, value]) => ({
      key,
      label: formatOccasionFieldLabel(key),
      value: toOccasionDisplayValue(value),
    }))
    .filter((entry) => entry.value.length > 0);

  return (
    <div className="flex flex-col h-full">
      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200 px-6 -mx-6 mb-6">
        <TabButton
          active={activeTab === "overview"}
          onClick={() => setActiveTab("overview")}
          label="Overview"
        />
        <TabButton
          active={activeTab === "payment"}
          onClick={() => setActiveTab("payment")}
          label="Payment"
          icon={CreditCard}
        />
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto space-y-6">
        <AnimatePresence mode="wait">
          {activeTab === "overview" && (
            <motion.div
              key="overview"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              {/* Review decision (only while pending) */}
              <BookingReviewActions booking={booking} onReviewed={onReviewed} />

              {/* Status Overview */}
              <div className="border border-slate-200 rounded-lg bg-white p-4 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold text-slate-900">Status Overview</h3>
                  {booking.customerConfirmationUrl ? (
                    <a
                      href={booking.customerConfirmationUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-md border border-[#d7e4e1] bg-white px-2.5 text-xs font-medium text-[#245e5b] transition-colors hover:border-[#347f7c] hover:bg-[#edf3f1]"
                    >
                      <ExternalLink size={13} aria-hidden="true" />
                      View Confirmation
                    </a>
                  ) : null}
                </div>
                {isPaymentCapturedFailure ? (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                    <p className="text-sm font-semibold text-amber-900">
                      Payment received, booking not confirmed
                    </p>
                    <p className="mt-1 text-xs text-amber-800">
                      Payment was received after the reservation expired. The customer has been notified.
                      {" "}
                      Please review the payment and process the refund or contact the customer for resolution.
                    </p>
                  </div>
                ) : null}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-3">
                  {statusOverviewItems.map((item, index) => (
                    <div key={item.key} className="contents">
                      {index > 0 ? <div className="h-8 w-px bg-slate-200" /> : null}
                      <div>
                        <p className="text-xs text-slate-500 mb-1">{item.label}</p>
                        {item.content}
                      </div>
                    </div>
                  ))}
                </div>

                {booking.bookingStatus === "APPROVED" && booking.approvalNotes ? (
                  <div className="border-t border-slate-200 pt-3">
                    <p className="text-xs text-slate-500 mb-1">Approval notes</p>
                    <p className="text-xs leading-5 text-slate-700">
                      {booking.approvalNotes}
                    </p>
                  </div>
                ) : null}

                {booking.bookingStatus === "REJECTED" && booking.rejectionReason ? (
                  <div className="border-t border-slate-200 pt-3">
                    <p className="text-xs text-slate-500 mb-1">Rejection note</p>
                    <p className="text-xs leading-5 text-slate-700">
                      {booking.rejectionReason}
                    </p>
                  </div>
                ) : null}
              </div>

              {/* Customer Details */}
              <div className="border border-slate-200 rounded-lg p-4 space-y-3">
                <h3 className="text-sm font-semibold text-slate-900">Customer Details</h3>

                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-4">
                    <span className="text-xs text-slate-500">Name</span>
                    <span className="text-sm font-medium text-slate-900 text-right">
                      {booking.customer?.name ?? "Guest"}
                    </span>
                  </div>

                  <div className="flex items-start justify-between gap-4">
                    <span className="text-xs text-slate-500">Phone</span>
                    <a
                      href={`tel:${booking.customer?.phone}`}
                      className="text-sm font-medium text-slate-900 hover:text-black transition-colors"
                    >
                      {booking.customer?.phone ?? "—"}
                    </a>
                  </div>

                  <div className="flex items-start justify-between gap-4">
                    <span className="text-xs text-slate-500">Email</span>
                    <span className="text-sm font-medium text-slate-900 text-right">
                      {booking.customer?.email ?? "—"}
                    </span>
                  </div>
                </div>

                {/* Quick Actions */}
                {booking.customer?.phone && (
                  <div className="pt-3 border-t border-slate-200 flex gap-2">
                    <a
                      href={`tel:${booking.customer.phone}`}
                      className="flex-1 flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:border-slate-300 hover:text-slate-900"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                      Call
                    </a>
                    <a
                      href={`https://wa.me/1${booking.customer.phone}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:border-emerald-300 hover:text-emerald-700"
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.890-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                      </svg>
                      WhatsApp
                    </a>
                  </div>
                )}
              </div>

              {/* Slot Details - Card Style */}
              <div className="bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200 rounded-lg p-4 space-y-3">
                <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                  <Calendar size={16} />
                  Booking Schedule
                </h3>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white rounded-lg p-3 border border-slate-200">
                    <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
                      <Calendar size={12} />
                      Date
                    </div>
                    <p className="text-sm font-semibold text-slate-900">
                      {scheduleDateLabel}
                    </p>
                  </div>

                  <div className="bg-white rounded-lg p-3 border border-slate-200">
                    <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
                      <Clock size={12} />
                      Time
                    </div>
                    <p className="text-sm font-semibold text-slate-900">
                      {scheduleTimeLabel}
                    </p>
                  </div>

                  <div className="bg-white rounded-lg p-3 border border-slate-200">
                    <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
                      <FileText size={12} />
                      Package
                    </div>
                    <p className="text-sm font-semibold text-slate-900">
                      {booking.package?.name ?? booking.theatre.name}
                    </p>
                  </div>

                  <div className="bg-white rounded-lg p-3 border border-slate-200">
                    <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
                      <Users size={12} />
                      Guests
                    </div>
                    <p className="text-sm font-semibold text-slate-900">
                      {booking.guestCount} {booking.guestCount === 1 ? "person" : "people"}
                    </p>
                  </div>
                </div>

                <div className="space-y-2 border-t border-slate-200 pt-3">
                  <FieldRow label="Location">
                    {booking.theatre.locationName ?? booking.locationName ?? "—"}
                  </FieldRow>
                </div>
              </div>

              {/* Occasion Details - Simplified */}
              {booking.occasionLabel && (
                <div className="border border-slate-200 rounded-lg p-4 space-y-3">


                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                      <Gift size={16} />
                      Occasion
                    </h3>
                    <span className="text-sm font-semibold bg-slate-100 text-black px-3 py-1 rounded-sm">
                      {booking.occasionLabel}
                    </span>
                  </div>

                  {/* Occasion Data */}
                  {occasionEntries.length > 0 && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mt-2">
                      <div className="space-y-1.5">
                        {occasionEntries.map((entry) => (
                          <p key={entry.key} className="text-sm text-amber-900">
                            <span className="font-medium">{entry.label}:</span> {entry.value}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Admin Notes (internal) */}
              {booking.specialInstructions?.trim() ? (
                <div className="border border-slate-200 rounded-lg p-4 space-y-3">
                  <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                    <FileText size={16} />
                    Admin Notes
                    <span className="text-xs font-normal text-slate-400">(internal)</span>
                  </h3>
                  <p className="whitespace-pre-wrap text-sm text-slate-700">
                    {booking.specialInstructions}
                  </p>
                </div>
              ) : null}

              {/* Products Added */}
              {booking.items && booking.items.length > 0 && (
                <div className="border border-slate-200 rounded-lg p-4 space-y-3">
                  <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                    <Gift size={16} />
                    Products ({booking.items.length})
                  </h3>

                  {/* Product Grid - 2 per row */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {booking.items.map((item) => (
                      <ProductCard key={item.id} item={item} />
                    ))}
                  </div>

                  {/* Products Total */}
                  {productsTotal > 0 && (
                    <div className="flex items-center justify-between pt-3 border-t border-slate-200 mt-3">
                      <span className="text-sm font-medium text-slate-700">Products Total</span>
                      <span className="text-sm font-semibold text-slate-900">
                        ${productsTotal.toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Agreement & Signature */}
              <div className="border border-slate-200 rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                    <FileText size={16} />
                    Agreement & Signature
                  </h3>
                  {booking.signedAgreement?.pdfFileName ? (
                    <a
                      href={`/api/admin/bookings/${encodeURIComponent(
                        booking.id
                      )}/agreement/download`}
                      className="inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 transition-colors hover:border-slate-300 hover:text-slate-900"
                    >
                      <Download size={14} aria-hidden="true" />
                      Download
                    </a>
                  ) : null}
                </div>

                <div className="flex items-start justify-between gap-4">
                  <span className="text-xs text-slate-500">Status</span>
                  {booking.termsAcceptedAt ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-emerald-50 text-emerald-800">
                      <CheckCircle size={12} />
                      Accepted
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-slate-100 text-slate-600">
                      <X size={12} />
                      Not Accepted
                    </span>
                  )}
                </div>

                {booking.termsAcceptedAt && (
                  <div className="flex items-start justify-between gap-4">
                    <span className="text-xs text-slate-500">Accepted At</span>
                    <span className="text-xs font-medium text-slate-900">
                      {formatVenueDateTime(booking.termsAcceptedAt)}
                    </span>
                  </div>
                )}

                {booking.signedAgreement ? (
                  <div className="space-y-3 border-t border-slate-200 pt-3">
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-4">
                        <span className="text-xs text-slate-500">Signer Name</span>
                        <span className="text-sm font-medium text-slate-900 text-right">
                          {booking.signedAgreement.signerName}
                        </span>
                      </div>
                      <div className="flex items-start justify-between gap-4">
                        <span className="text-xs text-slate-500">Signed At</span>
                        <span className="text-sm font-medium text-slate-900 text-right">
                          {formatVenueDateTime(booking.signedAgreement.signedAt)}
                        </span>
                      </div>
                      <div className="flex items-start justify-between gap-4">
                        <span className="text-xs text-slate-500">Clauses Acknowledged</span>
                        <span className="text-sm font-medium text-slate-900 text-right">
                          {booking.signedAgreement.acknowledgedClauses?.length ??
                            0}{" "}
                          of {HAVEN_AGREEMENT_TOTAL_CLAUSES}
                        </span>
                      </div>
                    </div>

                    <div className="rounded-lg border border-slate-200 bg-white p-3">
                      <p className="mb-2 text-xs font-medium text-slate-500">
                        Digital Signature
                      </p>
                      <div className="flex min-h-[96px] items-center justify-center rounded-md bg-slate-50 p-3">
                        <Image
                          src={booking.signedAgreement.signatureImage}
                          alt={`Signature of ${booking.signedAgreement.signerName}`}
                          width={360}
                          height={120}
                          unoptimized
                          className="max-h-24 w-full object-contain"
                        />
                      </div>
                    </div>

                  </div>
                ) : (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                    No signed agreement record found for this booking.
                  </div>
                )}
              </div>

              {/* Metadata */}
              <div className="border border-slate-200 rounded-lg p-4 space-y-3">
                <h3 className="text-sm font-semibold text-slate-900">Booking Information</h3>

                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-4">
                    <span className="text-xs text-slate-500">Reference</span>
                    <span className="text-xs font-mono text-slate-900 bg-slate-100 px-2 py-1 rounded">
                      {booking.bookingRef}
                    </span>
                  </div>

                  <div className="flex items-start justify-between gap-4">
                    <span className="text-xs text-slate-500">Created</span>
                    <span className="text-sm font-medium text-slate-900">
                      {formatVenueDateTime(booking.createdAt)}
                    </span>
                  </div>
                  <div className="flex items-start justify-between gap-4">
                    <span className="text-xs text-slate-500">Created By</span>
                    <span className="text-sm font-medium text-slate-900">
                      {booking.createdByRole === "ADMIN" ? "Admin" : "Customer"}
                    </span>
                  </div>
                  {booking.cancelledReason ? (
                    <div className="flex items-start justify-between gap-4">
                      <span className="text-xs text-slate-500">Cancelled Reason</span>
                      <span className="text-sm font-medium text-slate-900 text-right">
                        {isPaymentCapturedFailure
                          ? paymentCapturedFailureReason
                          : booking.cancelledReason}
                      </span>
                    </div>
                  ) : null}
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === "payment" && (
            <motion.div
              key="payment"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              {isPaymentCapturedFailure ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                  <p className="text-sm font-semibold text-amber-900">
                    Payment captured, booking failed
                  </p>
                  <p className="mt-1 text-xs text-amber-800">
                    {paymentCapturedFailureReason}. Treat this as refund follow-up, not as a normal failed payment.
                  </p>
                </div>
              ) : null}
              {/* Pricing Breakdown */}
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-4">
                  <h3 className="text-sm font-semibold text-slate-900">
                    Pricing Breakdown
                  </h3>
                  <StatusBadge
                    status={paymentSummaryStatus}
                    advancePaid={booking.pricing.advancePaid}
                    remainingPayable={booking.pricing.remainingPayable}
                    type="payment"
                  />
                </div>

                <div className="bg-slate-50 rounded-xl p-4 space-y-2.5">
                  {booking.pricing.packageAmount != null ? (
                    <>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-slate-600">Package</span>
                        <span className="text-sm font-medium text-slate-900">
                          ${booking.pricing.packageAmount.toLocaleString()}
                        </span>
                      </div>
                      {(booking.pricing.extraDurationAmount ?? 0) > 0 && (
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-slate-600">
                            Extra Hours
                            {(booking.pricing.extraDurationHours ?? 0) > 0
                              ? ` (${booking.pricing.extraDurationHours}h)`
                              : ""}
                          </span>
                          <span className="text-sm font-medium text-slate-900">
                            ${booking.pricing.extraDurationAmount!.toLocaleString()}
                          </span>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-600">Venue Rental</span>
                      <span className="text-sm font-medium text-slate-900">
                        ${booking.pricing.base.toLocaleString()}
                      </span>
                    </div>
                  )}

                  {booking.pricing.extras > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-600">Extra Guests</span>
                      <span className="text-sm font-medium text-slate-900">
                        ${booking.pricing.extras.toLocaleString()}
                      </span>
                    </div>
                  )}

                  {booking.pricing.decoration > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-600">Decoration</span>
                      <span className="text-sm font-medium text-slate-900">
                        ${booking.pricing.decoration.toLocaleString()}
                      </span>
                    </div>
                  )}

                  {booking.pricing.products > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-600">Products</span>
                      <span className="text-sm font-medium text-slate-900">
                        ${booking.pricing.products.toLocaleString()}
                      </span>
                    </div>
                  )}

                  {booking.pricing.additionalChargeAmount > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-600">
                        {booking.pricing.additionalChargeReason
                          ? `Additional Charge (${booking.pricing.additionalChargeReason})`
                          : "Additional Charge"}
                      </span>
                      <span className="text-sm font-medium text-slate-900">
                        ${booking.pricing.additionalChargeAmount.toLocaleString()}
                      </span>
                    </div>
                  )}

                  {booking.pricing.discount > 0 && (
                    <div className="flex justify-between items-center">
                      <div className="min-w-0">
                        <span className="inline-flex items-center gap-2 text-sm text-emerald-600">
                          <span>Discount</span>
                        </span>
                        {booking.appliedCoupons && booking.appliedCoupons.length > 0 ? (
                          <div className="mt-1 flex flex-wrap gap-1.5">
                            {booking.appliedCoupons.map((coupon) => (
                              <span
                                key={coupon.couponId}
                                className="inline-flex items-center rounded border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-700"
                              >
                                {coupon.code}
                              </span>
                            ))}
                          </div>
                        ) : booking.appliedCouponCode ? (
                          <div className="mt-1">
                            <span className="inline-flex items-center rounded border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
                              {booking.appliedCouponCode}
                            </span>
                          </div>
                        ) : null}
                      </div>
                      <span className="text-sm font-medium text-emerald-600">
                        -${booking.pricing.discount.toLocaleString()}
                      </span>
                    </div>
                  )}

                  <div className="border-t border-slate-200 pt-2.5 mt-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-slate-900">Total Amount</span>
                      <span className="text-lg font-bold text-slate-900">
                        ${booking.pricing.total.toLocaleString()}
                      </span>
                    </div>

                    {!isFullyPaid && (
                      <div className="mt-3 space-y-2.5 border-t border-slate-200 pt-2.5">
                        {totalPaid > 0 ? (
                          <div className="flex items-center justify-between gap-4">
                            <span className="text-sm text-slate-600">Amount Paid</span>
                            <span className="text-sm font-medium text-slate-900">
                              ${totalPaid.toLocaleString()}
                            </span>
                          </div>
                        ) : null}

                        {balanceDueAmount > 0 ? (
                          <div className="flex items-center justify-between gap-4">
                            <span className="text-sm text-slate-600">Balance Due</span>
                            <span className="text-sm font-medium text-slate-900">
                              ${balanceDueAmount.toLocaleString()}
                            </span>
                          </div>
                        ) : null}

                        {!hasCapturedAdvance &&
                        lockedAdvanceAmount > 0 &&
                        lockedAdvanceAmount !== balanceDueAmount ? (
                          <div className="flex items-center justify-between gap-4">
                            <span className="text-sm text-slate-600">Advance Due</span>
                            <span className="text-sm font-medium text-slate-900">
                              ${lockedAdvanceAmount.toLocaleString()}
                            </span>
                          </div>
                        ) : null}
                      </div>
                    )}

                    {totalPaid <= 0 && balanceDueAmount <= 0 && lockedAdvanceAmount <= 0 ? (
                      <p className="mt-3 border-t border-slate-200 pt-2.5 text-xs text-slate-500">
                        No payment has been recorded for this booking.
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>

              {/* Payment Details */}
              {booking.paymentDetails && (() => {
                const resolved = resolvePaymentMethod(
                  booking.paymentDetails.provider,
                  booking.paymentDetails.method
                );
                return (
                  <div className="space-y-3 border-t border-slate-200 pt-5">
                    <h3 className="text-sm font-semibold text-slate-900">Payment Details</h3>

                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-4">
                        <span className="text-xs text-slate-500">Payment Method</span>
                        <span className="text-sm font-medium text-slate-900 text-right">
                          {resolved.label}
                        </span>
                      </div>

                      {!resolved.isOffline && (
                        <div className="flex items-start justify-between gap-4">
                          <span className="text-xs text-slate-500">Provider</span>
                          <span className="text-sm font-medium text-slate-900">
                            {resolvePaymentProvider(booking.paymentDetails.provider)}
                          </span>
                        </div>
                      )}

                      <div className="flex items-start justify-between gap-4">
                        <span className="text-xs text-slate-500">Recorded On</span>
                        <span className="text-sm font-medium text-slate-900">
                          {formatVenueDateTime(booking.paymentDetails.createdAt)}
                        </span>
                      </div>

                      {booking.paymentDetails.transactionId && (
                        <div className="flex items-start justify-between gap-4">
                          <span className="text-xs text-slate-500">Reference</span>
                          <MonoValue>{booking.paymentDetails.transactionId}</MonoValue>
                        </div>
                      )}

                      {booking.paymentDetails.recordedByAdminId && (
                        <div className="flex items-start justify-between gap-4">
                          <span className="text-xs text-slate-500">Recorded By</span>
                          <span className="text-sm font-medium text-slate-900">
                            Admin
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* Payment Gateway Details */}
              {(booking.paymentOrderId || booking.paymentTransactionId) && (
                <div className="space-y-3 border-t border-slate-200 pt-5">
                  <h3 className="text-sm font-semibold text-slate-900">
                    Payment Gateway
                  </h3>

                  {booking.paymentOrderId && (
                    <div className="flex items-start justify-between gap-4">
                      <span className="text-xs text-slate-500">Gateway Order ID</span>
                      <MonoValue>{booking.paymentOrderId}</MonoValue>
                    </div>
                  )}

                  {booking.paymentTransactionId && (
                    <div className="flex items-start justify-between gap-4">
                      <span className="text-xs text-slate-500">Gateway Payment ID</span>
                      <MonoValue>{booking.paymentTransactionId}</MonoValue>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
