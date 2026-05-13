"use client";

import { History, ShieldCheck } from "lucide-react";
import { formatIST } from "@/lib/formatters";
import type { AdminSlot } from "@/types/admin/slot-admin";

/* ---------------------------------
   Slot Audit Tab (Read-only)
---------------------------------- */
export default function SlotAuditTab({
  slot,
}: {
  slot: AdminSlot;
}) {
  return (
    <div className="space-y-6">
      {/* ================= OVERRIDE STATUS ================= */}
      <div className="border border-slate-200 rounded-lg p-4 space-y-2">
        <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
          <ShieldCheck size={16} />
          Override Status
        </h3>

        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-500">
            Slot Overridden
          </span>
          <span className="text-sm font-medium text-slate-900">
            {slot.isOverridden ? "Yes" : "No"}
          </span>
        </div>

        {slot.isOverridden && (
          <>
            <div className="flex items-start justify-between gap-4">
              <span className="text-xs text-slate-500">
                Reason
              </span>
              <span className="text-sm text-slate-900 text-right">
                {slot.overrideReason || "—"}
              </span>
            </div>

            <div className="flex items-start justify-between gap-4">
              <span className="text-xs text-slate-500">
                Modified By
              </span>
              <span className="text-sm text-slate-900">
                {slot.slotModifiedBy || "—"}
              </span>
            </div>

            <div className="flex items-start justify-between gap-4">
              <span className="text-xs text-slate-500">
                Modified At
              </span>
              <span className="text-sm text-slate-900">
                {slot.slotModifiedAt
                  ? formatIST(slot.slotModifiedAt)
                  : "—"}
              </span>
            </div>
          </>
        )}
      </div>

      {/* ================= SYSTEM METADATA ================= */}
      <div className="border border-slate-200 rounded-lg p-4 space-y-3">
        <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
          <History size={16} />
          System Metadata
        </h3>

        <div className="flex items-start justify-between gap-4">
          <span className="text-xs text-slate-500">
            Created At
          </span>
          <span className="text-sm text-slate-900">
            {formatIST(slot.createdAt)}
          </span>
        </div>

        <div className="flex items-start justify-between gap-4">
          <span className="text-xs text-slate-500">
            Last Updated
          </span>
          <span className="text-sm text-slate-900">
            {formatIST(slot.updatedAt)}
          </span>
        </div>
      </div>
    </div>
  );
}
