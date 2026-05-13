"use client";

import { motion } from "framer-motion";

export default function CurtainReveal() {
  return (
    <>
      {/* Left Curtain */}
      <motion.div
        initial={{ x: 0 }}
        animate={{ x: "-100%" }}
        transition={{ duration: 2, ease: [0.16, 1, 0.3, 1] }}
        className="fixed top-0 left-0 w-1/2 h-full bg-gradient-to-r from-[#050505] to-[#141414] z-50 pointer-events-none"
        style={{
          boxShadow: "inset -40px 0 60px rgba(0,0,0,0.5)",
        }}
      >
        {/* Curtain Folds */}
        <div className="absolute inset-0 opacity-30">
          {[...Array(8)].map((_, i) => (
            <div
              key={i}
              className="absolute top-0 bottom-0 w-px bg-black/40"
              style={{ left: `${(i + 1) * 12}%` }}
            />
          ))}
        </div>

        {/* Gold Trim */}
        <div className="absolute right-0 top-0 bottom-0 w-2 bg-[#FCD308]" />
      </motion.div>

      {/* Right Curtain */}
      <motion.div
        initial={{ x: 0 }}
        animate={{ x: "100%" }}
        transition={{ duration: 2, ease: [0.16, 1, 0.3, 1] }}
        className="fixed top-0 right-0 w-1/2 h-full bg-gradient-to-l from-[#050505] to-[#141414] z-50 pointer-events-none"
        style={{
          boxShadow: "inset 40px 0 60px rgba(0,0,0,0.5)",
        }}
      >
        {/* Curtain Folds */}
        <div className="absolute inset-0 opacity-30">
          {[...Array(8)].map((_, i) => (
            <div
              key={i}
              className="absolute top-0 bottom-0 w-px bg-black/40"
              style={{ right: `${(i + 1) * 12}%` }}
            />
          ))}
        </div>

        {/* Gold Trim */}
        <div className="absolute left-0 top-0 bottom-0 w-2 bg-[#FCD308]" />
      </motion.div>
    </>
  );
}
