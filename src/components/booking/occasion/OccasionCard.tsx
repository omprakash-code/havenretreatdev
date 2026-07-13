"use client";

import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Sparkles, X } from "lucide-react";
import type { ReactNode } from "react";

type Props = {
  label: string;
  icon: string;
  subtext?: string;
  selected: boolean;
  dimmed?: boolean;
  expanded?: boolean;
  submitted?: boolean;
  personalizedMessage?: string;
  overlayMobileAlign?: "left" | "right";
  overlayDesktopAlign?: "center" | "left";
  onSelect: () => void;
  onEdit?: () => void;
  onClose?: () => void;
  children?: ReactNode;
};

export default function OccasionCard({
  label,
  icon,
  subtext,
  selected,
  expanded = false,
  submitted = false,
  personalizedMessage,
  overlayMobileAlign = "left",
  overlayDesktopAlign = "center",
  onSelect,
  onEdit,
  onClose,
  children,
}: Props) {
  const showPersonalizedState = selected && submitted && !expanded;
  const shouldShowForm = selected && expanded;

  return (
    <div
      className={`relative w-full overflow-visible transition-all duration-300 ease-out ${
        selected
          ? "bg-[#347f7c]/[0.08] ring-1 ring-gray-300"
          : "bg-gray-50 ring-1 ring-gray-900/[0.04] hover:shadow-[0_2px_16px_rgba(0,0,0,0.06)]"
      }`}
    >
      <motion.div
        role="button"
        tabIndex={0}
        onClick={onSelect}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onSelect();
          }
        }}
        whileTap={{ scale: 0.985 }}
        className="relative flex min-h-[150px] md:min-h-[160px] w-full cursor-pointer flex-col items-center gap-2.5 p-3 text-center"
      >
        <div
          className={`absolute right-3 top-3 flex h-5 w-5 items-center justify-center transition
          ${
            selected
              ? "bg-[#347f7c] text-white"
              : "bg-white ring-1 ring-gray-300"
          }
        `}
        >
          {selected && <Check size={12} strokeWidth={3} />}
        </div>

        <div className="relative flex h-11 w-11 items-center justify-center">
          <Image
            src={icon || "/icons/placeholder.png"}
            alt={label}
            fill
            sizes="44px"
            className="object-contain p-2"
          />
        </div>

        {showPersonalizedState ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="flex w-full flex-1 flex-col items-center"
          >
            <p className="w-full text-sm font-semibold leading-snug text-black">
              <span className="whitespace-normal break-words text-center">
                {personalizedMessage || `${label} Celebration`}
              </span>
            </p>
            <p className="mt-1 line-clamp-2 text-xs leading-snug text-gray-600">
              {subtext || "Your occasion details are saved."}
            </p>
            {onEdit && (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onEdit();
                }}
                className="mt-auto self-end bg-[#347f7c]/10 px-2.5 py-1 text-xs font-semibold text-[#245e5b] transition hover:bg-[#347f7c]/15 cursor-pointer"
              >
                Edit
              </button>
            )}
          </motion.div>
        ) : (
          <div className="flex w-full flex-1 flex-col items-center">
            <p className="text-sm font-semibold tracking-tight text-gray-900">
              {label}
            </p>

            {subtext && (
              <p className="mt-1 text-xs leading-snug text-gray-600">
                {subtext}
              </p>
            )}

            {!selected && <span className="mt-auto text-[11px] font-medium text-gray-500">Select</span>}
          </div>
        )}
      </motion.div>

      <AnimatePresence>
        {shouldShowForm && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className={`absolute top-[calc(100%+0.5rem)] z-30 w-[300px] max-w-[calc(100vw-1rem)] overflow-hidden bg-white shadow-xl ring-1 ring-gray-900/[0.08] ${overlayMobileAlign === "right" ? "right-0" : "left-0"
              } sm:left-1/2 sm:right-auto sm:w-full sm:min-w-[300px] sm:-translate-x-1/2 ${overlayDesktopAlign === "left"
                ? "lg:left-0 lg:right-auto lg:translate-x-0"
                : "lg:left-1/2 lg:right-auto lg:-translate-x-1/2"
              }`}
          >
            <div className="relative border-b border-gray-100 px-4 pb-2 pt-3">
              <p className="inline-flex w-full items-center justify-center gap-1.5 text-base font-semibold text-[#1f2937] text-center">
                <Sparkles size={15} className="text-[#347f7c]" />
                {label} Details
              </p>
              {onClose && (
                <button
                  type="button"
                  onClick={onClose}
                  className="absolute right-3 top-2 inline-flex h-7 w-7 items-center justify-center text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 cursor-pointer"
                  title="Close details"
                  aria-label="Close details"
                >
                  <X size={14} />
                </button>
              )}
            </div>
            <div className="px-4 pb-4 pt-2.5 text-left">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
