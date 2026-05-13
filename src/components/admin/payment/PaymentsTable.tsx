"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatISTDateTime } from "@/lib/formatters";
import { Info } from "@/components/icons";
import type { AdminPaymentRecord } from "@/types/payment";

type Props = {
  data: AdminPaymentRecord[];
  serialStart?: number;
};

const STATUS_STYLE: Record<string, string> = {
  PAID: "bg-emerald-50 text-emerald-800",
  FAILED: "bg-red-50 text-red-800",
  CANCELLED: "bg-orange-50 text-orange-800",
  INITIALIZED: "bg-amber-50 text-amber-800",
  AWAITING_PAYMENT: "bg-blue-50 text-blue-800",
  EXPIRED: "bg-slate-100 text-slate-700",
  OFFLINE: "bg-violet-50 text-violet-800",
};

function PaymentStatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex rounded-md px-2.5 py-1 text-xs font-medium ${
        STATUS_STYLE[status] ?? "bg-slate-100 text-slate-700"
      }`}
    >
      {status}
    </span>
  );
}

export default function PaymentsTable({
  data,
  serialStart = 0,
}: Props) {
  const [openReasonId, setOpenReasonId] = useState<string | null>(null);

  useEffect(() => {
    if (!openReasonId) return;

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      if (target.closest("[data-payment-reason-tooltip]")) return;
      setOpenReasonId(null);
    };

    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpenReasonId(null);
      }
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onEscape);
    };
  }, [openReasonId]);

  return (
    <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
      <table className="min-w-[980px] w-full border-collapse">
        <thead className="bg-neutral-50 text-left text-[12px] uppercase tracking-wide text-[#111827]">
          <tr className="h-12">
            <th className="w-14 pl-5 pr-4">#</th>
            <th className="px-4">Booking ID</th>
            <th className="px-4">Customer</th>
            <th className="px-4">Phone</th>
            <th className="px-4">Amount</th>
            <th className="px-4">Status</th>
            <th className="px-4">Provider</th>
            <th className="px-4">Transaction ID</th>
            <th className="pl-4 pr-5">Date</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row, index) => (
            <tr
              key={row.id}
              className="border-t border-neutral-100 text-sm text-neutral-700 hover:bg-[#F3F4F6] transition-colors"
            >
              <td className="py-3 pl-5 pr-4 text-neutral-500">
                {serialStart + index + 1}
              </td>
              <td className="px-4 py-3 whitespace-nowrap">
                <Link
                  href={`/admin/bookings?ref=${encodeURIComponent(row.bookingRef)}`}
                  className="font-medium text-slate-900 hover:text-blue-600 hover:underline transition-colors"
                  title="Open booking in bookings drawer"
                >
                  {row.bookingRef}
                </Link>
              </td>
              <td className="px-4 py-3 whitespace-nowrap">
                {row.customerName ?? "—"}
              </td>
              <td className="px-4 py-3 whitespace-nowrap">{row.contactPhone ?? "—"}</td>
              <td className="px-4 py-3">
                <div className="space-y-0.5">
                  <p className="text-sm text-neutral-900">
                    ₹{row.totalAmount.toLocaleString()}
                  </p>
                  <p className="text-sm font-semibold text-neutral-900">
                    ₹{row.payableAmount.toLocaleString()}
                  </p>
                </div>
              </td>
              <td className="px-4 py-3 whitespace-nowrap">
                <div className="flex items-center gap-1">
                  <PaymentStatusBadge status={row.status} />
                  {row.attemptReason ? (
                    <div
                      data-payment-reason-tooltip
                      className="relative inline-flex items-center"
                    >
                      <button
                        type="button"
                        aria-label="Payment attempt reason"
                        aria-haspopup="dialog"
                        aria-expanded={openReasonId === row.id}
                        onMouseEnter={() => setOpenReasonId(row.id)}
                        onMouseLeave={() => setOpenReasonId((current) => (current === row.id ? null : current))}
                        onFocus={() => setOpenReasonId(row.id)}
                        onBlur={(event) => {
                          const next = event.relatedTarget as HTMLElement | null;
                          if (next?.closest("[data-payment-reason-tooltip]")) return;
                          setOpenReasonId((current) => (current === row.id ? null : current));
                        }}
                        onClick={() =>
                          setOpenReasonId((current) =>
                            current === row.id ? null : row.id
                          )
                        }
                        className="inline-flex cursor-pointer items-center justify-center rounded-sm text-neutral-400 outline-none transition hover:text-neutral-600 focus-visible:text-neutral-700"
                      >
                        <Info size={14} />
                      </button>
                      <div
                        className={`absolute bottom-full mb-2 left-1/2 z-50 w-72 max-w-[calc(100vw-1.5rem)] -translate-x-1/2 whitespace-normal break-words rounded-md border border-neutral-200 bg-white px-2.5 py-1.5 text-[11px] leading-4 text-neutral-700 shadow-lg transition-opacity duration-100 sm:w-80 ${
                          openReasonId === row.id
                            ? "opacity-100"
                            : "pointer-events-none opacity-0"
                        }`}
                      >
                        {row.attemptReason}
                      </div>
                    </div>
                  ) : null}
                </div>
              </td>
              <td className="px-4 py-3 whitespace-nowrap">{row.provider}</td>
              <td className="px-4 py-3 font-mono text-xs whitespace-nowrap">
                {row.transactionId ?? "No Transaction id"}
              </td>
              <td className="py-3 pl-4 pr-5 whitespace-nowrap">
                {formatISTDateTime(row.createdAt)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
