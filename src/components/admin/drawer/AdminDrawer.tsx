"use client";

//src/components/admin/drawer/AdminDrawer.tsx
// This is a generic admin drawer component used across the admin panel for various CRUD operations. It provides a consistent UI/UX for displaying forms, details, and edit screens in a slide-over panel.
import { X } from "@/components/icons";
import { ReactNode } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";

type AdminDrawerProps = {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  width?: number;
};

export default function AdminDrawer({
  open,
  title,
  description,
  onClose,
  children,
  width,
}: AdminDrawerProps) {
  const reduceMotion = useReducedMotion();

  return (
    <AnimatePresence mode="wait">
      {open && (
        <div className="fixed inset-0 z-50">
          {/* Overlay with fade animation */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduceMotion ? 0.12 : 0.2, ease: "easeOut" }}
            className="absolute inset-0 bg-slate-900/30"
            onClick={onClose}
          />

          {/* Drawer with slide animation */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{
              duration: reduceMotion ? 0.14 : 0.22,
              ease: [0.32, 0.72, 0, 1]
            }}
            className={`absolute right-0 top-0 h-full bg-white shadow-2xl flex flex-col ${
              width ? "" : "w-full max-w-xl"
            }`}
            style={
              width
                ? {
                    width: `min(100vw, ${width}px)`,
                    willChange: "transform",
                    transform: "translateZ(0)",
                    backfaceVisibility: "hidden",
                  }
                : { willChange: "transform", transform: "translateZ(0)", backfaceVisibility: "hidden" }
            }
          >
            {/* Header */}
            <div className="border-b border-slate-200 bg-slate-50/50 px-4 pt-[calc(env(safe-area-inset-top)+0.75rem)] pb-3 sm:px-5 sm:pt-[calc(env(safe-area-inset-top)+1rem)] sm:pb-4 lg:px-8 lg:pt-[calc(env(safe-area-inset-top)+1.5rem)] lg:pb-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <h2 className="text-lg sm:text-xl font-semibold text-slate-900 tracking-tight">
                    {title}
                  </h2>
                  {description && (
                    <p className="text-xs sm:text-[13px] text-slate-500 mt-1 sm:mt-1.5 leading-relaxed">
                      {description}
                    </p>
                  )}
                </div>

                <button
                  onClick={onClose}
                  className="flex-shrink-0 cursor-pointer rounded-full p-2 text-slate-400 transition-all duration-200 hover:bg-white hover:text-slate-700 hover:shadow-lg active:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-200"
                  aria-label="Close drawer"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Content with custom scrollbar */}
            <div
              className="custom-scrollbar flex-1 overflow-y-auto overscroll-y-contain px-4 py-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] sm:px-5 sm:py-4 sm:pb-[calc(env(safe-area-inset-bottom)+1rem)] lg:px-8 lg:py-6 lg:pb-[calc(env(safe-area-inset-bottom)+1.25rem)]"
              style={{ WebkitOverflowScrolling: "touch" }}
            >
              {children}
            </div>
          </motion.div>

          {/* Custom Scrollbar Styles */}
          <style jsx global>{`
            .custom-scrollbar::-webkit-scrollbar {
              width: 8px;
            }
            
            .custom-scrollbar::-webkit-scrollbar-track {
              background: transparent;
            }
            
            .custom-scrollbar::-webkit-scrollbar-thumb {
              background: #cbd5e1;
              border-radius: 4px;
            }
            
            .custom-scrollbar::-webkit-scrollbar-thumb:hover {
              background: #94a3b8;
            }
          `}</style>
        </div>
      )}
    </AnimatePresence>
  );
}
