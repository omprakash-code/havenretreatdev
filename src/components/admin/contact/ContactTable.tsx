"use client";

import { Eye, Pencil, Trash } from "@/components/icons";
import { formatISTDateTime } from "@/lib/formatters";
import type { AdminContactInquiry, ContactInquiryStatus } from "@/types/admin/contact";

type ContactTableProps = {
  data: AdminContactInquiry[];
  serialStart?: number;
  onView: (inquiry: AdminContactInquiry) => void;
  onEdit: (inquiry: AdminContactInquiry) => void;
  onDelete: (inquiry: AdminContactInquiry) => void;
};

const STATUS_STYLE: Record<ContactInquiryStatus, string> = {
  NEW: "bg-amber-50 text-amber-800",
  CONTACTED: "bg-blue-50 text-blue-800",
  CLOSED: "bg-emerald-50 text-emerald-800",
};

function StatusBadge({ status }: { status: ContactInquiryStatus }) {
  return (
    <span
      className={`inline-flex rounded-md px-2.5 py-1 text-xs font-medium ${STATUS_STYLE[status]}`}
    >
      {status}
    </span>
  );
}

function truncateMessage(message: string) {
  const trimmed = message.trim();
  if (trimmed.length <= 80) return trimmed;
  return `${trimmed.slice(0, 80)}...`;
}

export default function ContactTable({
  data,
  serialStart = 0,
  onView,
  onEdit,
  onDelete,
}: ContactTableProps) {
  return (
    <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
      <table className="min-w-[860px] w-full border-collapse">
        <thead className="bg-neutral-50 text-left text-[12px] uppercase tracking-wide text-[#111827]">
          <tr className="h-12">
            <th className="w-14 pl-5 pr-4">#</th>
            <th className="px-4">Name</th>
            <th className="px-4">Mobile</th>
            <th className="px-4">Message</th>
            <th className="px-4">Status</th>
            <th className="px-4">Created</th>
            <th className="pl-4 pr-5">Actions</th>
          </tr>
        </thead>

        <tbody>
          {data.map((row, index) => (
            <tr
              key={row.id}
              className="border-t border-neutral-100 text-sm text-neutral-700 transition-colors hover:bg-[#F3F4F6]"
            >
              <td className="py-3 pl-5 pr-4 text-neutral-500">{serialStart + index + 1}</td>
              <td className="px-4 py-3 whitespace-nowrap">{row.name}</td>
              <td className="px-4 py-3 whitespace-nowrap">{row.mobile}</td>
              <td className="px-4 py-3">
                <p className="max-w-[320px] truncate" title={row.message}>
                  {truncateMessage(row.message)}
                </p>
              </td>
              <td className="px-4 py-3">
                <StatusBadge status={row.status} />
              </td>
              <td className="px-4 py-3 whitespace-nowrap">
                {formatISTDateTime(row.createdAt)}
              </td>
              <td className="py-3 pl-4 pr-5 whitespace-nowrap">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onView(row)}
                    title="View inquiry details"
                    className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
                  >
                    <Eye size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={() => onEdit(row)}
                    title="Edit inquiry status"
                    className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-indigo-600 transition hover:bg-indigo-50 hover:text-indigo-700"
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(row)}
                    title="Delete inquiry"
                    className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-red-600 transition hover:bg-red-50 hover:text-red-700"
                  >
                    <Trash size={15} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
