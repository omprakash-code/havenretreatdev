"use client";

import { useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText,
  Check,
  X,
  Lock,
} from "@/components/icons";

type TermsModalProps = {
  open: boolean;
  onClose: () => void;
  checked: boolean;
  setChecked: (v: boolean) => void;
  onConfirm: () => void;
  advancePay?: number | null;
};

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function TermsModal({
  open,
  onClose,
  checked,
  setChecked,
  onConfirm,
  advancePay,
}: TermsModalProps) {
  const resolvedAdvancePay =
    typeof advancePay === "number" && Number.isFinite(advancePay)
      ? Math.max(advancePay, 0)
      : null;

  /* -----------------------------
     ESC KEY CLOSE
  ------------------------------ */
  useEffect(() => {
    if (!open) return;

    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* BACKDROP + HEADER BLUR */}
          <motion.div
            className="fixed inset-0 z-40 bg-black/45 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* MODAL WRAPPER */}
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center px-2 sm:px-4 py-2 sm:py-4"
            initial={{ opacity: 0, scale: 0.95, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 30 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
          >
            <div className="relative max-h-[calc(100dvh-1rem)] w-full max-w-3xl overflow-y-auto overscroll-contain border border-[#2f7e7a]/25 bg-white p-2 shadow-2xl sm:max-h-[calc(100dvh-2rem)] sm:p-6 md:p-8">

              {/* CLOSE */}
              <button
                onClick={onClose}
                className="absolute right-3 top-3 border border-[#d7e4e1] bg-white p-1 text-gray-400 transition hover:bg-[#f8fbfa] hover:text-[#245e5b] sm:right-4 sm:top-4"
              >
                <X size={20} />
              </button>

              {/* HEADER */}
              <div className="flex items-center gap-2.5 sm:gap-3 mb-4 sm:mb-6 pr-8">
                <span className="border border-[#2f7e7a]/25 bg-[#edf3f1] p-2 text-[#347f7c] shrink-0">
                  <FileText />
                </span>
                <h2 className="text-lg font-bold text-[#1f2937] sm:text-xl md:text-2xl">
                  TERMS & CONDITIONS
                </h2>
              </div>

              {/* CONTENT */}
              <div className="pr-1 sm:pr-2 text-xs sm:text-sm text-gray-700 space-y-5 sm:space-y-6">
                <ul className="list-disc pl-5 space-y-1.5 sm:space-y-2">
                  <li>Outside food beverages not allowed</li>
                  <li>Smoking/Drinking is NOT allowed inside the theater. If found, a fine of up to $2,000 will be charged.</li>
                  <li>Any damage caused to the theater, including decorative materials like balloons, lights, etc., must be reimbursed.</li>
                  <li>Guests are requested to maintain cleanliness inside the theater to avoid cleaning charges.</li>
                  <li>Party poppers, snow sprays, cold fire, and any other similar items are strictly prohibited inside the theater.</li>
                  <li>Pets are strictly not allowed inside the theater.</li>
                  <li>In case of an electricity cut lasting more than 15 minutes, your booking amount will be refunded.</li>
                  <li>Couples under 18 years of age are not allowed to book the theater.</li>
                  <li>Aadhaar card is mandatory. In case of couples, both individuals must present their ID, which will be scanned at reception.</li>
                </ul>

                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <FileText size={18} className="text-[#347f7c]" />
                    <h3 className="text-sm font-semibold text-[#1f2937] sm:text-base">
                      REFUND POLICY
                    </h3>
                  </div>

                  <ul className="list-disc pl-5 space-y-1.5 sm:space-y-2">
                    <li>The advance amount is fully refundable if the slot is canceled at least 72 hours before the slot time.</li>
                    <li>If your slot is less than 72 hours away from the time of payment, no refund or slot rescheduling will be possible under any circumstances.</li>
                  </ul>
                </div>
              </div>

              {/* AGREEMENT */}
              <div className="mt-2 flex items-center gap-2.5 border border-[#d7e4e1] bg-[#f8fbfa] p-2 sm:mt-6 sm:p-4 sm:gap-3">
                <button
                  onClick={() => setChecked(!checked)}
                  className={`mt-0.5 flex h-5 w-5 items-center justify-center border transition cursor-pointer
                    ${
                      checked
                        ? "border-[#347f7c] bg-[#347f7c] text-white"
                        : "border-gray-400 bg-white"
                    }
                  `}
                >
                  {checked && <Check size={14} />}
                </button>

                <p className="text-[10px] sm:text-sm text-gray-700 leading-relaxed">
                  I agree to the{" "}
                  <Link
                    href="/terms-and-conditions"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold underline"
                  >
                    Terms & Conditions
                  </Link>{" "}
                  of Haven Retreat.
                </p>
              </div>

              {/* CTA */}
              <motion.button
                whileHover={checked ? { scale: 1.04 } : {}}
                whileTap={checked ? { scale: 0.97 } : {}}
                disabled={!checked}
                onClick={checked ? onConfirm : undefined}
                className={`mt-4 flex w-full items-center justify-center gap-2 border py-3 text-base font-semibold transition sm:mt-6 sm:py-4 sm:text-lg
                  ${
                    checked
                      ? "border-[#347f7c] bg-[#347f7c] text-white hover:bg-[#245e5b] cursor-pointer"
                      : "border-gray-200 bg-gray-200 text-gray-400 cursor-not-allowed"
                  }
                `}
              >
                <Lock size={16} />
                {resolvedAdvancePay !== null
                  ? `Proceed to Pay ${formatCurrency(resolvedAdvancePay)}`
                  : "Proceed to Payment"}
              </motion.button>

              {/* MICRO TRUST TEXT */}
              <p className="mt-2.5 text-center text-[11px] text-gray-500 sm:mt-3 sm:text-xs">
                Secure payment · encrypted checkout
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
