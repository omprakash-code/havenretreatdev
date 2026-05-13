import type { AdminSlot } from "@/types/admin/slot-admin";
import { timeToMinutes } from "@/lib/time";

/**
 * Slot is past ONLY if current IST time is after slot end (IST)
 */
export function isPastSlot(slot: AdminSlot): boolean {
  // Current time in IST
  const nowIST = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
  );

  // Normalize slot date to IST YYYY-MM-DD
  const [year, month, day] = new Date(slot.date)
    .toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" })
    .split("-");

  const baseEnd = new Date(
    `${year}-${month}-${day}T${slot.endTime}:00+05:30`
  );

  const isOvernight =
    timeToMinutes(slot.endTime) <= timeToMinutes(slot.startTime);

  const effectiveEnd = isOvernight
    ? new Date(baseEnd.getTime() + 24 * 60 * 60 * 1000)
    : baseEnd;

  const isPast = nowIST > effectiveEnd;

  return isPast;
}