"use client";

import { motion } from "framer-motion";

type CelebrationBlockProps = {
  occasionLabel?: string;
  embedded?: boolean;
};

export default function CelebrationBlock({
  occasionLabel,
  embedded = false,
}: CelebrationBlockProps) {
  // Without an occasion there is nothing to celebrate here. The review status is
  // reported once, on the trail beside the booking reference.
  if (!occasionLabel) return null;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.35, type: "spring", stiffness: 160, damping: 18 }}
      className="relative"
    >
      {/* Animated Glow */}
      <motion.div
        animate={{
          opacity: [0.3, 0.6, 0.3],
          scale: [1, 1.1, 1],
        }}
        transition={{
          duration: 3,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        className="absolute inset-0 bg-[#347f7c]/18 blur-xl"
      />

      {/* Content */}
      <div
        className={
          embedded
            ? "relative rounded-xl p-3 sm:p-4 text-center"
            : "relative rounded-xl border border-zinc-200 bg-white p-3 sm:p-4 text-center shadow-sm"
        }
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.5, type: "spring", stiffness: 180, damping: 16 }}
        >
          <h3 className="text-lg sm:text-xl font-bold text-slate-900 mb-1 leading-snug">
            {occasionLabel} Celebration{" "}
            <span className="whitespace-nowrap">is Ready! 🎉</span>
          </h3>
          <p className="text-slate-600 text-xs sm:text-sm">
            Everything is set for your special day
          </p>
          <p className="mt-1 text-[11px] text-slate-400">
            Haven Retreat will confirm your booking shortly.
          </p>
        </motion.div>
      </div>
    </motion.div>
  );
}
