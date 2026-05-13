"use client";

import { motion } from "framer-motion";
import { Occasion } from "./types";

const occasions: Occasion[] = [
  "All Moments",
  "Birthday Party",
  "Romantic Date",
  "Movie Night",
  "Marriage Proposal",
  "Anniversary",
  "Baby Shower",
  "Congratulations",
  "Farewell",
];

export default function OccasionFilter({
  active,
  onChange,
}: {
  active: Occasion;
  onChange: (o: Occasion) => void;
}) {
  return (
    <div className="mb-10 sm:mb-12">
      <div className="overflow-x-auto pb-2">
        <div className="mx-auto flex w-max items-center gap-2 rounded-2xl border border-black/10 bg-white/70 p-2 backdrop-blur-sm">
          {occasions.map((o) => {
            const isActive = active === o;

            return (
              <button
                key={o}
                onClick={() => onChange(o)}
                className={`relative whitespace-nowrap rounded-xl px-4 py-2 text-sm font-medium cursor-pointer transition-colors ${
                  isActive
                    ? "text-black"
                    : "text-gray-500 hover:text-gray-800"
                }`}
              >
                {isActive && (
                  <motion.span
                    layoutId="occasion-active-pill"
                    className="absolute inset-0 rounded-xl bg-white shadow-[0_8px_30px_rgba(0,0,0,0.12)]"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
                <span className="relative z-10">{o}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
