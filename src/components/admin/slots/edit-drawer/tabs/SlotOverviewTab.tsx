"use client";

import { Calendar, IndianRupee, Layers } from "lucide-react";
import SlotStatusPill from "@/components/admin/slots/SlotStatusPill";
import { formatDuration, formatIST, formatISTDate, formatSlotTime } from "@/lib/formatters";
import type { AdminSlot } from "@/types/admin/slot-admin";

/* ---------------------------------
   Reusable Info Row
---------------------------------- */
function InfoRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-xs text-slate-500">{label}</span>
      <span className="text-sm font-medium text-slate-900 text-right">
        {value}
      </span>
    </div>
  );
}

export default function SlotOverviewTab({ slot }: { slot: AdminSlot }) {

  const bookings = slot.bookings ?? [];
  const hasBooking = bookings.length > 0;
  const isBooked = slot.status === "BOOKED" || slot.bookingCount > 0 || hasBooking;

  const derivedStatus =
    slot.status === "LOCKED"
      ? "LOCKED"
      : slot.status === "DISABLED"
        ? "DISABLED"
        : isBooked
          ? "BOOKED"
          : "AVAILABLE";

  return (
    <div className="space-y-6">
      {/* ================= STATUS ================= */}
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3">
        <div className="flex items-center gap-2 justify-between">
          <h3 className="text-sm font-semibold text-slate-900">
            Slot Status
          </h3>
          {slot.isStatusOverridden && (
            <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded">
              Status overridden
            </span>
          )}
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3" >
            <SlotStatusPill status={derivedStatus} />
          </div>
          {hasBooking ? (
          <div className="flex flex-wrap items-center gap-2">
            {bookings.map((booking) => (
              <button
                key={booking.id}
                type="button"
                onClick={() =>
                  window.open(`/admin/bookings?ref=${booking.bookingRef}`, "_blank")
                }
                className="rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-mono text-blue-800 hover:bg-blue-100 cursor-pointer"
              >
                {booking.bookingRef}
              </button>
            ))}
          </div>
        ) : null}
        </div>
      </div>

      {/* ================= SLOT INFO ================= */}
      <div className="border border-slate-200 rounded-lg p-4 space-y-4">
        <div className="flex items-center gap-2 justify-between">
          <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            <Calendar size={16} />
            Slot Information
          </h3>
          {slot.isTimingOverridden && (
            <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded">
              Timing overridden
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <InfoRow
            label="Date"
            value={formatISTDate(slot.date)} />
          <InfoRow
            label="Time"
            value={formatSlotTime(slot.startTime, slot.endTime)}
          />
          <InfoRow
            label="Duration"
            value={formatDuration(slot.durationMin)}
          />
          <InfoRow
            label="Theatre"
            value={slot.theatre.name}
          />
        </div>
      </div>

      {/* ================= TEMPLATE ================= */}
      <div className="border border-slate-200 rounded-lg p-4 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            <Layers size={16} />
            Template Reference
          </h3>
          {slot.template?.isCustomTemplate && (
            <span className="text-xs rounded border border-violet-200 bg-violet-50 px-2 py-0.5 text-violet-700">
              Custom Template
            </span>
          )}
        </div>

        {slot.template ? (
          <>
            <div className="grid grid-cols-2 gap-4">
              <InfoRow
                label="Template Type"
                value={slot.template.isCustomTemplate ? "Custom" : "Standard"}
              />
              <InfoRow
                label="Template Time"
                value={formatSlotTime(slot.template.startTime, slot.template.endTime)}
              />
              <InfoRow
                label="Template Duration"
                value={formatDuration(slot.template.durationMin)}
              />
              <InfoRow
                label="Template Regular Price"
                value={`₹${slot.template.regularPrice.toLocaleString()}`}
              />
              <InfoRow
                label="Template Sale Price"
                value={
                  slot.template.salePrice
                    ? `₹${slot.template.salePrice.toLocaleString()}`
                    : "Not Defined"
                }
              />
            </div>
            <div className="text-xs text-slate-500 italic mt-2 border-t border-slate-200 pt-2">
              Template values are used only when the slot is created.
            </div>
          </>
        ) : (
          <div className="text-xs text-slate-500 italic">
            Template information not available
          </div>
        )}
      </div>
      {/* ================= CURRENT PRICING ================= */}
      <div className="border border-slate-200 rounded-lg p-4 space-y-4">
        <div className="flex items-center gap-2 justify-between">
          <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            <IndianRupee size={16} />
            Current Pricing
          </h3>

          {slot.isPricingOverridden && (
            <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded">
              Price overridden
            </span>
          )}
        </div>

        <InfoRow
          label="Regular Price"
          value={`₹${slot.pricing.regular.toLocaleString()}`}
        />
        <InfoRow
          label="Sale Price"
          value={
            slot.pricing.sale
              ? `₹${slot.pricing.sale.toLocaleString()}`
              : "Not Defined"
          }
        />

        <div className="border-t border-slate-200 pt-3">
          <InfoRow
            label="Booking Price"
            value={
              <span className="text-lg font-bold">
                ₹{slot.pricing.final.toLocaleString()}
              </span>
            }
          />
        </div>

        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-slate-500">
            Special Message
          </span>

          {slot.pricing.discountText ? (
            <div className="inline-block text-xs text-slate-800 bg-white-50 px-2 py-1 rounded border border-slate-400">
              {slot.pricing.discountText}
            </div>
          ) : (
            <span className="text-xs text-slate-400 italic">
              No special message
            </span>
          )}
        </div>
      </div>

      {/* ================= OVERRIDE INFO ================= */}
      {slot.isOverridden && (
        <div className="border border-amber-200 bg-amber-50 rounded-lg p-4 space-y-3">
          <h3 className="text-sm font-semibold text-amber-900">
            Override Information
          </h3>

          <InfoRow
            label="Reason"
            value={slot.overrideReason ?? "—"}
          />
          <InfoRow
            label="Modified At"
            value={
              slot.slotModifiedAt
                ? formatIST(slot.slotModifiedAt)
                : "—"
            }
          />
          <InfoRow
            label="Modified By"
            value={slot.slotModifiedBy ?? "—"}
          />
        </div>
      )}
    </div>
  );
}
