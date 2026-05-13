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
  dimmed = false,
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
      className={`relative w-full overflow-visible border transition-all duration-300 ease-out ${
        selected
          ? "border-[#347f7c] bg-[#f8fbfa] shadow-sm"
          : "border-[#2f7e7a]/25 bg-white hover:border-[#347f7c]/50 hover:bg-[#fcfdfd]"
      } ${dimmed ? "opacity-60 hover:opacity-100" : "opacity-100"}`}
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
          className={`absolute right-3 top-3 flex h-5 w-5 items-center justify-center border transition
          ${
            selected
              ? "border-[#347f7c] bg-[#347f7c] text-white"
              : "border-[#d7e4e1] bg-white"
          }
        `}
        >
          {selected && <Check size={12} strokeWidth={3} />}
        </div>

        <div
          className={`relative flex h-11 w-11 items-center justify-center border transition ${
            selected ? "border-[#2f7e7a]/25 bg-[#edf3f1]" : "border-[#d7e4e1] bg-[#f8fbfa]"
            }`}
        >
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
                className="mt-auto self-end border border-[#2f7e7a]/30 bg-[#edf3f1] px-2.5 py-1 text-xs font-semibold text-[#245e5b] transition hover:bg-[#e3efec] cursor-pointer"
              >
                Edit
              </button>
            )}
          </motion.div>
        ) : (
          <div className="flex w-full flex-1 flex-col items-center">
            <p
              className={`text-sm font-semibold tracking-tight ${
                selected ? "text-[#1f2937]" : "text-gray-800"
                }`}
            >
              {label}
            </p>

            {subtext && (
              <p
                className={`mt-1 text-xs leading-snug ${
                  selected ? "text-gray-700" : "text-gray-500"
                  }`}
              >
                {subtext}
              </p>
            )}

            {!selected && <span className="mt-auto text-[11px] text-gray-400">Select</span>}
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
            className={`absolute top-[calc(100%+0.5rem)] z-30 w-[300px] max-w-[calc(100vw-1rem)] overflow-hidden border border-[#2f7e7a]/30 bg-white shadow-lg ${overlayMobileAlign === "right" ? "right-0" : "left-0"
              } sm:left-1/2 sm:right-auto sm:w-full sm:min-w-[300px] sm:-translate-x-1/2 ${overlayDesktopAlign === "left"
                ? "lg:left-0 lg:right-auto lg:translate-x-0"
                : "lg:left-1/2 lg:right-auto lg:-translate-x-1/2"
              }`}
          >
            <div className="relative border-b border-[#d7e4e1] px-4 pb-2 pt-3">
              <p className="inline-flex w-full items-center justify-center gap-1.5 text-base font-semibold text-[#1f2937] text-center">
                <Sparkles size={15} className="text-[#347f7c]" />
                {label} Details
              </p>
              {onClose && (
                <button
                  type="button"
                  onClick={onClose}
                  className="absolute right-3 top-2 inline-flex h-7 w-7 items-center justify-center border border-[#d7e4e1] bg-white text-gray-600 transition hover:bg-[#f8fbfa] hover:text-[#245e5b] cursor-pointer"
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
