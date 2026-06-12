"use client";

import { motion } from "framer-motion";
import type { BookingSuccessData } from "@/components/booking/success/types";
import { buildCelebrationRows } from "@/components/booking/success/success-details";

type CelebrationDetailsCardProps = {
  data: Pick<BookingSuccessData, "occasionLabel" | "occasionDetails" | "items">;
  compact?: boolean;
};

export default function CelebrationDetailsCard({
  data,
  compact = false,
}: CelebrationDetailsCardProps) {
  const rows = buildCelebrationRows(data);

  if (rows.length === 0) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.28, duration: 0.32 }}
      className="border border-[#d7e4e1] bg-[#f8fbfa] p-2.5 sm:p-3.5"
    >
      <div className="mb-2.5 flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#5f7774]">
            Celebration Details
          </p>
        </div>
      </div>

      <div
        className={
          compact
            ? "grid gap-2"
            : "grid gap-2 sm:grid-cols-2 xl:grid-cols-4"
        }
      >
        {rows.map((row) => (
          <div
            key={`${row.label}-${row.value}`}
            className="border border-[#d7e4e1] bg-white px-3 py-2"
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#5f7774]">
              {row.label}
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-900">
              {row.value}
            </p>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
