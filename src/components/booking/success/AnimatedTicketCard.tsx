"use client";

import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  MapPin,
  Calendar,
  Clock,
  Users,
  User,
  Ticket,
  WhatsAppIcon,
  Download,
  Copy,
  Phone,
  Mail,
  ShieldCheck,
  FileText,
} from "@/components/icons";
import type { BookingSuccessData } from "@/components/booking/success/types";
import { downloadBookingTicketPdf } from "@/components/booking/success/pdf/downloadBookingTicketPdf";
import { downloadSignedAgreementPdf } from "@/components/booking/success/pdf/downloadSignedAgreementPdf";
import { useBooking } from "@/context/BookingContext";
import ReviewStatusTrail from "@/components/booking/success/ReviewStatusTrail";
import {
  buildHavenWhatsAppUrl,
  HAVEN_WHATSAPP_DISPLAY_NUMBER,
} from "@/constants/haven-contact";
import {
  BOOKING_PAYMENT_APPLIED_MESSAGE,
  BOOKING_PENDING_REVIEW_STATUS_VALUE,
} from "@/constants/booking-status-copy";
import { HAVEN_AGREEMENT_TOTAL_CLAUSES } from "@/constants/haven-agreement-content";

type AnimatedTicketCardProps = {
  data: BookingSuccessData;
  embedded?: boolean;
};

const SHOW_DOWNLOAD_TICKET_ACTION = true;

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatHourValue(hours: number) {
  return Number.isInteger(hours) ? `${hours}h` : `${hours.toFixed(1)}h`;
}

function formatDurationLabel(data: BookingSuccessData) {
  const durationHours = data.durationHours ?? null;
  if (durationHours === null || !Number.isFinite(durationHours)) return "—";

  const included = data.includedDurationHours ?? 4;
  const extra = data.extraDurationHours ?? Math.max(durationHours - included, 0);

  if (extra > 0) {
    return `${formatHourValue(durationHours)} (${formatHourValue(included)} included + ${formatHourValue(extra)} extra)`;
  }

  return `${formatHourValue(durationHours)} included`;
}

export default function AnimatedTicketCard({
  data,
  embedded = false,
}: AnimatedTicketCardProps) {
  const router = useRouter();
  const { resetBooking } = useBooking();
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [isDownloadingAgreement, setIsDownloadingAgreement] = useState(false);
  const [isBookingRefCopied, setIsBookingRefCopied] = useState(false);
  const [isStartingAnotherBooking, setIsStartingAnotherBooking] = useState(false);
  const discountAmount = data.discountAmount ?? 0;
  const subtotalBeforeDiscount = data.totalAmount + discountAmount;
  const showDiscountBreakdown = discountAmount > 0;
  const additionalChargeAmount = data.additionalChargeAmount ?? 0;
  // A booking under review has no payment yet: approval and payment are
  // separate lifecycles, so show what is owed rather than a $0 "paid" row.
  const hasCollectedPayment = data.advancePaid > 0;
  const isFullPayment =
    data.remainingPayable <= 0 || data.advancePaid >= data.totalAmount;
  const isCustomerAdvanceFlow =
    data.createdByRole !== "ADMIN" &&
    data.paymentStatus === "PAID" &&
    data.advancePaid > 0 &&
    data.remainingPayable > 0;
  const isAdminAdvanceFlow =
    data.createdByRole === "ADMIN" &&
    data.bookingStatus === "APPROVED" &&
    data.advancePaid > 0 &&
    data.remainingPayable > 0;
  const showRemainingRow =
    !isFullPayment && (isCustomerAdvanceFlow || isAdminAdvanceFlow);
  const remainingLabel = "Remaining Balance";
  const handleWhatsAppShare = () => {
    const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "";
    const shareUrl =
      typeof window !== "undefined"
        ? window.location.href
        : `${APP_URL}/booking/success`;
    const emoji = {
      calendar: "\u{1F4C5}",
      clock: "\u{1F558}",
      location: "\u{1F4CD}",
      sparkle: "\u2728",
      tag: "\u{1F516}",
    } as const;

    const message = `${emoji.sparkle} I just booked my private venue experience at Haven Retreat!

${emoji.location} Location: ${data.locationName}
${emoji.calendar} Date: ${data.date}
${emoji.clock} Time: ${data.timeSlot}
${emoji.tag} Booking Reference: ${data.bookingRef}

View my booking:
${shareUrl}

#HavenRetreat`;

    const whatsappUrl = new URL("https://api.whatsapp.com/send");
    whatsappUrl.searchParams.set("text", message);
    window.open(whatsappUrl.toString(), "_blank");
  };

  const handleDownload = async () => {
    if (isDownloadingPdf) return;

    setIsDownloadingPdf(true);
    try {
      await downloadBookingTicketPdf(data);
      toast.success("Ticket downloaded successfully.");
    } catch {
      toast.error("Unable to download ticket right now.");
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const handleAgreementDownload = async () => {
    if (isDownloadingAgreement || !data.signedAgreement) return;

    setIsDownloadingAgreement(true);
    try {
      await downloadSignedAgreementPdf(data);
      toast.success("Signed agreement downloaded successfully.");
    } catch {
      toast.error("Unable to download the signed agreement right now.");
    } finally {
      setIsDownloadingAgreement(false);
    }
  };

  const handleBookAnother = async () => {
    if (isStartingAnotherBooking) return;

    setIsStartingAnotherBooking(true);

    // Opened blank on the click itself. Opening it after the reset resolves puts
    // it outside the user gesture, which is what popup blockers stop.
    const newTab = window.open("about:blank", "_blank");

    try {
      const response = await fetch("/api/session/reset", {
        method: "POST",
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("SESSION_RESET_FAILED");
      }
    } catch {
      newTab?.close();
      toast.error("Unable to start a new booking. Please try again.");
      setIsStartingAnotherBooking(false);
      return;
    }

    // A tab opened from this one inherits a copy of its sessionStorage, so the
    // stale package has to be cleared before the new tab navigates.
    sessionStorage.removeItem("hr_pending_package_id");
    sessionStorage.removeItem("hr_pending_package_name");
    sessionStorage.removeItem("hr_pending_package_rate");
    sessionStorage.removeItem("hr_pending_package_base_price");
    resetBooking();

    if (newTab) {
      newTab.opener = null;
      newTab.location.href = "/booking";
    } else {
      // Blocked. Better to lose the new tab than the booking.
      router.push("/booking");
    }

    setIsStartingAnotherBooking(false);
  };

  useEffect(() => {
    if (!isBookingRefCopied) return;

    const timeoutId = window.setTimeout(() => {
      setIsBookingRefCopied(false);
    }, 1000);

    return () => window.clearTimeout(timeoutId);
  }, [isBookingRefCopied]);

  const handleCopyBookingRef = async () => {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(data.bookingRef);
      } else if (typeof document !== "undefined") {
        const input = document.createElement("textarea");
        input.value = data.bookingRef;
        input.style.position = "fixed";
        input.style.opacity = "0";
        document.body.appendChild(input);
        input.focus();
        input.select();
        document.execCommand("copy");
        document.body.removeChild(input);
      }
      setIsBookingRefCopied(true);
    } catch {
      setIsBookingRefCopied(false);
    }
  };

  return (
    <motion.div
      initial={{
        opacity: 0,
        rotateY: -15,
        rotateX: 10,
        filter: "blur(10px)",
        scale: 0.9,
      }}
      animate={{
        opacity: 1,
        rotateY: 0,
        rotateX: 0,
        filter: "blur(0px)",
        scale: 1,
      }}
      transition={{
        duration: 1,
        delay: 0.2,
        ease: [0.16, 1, 0.3, 1],
      }}
      className="relative"
      style={{ perspective: "1000px" }}
    >
      <div
        className={
          embedded
            ? "relative"
            : "relative overflow-hidden border border-[#2f7e7a]/20 bg-white shadow-xl shadow-[#cfdedb]/60"
        }
      >
        <div className="space-y-3.5 px-0 pb-3 sm:space-y-4 sm:px-4 sm:pb-4 md:px-5">
          <div className="flex flex-col gap-3">
            {/* The trail sits beside the reference and only drops beneath it
                when the row runs out of width. Aligning the row to its end lands
                the trail on the reference line rather than centring it against
                the label stacked above it. */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
              <div className="min-w-0 text-left lg:flex lg:flex-col lg:justify-start lg:gap-[5px]">
                <div className="flex max-w-full flex-nowrap items-center gap-2">
                  <p className="whitespace-nowrap text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500 sm:text-xs">
                    Booking Reference
                  </p>
                </div>
                <div className="relative mt-1 inline-flex max-w-full items-center gap-1.5">
                  <code className="relative z-10 max-w-[calc(100vw-8rem)] truncate whitespace-nowrap border border-[#d7e4e1] bg-[#f8fbfa] px-2 py-1 text-xs font-bold tracking-wider text-zinc-900 sm:max-w-none sm:px-2.5 sm:text-sm">
                    {data.bookingRef}
                  </code>
                  <button
                    type="button"
                    onClick={handleCopyBookingRef}
                    title={isBookingRefCopied ? "Copied" : "Copy booking reference"}
                    className="inline-flex h-8 min-w-8 shrink-0 cursor-pointer items-center justify-center border border-[#d7e4e1] bg-white px-2 text-zinc-600 transition hover:bg-[#f8fbfa] hover:text-[#245e5b]"
                  >
                    {isBookingRefCopied ? (
                      <span className="text-[11px] font-semibold text-emerald-600">Copied</span>
                    ) : (
                      <Copy size={14} />
                    )}
                  </button>
                </div>
              </div>

              <ReviewStatusTrail bookingStatus={data.bookingStatus} />
            </div>

            <div className="hidden lg:grid lg:grid-cols-2 lg:gap-3 xl:grid-cols-[1fr_1.4fr_1.05fr_1.05fr]">
              {SHOW_DOWNLOAD_TICKET_ACTION && (
                <MiniActionButton
                  label={isDownloadingPdf ? "Downloading..." : "Download Receipt"}
                  icon={<Download size={14} />}
                  onClick={handleDownload}
                  variant="primary"
                  disabled={isDownloadingPdf}
                />
              )}
              {data.signedAgreement && (
                <MiniActionButton
                  label={
                    isDownloadingAgreement
                      ? "Downloading..."
                      : "Download Signed Agreement"
                  }
                  icon={<FileText size={14} />}
                  onClick={handleAgreementDownload}
                  variant="secondary"
                  disabled={isDownloadingAgreement}
                />
              )}
              <MiniActionButton
                label="Share on WhatsApp"
                icon={<WhatsAppIcon size={14} />}
                onClick={handleWhatsAppShare}
                variant="secondary"
              />
              <MiniActionButton
                label={
                  isStartingAnotherBooking
                    ? "Starting New Booking..."
                    : "Book Another Time"
                }
                icon={<Ticket size={14} />}
                onClick={handleBookAnother}
                variant="tertiary"
                disabled={isStartingAnotherBooking}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 lg:grid-cols-3">
            <DetailItem
              icon={<User size={16} />}
              label="Booked By"
              value={data.contact.name}
            />
            <DetailItem
              icon={<Phone size={16} />}
              label="Phone"
              value={data.contact.phone}
            />
            {data.contact.email ? (
              <DetailItem
                icon={<Mail size={16} />}
                label="Email"
                value={data.contact.email}
              />
            ) : null}
            <DetailItem
              icon={<Ticket size={16} />}
              label="Package"
              value={data.theatreName}
            />
            <DetailItem
              icon={<Calendar size={16} />}
              label="Date"
              value={data.date}
            />
            <DetailItem
              icon={<Clock size={16} />}
              label="Time"
              value={data.timeSlot}
            />
            <DetailItem
              icon={<Clock size={16} />}
              label="Duration"
              value={formatDurationLabel(data)}
            />
            <DetailItem
              icon={<MapPin size={16} />}
              label="Location"
              value={data.locationName}
            />
            <DetailItem
              icon={<Users size={16} />}
              label="Guests"
              value={`${data.guestCount} People`}
            />
          </div>

          <div className="mb-3 space-y-1.5 border border-[#d7e4e1] bg-[#f8fbfa] p-2.5 sm:p-3.5">
            {showDiscountBreakdown && (
              <PriceRow
                label="Subtotal (Before Discount)"
                value={formatCurrency(subtotalBeforeDiscount)}
              />
            )}
            {showDiscountBreakdown && (
              <PriceRow
                label="Discount"
                value={`-${formatCurrency(discountAmount)}`}
                highlight
              />
            )}
            {additionalChargeAmount > 0 && (
              <PriceRow
                label={
                  data.additionalChargeReason
                    ? `Additional Charge (${data.additionalChargeReason})`
                    : "Additional Charge"
                }
                value={formatCurrency(additionalChargeAmount)}
              />
            )}
            <PriceRow
              label={
                showDiscountBreakdown
                  ? "Final Total (After Discount)"
                  : "Total Amount"
              }
              value={formatCurrency(data.totalAmount)}
              bold={showDiscountBreakdown}
            />

            {hasCollectedPayment ? (
              <PriceRow
                label={
                  "Amount Paid"
                }
                value={formatCurrency(data.advancePaid)}
                success
              />
            ) : (
              // Nothing is owed on a request under review, and the trail above
              // already says where it stands, so only the status is reported.
              <PriceRow
                label="Status"
                value={
                  data.bookingStatusLabel ?? BOOKING_PENDING_REVIEW_STATUS_VALUE
                }
              />
            )}
            {showRemainingRow && (
              <div className="mt-2 space-y-2 border-t border-slate-200 pt-2">
                <PriceRow
                  label={remainingLabel}
                  value={formatCurrency(data.remainingPayable)}
                  bold
                />
                <p className="text-[11px] leading-5 text-slate-500 sm:text-xs">
                  {BOOKING_PAYMENT_APPLIED_MESSAGE}
                </p>
              </div>
            )}
          </div>

          {data.signedAgreement && (
            <div className="border border-[#d7e4e1] bg-white p-2.5 text-[11px] leading-5 text-slate-600 sm:p-3 sm:text-xs">
              <div className="flex items-start gap-2">
                <FileText
                  size={15}
                  className="mt-0.5 shrink-0 text-[#347f7c]"
                />
                <div>
                  <p className="font-semibold text-[#245e5b]">
                    Signed agreement recorded
                  </p>
                  <p className="mt-0.5">
                    All {HAVEN_AGREEMENT_TOTAL_CLAUSES} clauses acknowledged by{" "}
                    {data.signedAgreement.signerName}. Download the signed
                    agreement for details.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="border border-[#d7e4e1] bg-white p-2.5 text-[11px] leading-5 text-slate-600 sm:p-3 sm:text-xs">
            <div className="flex items-start gap-2">
              <ShieldCheck size={15} className="mt-0.5 shrink-0 text-[#347f7c]" />
              <p>
                Need help? Message us on WhatsApp at{" "}
                <a
                  href={buildHavenWhatsAppUrl(
                    `Hi Haven Retreat, I need help with my booking ${data.bookingRef}.`
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold whitespace-nowrap text-[#245e5b] underline underline-offset-2 transition hover:text-[#347f7c]"
                >
                  {HAVEN_WHATSAPP_DISPLAY_NUMBER}
                </a>
                . Your booking reference is already included.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 lg:hidden">
            {SHOW_DOWNLOAD_TICKET_ACTION && (
              <MiniActionButton
                label={isDownloadingPdf ? "Downloading..." : "Download Receipt"}
                icon={<Download size={14} />}
                onClick={handleDownload}
                variant="primary"
                disabled={isDownloadingPdf}
              />
            )}
            {data.signedAgreement && (
              <MiniActionButton
                label={
                  isDownloadingAgreement
                    ? "Downloading..."
                    : "Download Signed Agreement"
                }
                icon={<FileText size={14} />}
                onClick={handleAgreementDownload}
                variant="secondary"
                disabled={isDownloadingAgreement}
              />
            )}
            <MiniActionButton
              label="Share on WhatsApp"
              icon={<WhatsAppIcon size={14} />}
              onClick={handleWhatsAppShare}
              variant="secondary"
            />
            <MiniActionButton
              label={
                isStartingAnotherBooking
                  ? "Starting New Booking..."
                  : "Book Another Time"
              }
              icon={<Ticket size={14} />}
              onClick={handleBookAnother}
              variant="tertiary"
              disabled={isStartingAnotherBooking}
            />
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function DetailItem({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="space-y-1 border border-[#d7e4e1] bg-white p-2">
      <div className="flex items-center gap-1.5 text-slate-500">
        {icon}
        <p className="text-[10px] uppercase tracking-wide sm:text-xs">{label}</p>
      </div>
      <p className="break-words text-xs font-semibold leading-snug text-slate-900 sm:text-sm">
        {value}
      </p>
    </div>
  );
}

function PriceRow({
  label,
  value,
  bold,
  highlight,
  success,
}: {
  label: string;
  value: string;
  bold?: boolean;
  highlight?: boolean;
  success?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-xs leading-snug text-slate-600 sm:text-sm">{label}</span>
      <span
        className={`shrink-0 text-xs sm:text-sm ${bold
            ? "font-bold text-slate-900"
            : highlight
              ? "font-semibold text-emerald-600"
              : success
                ? "font-semibold text-emerald-600"
                : "text-slate-900"
          }`}
      >
        {value}
      </span>
    </div>
  );
}

function MiniActionButton({
  icon,
  label,
  onClick,
  variant,
  disabled = false,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  variant: "primary" | "secondary" | "tertiary";
  disabled?: boolean;
}) {
  const variantClass =
    variant === "primary"
      ? "border border-[#347f7c] bg-[#347f7c] text-white hover:bg-[#245e5b]"
      : variant === "secondary"
        ? "border border-[#2f7e7a]/35 bg-[#edf3f1] text-[#245e5b] hover:bg-[#e3efec]"
        : "border border-[#d7e4e1] bg-transparent text-zinc-700 hover:bg-[#f8fbfa]";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex h-10 w-full min-w-0 items-center justify-center gap-1.5 px-2.5 text-[11px] font-semibold whitespace-nowrap transition-colors sm:w-auto sm:px-3 sm:text-xs lg:w-full ${disabled
          ? "cursor-not-allowed border border-zinc-300 bg-zinc-200 text-zinc-500"
          : `cursor-pointer ${variantClass}`
        }`}
    >
      <span className="flex h-4 w-4 shrink-0 items-center justify-center">
        {icon}
      </span>
      <span>{label}</span>
    </button>
  );
}
