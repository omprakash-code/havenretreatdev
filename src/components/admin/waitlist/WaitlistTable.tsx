"use client";

import { Eye, Pencil, Trash } from "@/components/icons";
import { formatISTDate, formatISTDateTime } from "@/lib/formatters";
import type { AdminWaitlistEntry, WaitlistStatus } from "@/types/admin/waitlist";

type WaitlistTableProps = {
  data: AdminWaitlistEntry[];
  serialStart?: number;
  onView: (entry: AdminWaitlistEntry) => void;
  onEdit: (entry: AdminWaitlistEntry) => void;
  onDelete: (entry: AdminWaitlistEntry) => void;
};

const STATUS_STYLE: Record<WaitlistStatus, string> = {
  NEW: "bg-amber-50 text-amber-800",
  CONTACTED: "bg-blue-50 text-blue-800",
  CLOSED: "bg-emerald-50 text-emerald-800",
};

function WaitlistStatusBadge({ status }: { status: WaitlistStatus }) {
  return (
    <span
      className={`inline-flex rounded-md px-2.5 py-1 text-xs font-medium ${STATUS_STYLE[status]}`}
    >
      {status}
    </span>
  );
}

function preferredDateTimeText(entry: AdminWaitlistEntry) {
  if (!entry.preferredDate && !entry.preferredTime) return "—";
  if (!entry.preferredDate) return entry.preferredTime ?? "—";
  if (!entry.preferredTime) return formatISTDate(entry.preferredDate);
  return `${formatISTDate(entry.preferredDate)} • ${entry.preferredTime}`;
}

export default function WaitlistTable({
  data,
  serialStart = 0,
  onView,
  onEdit,
  onDelete,
}: WaitlistTableProps) {
  return (
    <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
      <table className="min-w-[980px] w-full border-collapse">
        <thead className="bg-neutral-50 text-left text-[12px] uppercase tracking-wide text-[#111827]">
          <tr className="h-12">
            <th className="w-14 pl-5 pr-4">#</th>
            <th className="px-4">Reference</th>
            <th className="px-4">Name</th>
            <th className="px-4">Contact</th>
            <th className="px-4">PreferTime</th>
            <th className="px-4">Status</th>
            <th className="px-4">Created</th>
            <th className="pl-4 pr-5">Actions</th>
          </tr>
        </thead>

        <tbody>
          {data.map((entry, index) => {
            return (
              <tr
                key={entry.id}
                className="border-t border-neutral-100 text-sm text-neutral-700 transition-colors hover:bg-[#F3F4F6]"
              >
                <td className="py-3 pl-5 pr-4 text-neutral-500">{serialStart + index + 1}</td>
                <td className="px-4 py-3 font-medium text-slate-900 whitespace-nowrap">
                  {entry.reference}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">{entry.name}</td>
                <td className="px-4 py-3">
                  <div className="space-y-0.5">
                    <p className="whitespace-nowrap">{entry.phone}</p>
                    <p className="text-xs text-neutral-500 whitespace-nowrap">
                      {entry.email ?? "No email"}
                    </p>
                  </div>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">{preferredDateTimeText(entry)}</td>
                <td className="px-4 py-3">
                  <WaitlistStatusBadge status={entry.status} />
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  {formatISTDateTime(entry.createdAt)}
                </td>
                <td className="py-3 pl-4 pr-5 whitespace-nowrap">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => onView(entry)}
                      title="View waitlist details"
                      className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
                    >
                      <Eye size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={() => onEdit(entry)}
                      title="Edit waitlist details"
                      className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-indigo-600 transition hover:bg-indigo-50 hover:text-indigo-700"
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(entry)}
                      title="Delete waitlist entry"
                      className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-red-600 transition hover:bg-red-50 hover:text-red-700"
                    >
                      <Trash size={15} />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
