"use client";

import AdminDrawer from "@/components/admin/drawer/AdminDrawer";
import { formatISTDateTime } from "@/lib/formatters";
import type { AdminContactInquiry, ContactInquiryStatus } from "@/types/admin/contact";

type ContactDetailsDrawerProps = {
  open: boolean;
  inquiry: AdminContactInquiry | null;
  onClose: () => void;
};

function Field({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-3">
      <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">{label}</p>
      <p className="mt-1 text-sm text-slate-900 break-words">{value || "—"}</p>
    </div>
  );
}

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

export default function ContactDetailsDrawer({
  open,
  inquiry,
  onClose,
}: ContactDetailsDrawerProps) {
  if (!inquiry) return null;

  return (
    <AdminDrawer
      open={open}
      onClose={onClose}
      title="Contact Inquiry Details"
      description="Submission details from public contact form."
      width={640}
    >
      <div className="space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Name" value={inquiry.name} />
          <Field label="Mobile" value={inquiry.mobile} />
        </div>

        <div className="rounded-lg border border-neutral-200 bg-white p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">Message</p>
          <p className="mt-1 whitespace-pre-wrap text-sm text-slate-900">{inquiry.message}</p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-neutral-200 bg-white p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">Status</p>
            <div className="mt-1">
              <StatusBadge status={inquiry.status} />
            </div>
          </div>
          <Field label="Created At" value={formatISTDateTime(inquiry.createdAt)} />
          <Field label="Updated At" value={formatISTDateTime(inquiry.updatedAt)} />
          <Field
            label="Responded At"
            value={inquiry.respondedAt ? formatISTDateTime(inquiry.respondedAt) : null}
          />
          <Field label="Read Status" value={inquiry.isRead ? "Read" : "Unread"} />
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-neutral-200 pt-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-neutral-200 px-3 py-2 text-sm text-slate-700"
          >
            Close
          </button>
        </div>
      </div>
    </AdminDrawer>
  );
}
