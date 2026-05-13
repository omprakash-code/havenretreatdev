"use client";

import { useRef, useMemo, useState } from "react";
import AdminDrawer from "@/components/admin/drawer/AdminDrawer";
import { Calendar } from "@/components/icons";
import { formatISTDate, formatISTDateTime } from "@/lib/formatters";
import type {
  AdminWaitlistEntry,
  AdminWaitlistUpdatePayload,
  WaitlistStatus,
} from "@/types/admin/waitlist";

type WaitlistDetailsDrawerProps = {
  open: boolean;
  entry: AdminWaitlistEntry | null;
  mode: "view" | "edit";
  saving: boolean;
  onSave: (payload: AdminWaitlistUpdatePayload) => void;
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

export default function WaitlistDetailsDrawer({
  open,
  entry,
  mode,
  saving,
  onSave,
  onClose,
}: WaitlistDetailsDrawerProps) {
  const initialForm = useMemo<AdminWaitlistUpdatePayload>(
    () => ({
      name: entry?.name ?? "",
      phone: entry?.phone ?? "",
      email: entry?.email ?? "",
      city: entry?.city ?? "",
      locationPreference: entry?.locationPreference ?? "",
      theatrePreference: entry?.theatrePreference ?? "",
      preferredDate: entry?.preferredDate
        ? new Date(entry.preferredDate).toISOString().slice(0, 10)
        : "",
      preferredTime: entry?.preferredTime ?? "",
      peopleCount:
        typeof entry?.peopleCount === "number" && entry.peopleCount > 0
          ? String(entry.peopleCount)
          : "",
      occasion: entry?.occasion ?? "",
      notes: entry?.notes ?? "",
      status: entry?.status ?? "NEW",
    }),
    [entry]
  );
  const [form, setForm] = useState<AdminWaitlistUpdatePayload>(() => initialForm);

  function updateField<K extends keyof AdminWaitlistUpdatePayload>(
    key: K,
    value: AdminWaitlistUpdatePayload[K]
  ) {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  }

  function handleSave() {
    onSave(form);
  }

  if (!entry) return null;

  return (
    <AdminDrawer
      open={open}
      onClose={onClose}
      title={`Waitlist • ${entry.reference}`}
      description="Submission details from public waiting list form."
      width={640}
    >
      <div className="space-y-3">
        {mode === "view" ? (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Name" value={entry.name} />
              <Field label="Phone" value={entry.phone} />
              <Field label="Email" value={entry.email} />
              <Field label="Status" value={entry.status} />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="City" value={entry.city} />
              <Field label="Preferred Location" value={entry.locationPreference} />
              <Field
                label="Preferred Date"
                value={entry.preferredDate ? formatISTDate(entry.preferredDate) : null}
              />
              <Field label="Preferred Time" value={entry.preferredTime} />
              <Field
                label="People Count"
                value={entry.peopleCount ? String(entry.peopleCount) : null}
              />
              <Field label="Occasion" value={entry.occasion} />
            </div>

            <Field label="Notes" value={entry.notes} />

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Submitted At" value={formatISTDateTime(entry.createdAt)} />
              <Field
                label="Last Updated At"
                value={formatISTDateTime(entry.updatedAt)}
              />
              <Field
                label="Contacted At"
                value={entry.contactedAt ? formatISTDateTime(entry.contactedAt) : null}
              />
              <Field
                label="Closed At"
                value={entry.closedAt ? formatISTDateTime(entry.closedAt) : null}
              />
            </div>
          </>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="text-sm text-slate-700">
                Name
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => updateField("name", e.target.value)}
                  className="mt-1 h-10 w-full rounded-md border border-neutral-200 px-3 text-sm"
                />
              </label>
              <label className="text-sm text-slate-700">
                Phone
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => updateField("phone", e.target.value)}
                  className="mt-1 h-10 w-full rounded-md border border-neutral-200 px-3 text-sm"
                />
              </label>
              <label className="text-sm text-slate-700">
                Email
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => updateField("email", e.target.value)}
                  className="mt-1 h-10 w-full rounded-md border border-neutral-200 px-3 text-sm"
                />
              </label>
              <label className="text-sm text-slate-700">
                Status
                <select
                  value={form.status}
                  onChange={(e) =>
                    updateField("status", e.target.value as WaitlistStatus)
                  }
                  className="mt-1 h-10 w-full rounded-md border border-neutral-200 px-3 text-sm"
                >
                  <option value="NEW">NEW</option>
                  <option value="CONTACTED">CONTACTED</option>
                  <option value="CLOSED">CLOSED</option>
                </select>
              </label>
              <label className="text-sm text-slate-700">
                City
                <input
                  type="text"
                  value={form.city}
                  onChange={(e) => updateField("city", e.target.value)}
                  className="mt-1 h-10 w-full rounded-md border border-neutral-200 px-3 text-sm"
                />
              </label>
              <label className="text-sm text-slate-700">
                Preferred Location
                <input
                  type="text"
                  value={form.locationPreference}
                  onChange={(e) =>
                    updateField("locationPreference", e.target.value)
                  }
                  className="mt-1 h-10 w-full rounded-md border border-neutral-200 px-3 text-sm"
                />
              </label>
              <label className="text-sm text-slate-700">
                Preferred Date
                <FormattedDateField
                  label="Preferred Date"
                  value={form.preferredDate}
                  onChange={(value) => updateField("preferredDate", value)}
                />
              </label>
              <label className="text-sm text-slate-700">
                Preferred Time
                <input
                  type="time"
                  value={form.preferredTime}
                  onChange={(e) => updateField("preferredTime", e.target.value)}
                  className="mt-1 h-10 w-full rounded-md border border-neutral-200 px-3 text-sm"
                />
              </label>
              <label className="text-sm text-slate-700">
                People Count
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={form.peopleCount}
                  onChange={(e) =>
                    updateField("peopleCount", e.target.value.replace(/\D+/g, ""))
                  }
                  className="mt-1 h-10 w-full rounded-md border border-neutral-200 px-3 text-sm"
                />
              </label>
              <label className="text-sm text-slate-700">
                Occasion
                <input
                  type="text"
                  value={form.occasion}
                  onChange={(e) => updateField("occasion", e.target.value)}
                  className="mt-1 h-10 w-full rounded-md border border-neutral-200 px-3 text-sm"
                />
              </label>
            </div>

            <label className="block text-sm text-slate-700">
              Notes
              <textarea
                rows={4}
                value={form.notes}
                onChange={(e) => updateField("notes", e.target.value)}
                className="mt-1 w-full rounded-md border border-neutral-200 px-3 py-2 text-sm"
              />
            </label>
          </>
        )}

        {mode === "edit" ? (
          <div className="flex flex-wrap justify-end gap-2 border-t border-neutral-200 pt-3">
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
              onClick={handleSave}
              disabled={saving}
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        ) : null}
      </div>
    </AdminDrawer>
  );
}

function FormattedDateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const formattedValue = getFormattedDate(value);

  const openPicker = () => {
    const input = inputRef.current;
    if (!input) return;
    if (typeof input.showPicker === "function") {
      try {
        input.showPicker();
        return;
      } catch {
        // fallback to focus
      }
    }
    input.focus();
  };

  return (
    <div
      className="relative mt-1"
      onClick={openPicker}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openPicker();
        }
      }}
      role="button"
      tabIndex={0}
      aria-label={label}
    >
      <input
        ref={inputRef}
        type="date"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
      />
      <div className="flex h-10 items-center justify-between rounded-md border border-neutral-200 bg-white px-3 text-sm text-slate-800">
        <span className={value ? "text-slate-900" : "text-slate-400"}>
          {formattedValue}
        </span>
        <Calendar size={14} className="shrink-0 text-slate-500" />
      </div>
    </div>
  );
}

function getFormattedDate(value: string) {
  if (!value) return "Select preferred date";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Invalid date";
  return formatISTDate(parsed);
}
