"use client";

import { Download, Eye, Pencil, Trash } from "@/components/icons";
import BookingStatusPill from "./BookingStatusPill";
import type { AdminBooking } from "@/types/admin/booking-admin";
import { SLA_META } from "@/lib/admin/sla";
import type { SLAStatus } from "@/lib/admin/sla";
import { Phone } from "lucide-react";
import { WhatsAppIcon } from "@/components/icons/WhatsApp";

import {
  formatET,
  maskPhone,
} from "@/lib/formatters";

type BookingWithOptionalSLA = AdminBooking & {
  sla?: {
    label: SLAStatus;
  };
};

/* -----------------------------
   Props
------------------------------ */
type BookingRowProps = {
  booking: BookingWithOptionalSLA;
  view?: "default" | "abandoned" | "live";
  selected: boolean;
  onSelect: () => void;
  srNo: number;
  showContact?: boolean;
  showSLA?: boolean;
  showSelection?: boolean;
  hideSelectionColumn?: boolean;
  onView?: (booking: AdminBooking) => void;
  onEdit?: (booking: AdminBooking) => void;
  onDelete?: (booking: AdminBooking) => void;
  onDownloadPdf?: (booking: AdminBooking) => void;
  isDownloadingPdf?: boolean;
};


export default function BookingRow({
  booking,
  view = "default",
  selected,
  onSelect,
  srNo,
  showContact = false,
  showSLA = false,
  showSelection = true,
  hideSelectionColumn = false,
  onView,
  onEdit,
  onDelete,
  onDownloadPdf,
  isDownloadingPdf = false,
}: BookingRowProps) {
  const sla =
    showSLA && booking.sla
      ? SLA_META[booking.sla.label]
      : null;
  const scheduleDateLabel =
    booking.schedule?.dateLabel || formatET(booking.slot.date).split(",")[0];
  const scheduleTimeLabel =
    booking.schedule?.timeLabel ||
    `${booking.slot.startTime} - ${booking.slot.endTime}`;

  return (
    <tr className="border-t border-neutral-200 text-[13px] text-neutral-800 hover:bg-[#F3F4F6] transition-colors">
      {/* Checkbox */}
      {showSelection ? (
        <td className={`w-10 py-3 pl-5 pr-2 ${hideSelectionColumn ? "hidden" : ""}`}>
          <div className="flex items-center justify-center">
            <input
              type="checkbox"
              checked={selected}
              onChange={onSelect}
              className="h-4 w-4 rounded-sm border-neutral-300 accent-neutral-900 focus:ring-0"
            />
          </div>
        </td>
      ) : null}

      {/* Sr No */}
      <td className={`py-3 text-neutral-500 ${showSelection && !hideSelectionColumn ? "px-3" : "pl-5 pr-3"}`}>
        {srNo}
      </td>

      {/* Booking Ref */}
      <td className="px-3 py-3 whitespace-nowrap">
        <div className="flex flex-col gap-1">
          <div className="inline-flex items-center gap-2">
            <button
              onClick={() => onView?.(booking)}
              className="font-medium text-slate-900 hover:text-blue-600 hover:underline transition-colors cursor-pointer"
              title="Click to view booking details"
            >
              {booking.bookingRef}
            </button>

            {showSLA && sla ? (
              <span
                className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-semibold ${sla.className}`}
                title={sla.label}
              >
                <sla.icon size={12} />
              </span>
            ) : null}
          </div>

          {booking.theatre.locationName ? (
            <div className="text-xs text-neutral-500">
              {booking.theatre.locationName}
            </div>
          ) : null}
        </div>
      </td>

      {/* Customer */}
      <td className="px-3 py-3 whitespace-nowrap">
        {booking.customer?.name ?? "Guest"}
      </td>

      {/* Phone */}
      <td className="px-3 py-3 text-neutral-500">
        {maskPhone(booking.customer?.phone)}
      </td>

      {/* Package */}
      <td className="px-3 py-3">{booking.package?.name ?? booking.theatre.name}</td>

      {/* Booking Date & Time */}
      <td className="px-3 py-3 whitespace-nowrap leading-tight">
        <div>
          {scheduleDateLabel}
        </div>
        <div className="text-xs text-neutral-500">
          {scheduleTimeLabel}
        </div>
      </td>


      {/* Amount */}
      <td className="px-3 py-3 whitespace-nowrap">
        <div className="font-semibold">
          ${booking.pricing.total.toLocaleString()}
        </div>

        {booking.pricing.remainingPayable > 0 && (
          <div className="text-xs text-neutral-500">
            ${booking.pricing.remainingPayable.toLocaleString()} due
          </div>
        )}
      </td>


      {/* Payment Status */}
      <td className="px-3 py-3 whitespace-nowrap">
        <BookingStatusPill
          status={
            view === "abandoned" && booking.bookingStatus === "PAYMENT_PROCESSING"
              ? "ABANDONED"
              : booking.bookingStatus ?? "PENDING"
          }
          paymentStatus={booking.paymentStatus}
          cancelledReason={
            view === "abandoned" && booking.bookingStatus === "PAYMENT_PROCESSING"
              ? "PAYMENT_CHECKOUT_ABANDONED"
              : booking.cancelledReason
          }
        />
      </td>

      {/* Created At */}
      <td className="px-3 py-3 text-neutral-500 leading-tight whitespace-nowrap">
        <div>{formatET(booking.createdAt).split(",")[0]}</div>
        <div className="text-xs">
          {formatET(booking.createdAt).split(",")[1]}
        </div>
      </td>

      {/* Contact */}
      {showContact && (
        <td className="px-3 py-3 whitespace-nowrap">
          {booking.customer?.phone ? (
            <div className="flex items-center gap-2">
              <a
                href={`tel:${booking.customer.phone}`}
                title="Call customer"
                className="text-blue-400 hover:text-blue-800"
              >
                <Phone size={16} />
              </a>

              <a
                href={`https://wa.me/1${booking.customer.phone}`}
                target="_blank"
                title="WhatsApp customer"
                className="text-green-600 hover:text-green-700"
              >
                <WhatsAppIcon size={16} />
              </a>
            </div>
          ) : (
            <span className="text-neutral-400">—</span>
          )}
        </td>
      )}

      {/* Actions */}
      <td className="relative py-3 pl-1.5 pr-4">
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => onView?.(booking)}
            title="View booking details"
            className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
          >
            <Eye size={14} />
          </button>

          {onEdit ? (
            <button
              onClick={() => onEdit(booking)}
              title="Edit booking"
              className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-amber-600 transition hover:bg-amber-50 hover:text-amber-700"
            >
              <Pencil size={14} />
            </button>
          ) : null}

          {onDownloadPdf ? (
            <button
              onClick={() => onDownloadPdf(booking)}
              title="Download booking PDF"
              disabled={isDownloadingPdf}
              className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-blue-600 transition hover:bg-blue-50 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Download size={14} />
            </button>
          ) : null}

          {onDelete ? (
            <button
              onClick={() => onDelete(booking)}
              title="Delete booking"
              className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-red-600 transition hover:bg-red-50 hover:text-red-700"
            >
              <Trash size={14} />
            </button>
          ) : null}

        </div>
      </td>
    </tr>
  );
}
