"use client";

import { Calendar, Clock } from "@/components/icons";
import { formatDuration, formatTimeLabel, formatWallDate } from "@/lib/formatters";

type LiveBookingSummaryProps = {
  selectedDate: Date | null;
  startTime: string | null;
  endTime: string | null;
  durationHours: number | null;
};

function formatBookingDate(date: Date) {
  return formatWallDate(date, { day: "2-digit", month: "short", year: "numeric" });
}

export default function LiveBookingSummary({
  selectedDate,
  startTime,
  endTime,
  durationHours,
}: LiveBookingSummaryProps) {
  const hasTimeRange = Boolean(startTime && endTime && durationHours);

  return (
    <section className="bg-[#102f2d] p-4 text-white shadow-[0_18px_40px_rgba(16,47,45,0.18)]">
      <div className="mb-3 flex items-center justify-between gap-4">
        <div>
          <p className="text-[0.65rem] font-bold uppercase tracking-[0.24em] text-white/50">
            Your Event Plan
          </p>
        </div>
        {hasTimeRange ? (
          <span className="shrink-0 bg-white/10 px-2.5 py-1 text-xs font-semibold text-white ring-1 ring-white/15">
            Ready
          </span>
        ) : (
          <span className="shrink-0 bg-white/10 px-2.5 py-1 text-xs font-semibold text-white/70 ring-1 ring-white/15">
            In Progress
          </span>
        )}
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <SummaryPill
          icon={Calendar}
          label="Date"
          value={selectedDate ? formatBookingDate(selectedDate) : "Select date"}
        />
        <SummaryPill
          icon={Clock}
          label="Time"
          value={
            startTime && endTime && durationHours
              ? `${formatTimeLabel(startTime)} → ${formatTimeLabel(endTime)} · ${formatDuration(
                  durationHours * 60
                )}`
              : "Select start and end"
          }
        />
      </div>
    </section>
  );
}

function SummaryPill({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Calendar;
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0 bg-white/8 p-3 ring-1 ring-white/10">
      <div className="mb-1 flex items-center gap-1.5 text-[0.64rem] font-bold uppercase tracking-[0.18em] text-white/45">
        <Icon size={12} />
        {label}
      </div>
      <p className="truncate text-sm font-semibold text-white">{value}</p>
    </div>
  );
}
