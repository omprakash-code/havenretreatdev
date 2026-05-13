"use client";

import { useState } from "react";
import AdminDrawer from "@/components/admin/drawer/AdminDrawer";
import { formatISTDateTime } from "@/lib/formatters";
import type {
  AdminContactInquiry,
  AdminContactInquiryEditPayload,
  ContactInquiryStatus,
} from "@/types/admin/contact";

type ContactEditDrawerProps = {
  open: boolean;
  inquiry: AdminContactInquiry | null;
  saving: boolean;
  onClose: () => void;
  onSave: (payload: AdminContactInquiryEditPayload) => void;
};

export default function ContactEditDrawer({
  open,
  inquiry,
  saving,
  onClose,
  onSave,
}: ContactEditDrawerProps) {
  const [form, setForm] = useState<AdminContactInquiryEditPayload>(() => ({
    name: inquiry?.name ?? "",
    mobile: inquiry?.mobile ?? "",
    message: inquiry?.message ?? "",
    status: inquiry?.status ?? "NEW",
  }));

  if (!inquiry) return null;
  const hasChanges =
    form.name.trim() !== inquiry.name ||
    form.mobile !== inquiry.mobile ||
    form.message.trim() !== inquiry.message ||
    form.status !== inquiry.status;

  function normalizeIndianMobile(input: string) {
    const digits = input.replace(/\D/g, "");
    if (digits.length === 0) return "";
    if (digits.length <= 10) return digits;
    if (digits.length === 11 && digits.startsWith("0")) {
      return digits.slice(1);
    }
    return digits.slice(-10);
  }

  return (
    <AdminDrawer
      open={open}
      onClose={onClose}
      title="Edit Contact Inquiry"
      description="Update inquiry status for this submission."
      width={640}
    >
      <div className="space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="text-sm text-slate-700">
            Name
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              className="mt-1 h-10 w-full rounded-md border border-neutral-200 px-3 text-sm"
            />
          </label>
          <label className="text-sm text-slate-700">
            Mobile Number
            <input
              type="tel"
              inputMode="numeric"
              value={form.mobile}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  mobile: normalizeIndianMobile(e.target.value),
                }))
              }
              className="mt-1 h-10 w-full rounded-md border border-neutral-200 px-3 text-sm"
            />
            <p className="mt-1 text-right text-xs text-gray-400">
              {form.mobile.length}/10 digits
            </p>
          </label>
          <label className="text-sm text-slate-700">
            Status
            <select
              value={form.status}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  status: e.target.value as ContactInquiryStatus,
                }))
              }
              className="mt-1 h-10 w-full rounded-md border border-neutral-200 px-3 text-sm text-slate-800"
            >
              <option value="NEW">NEW</option>
              <option value="CONTACTED">CONTACTED</option>
              <option value="CLOSED">CLOSED</option>
            </select>
          </label>
          <label className="text-sm text-slate-700">
            Created At
            <div className="mt-1 flex h-10 w-full items-center rounded-md border border-neutral-200 bg-neutral-50 px-3 text-sm text-slate-500">
              {formatISTDateTime(inquiry.createdAt)}
            </div>
          </label>
        </div>

        <label className="block text-sm text-slate-700">
          Message
          <textarea
            rows={5}
            value={form.message}
            onChange={(e) => setForm((prev) => ({ ...prev, message: e.target.value }))}
            className="mt-1 w-full rounded-md border border-neutral-200 px-3 py-2 text-sm"
          />
        </label>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-neutral-200 pt-3">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-md border border-neutral-200 px-3 py-2 text-sm text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() =>
              onSave({
                name: form.name.trim(),
                mobile: form.mobile,
                message: form.message.trim(),
                status: form.status,
              })
            }
            disabled={saving || !hasChanges}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </AdminDrawer>
  );
}
