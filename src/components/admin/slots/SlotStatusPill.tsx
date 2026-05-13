import { SlotStatus } from "@prisma/client";


export default function SlotStatusPill({
  status,
}: {
  status: SlotStatus;
}) {
  const base =
    "min-w-22 px-3 py-1 text-center rounded-full text-xs font-medium whitespace-nowrap";

  const cls =
    status === "AVAILABLE"
      ? "bg-emerald-50 text-emerald-800 border border-emerald-300"
      : status === "BOOKED"
      ? "bg-blue-50 text-blue-700 border border-blue-300"
      : status === "LOCKED"
      ? "bg-amber-50 text-amber-900 border border-amber-300"
      : "bg-blue-100 text-blue-800 border border-blue-300";

  return <span className={`${base} ${cls}`}>{status}</span>;
}