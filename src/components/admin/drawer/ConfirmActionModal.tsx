"use client";

import type { ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";

type ConfirmActionModalProps = {
  open: boolean;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  loadingLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
  confirmDisabled?: boolean;
  onClose: () => void;
  onConfirm: () => void;
  error?: ReactNode;
  children?: ReactNode;
};

export default function ConfirmActionModal({
  open,
  title,
  description,
  confirmLabel,
  loadingLabel = "Processing...",
  cancelLabel = "Cancel",
  loading = false,
  confirmDisabled = false,
  onClose,
  onConfirm,
  error,
  children,
}: ConfirmActionModalProps) {
  const isConfirmDisabled = loading || confirmDisabled;

  return (
    <AnimatePresence mode="wait">
      {open ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 p-4 backdrop-blur-[1px]"
          onClick={loading ? undefined : onClose}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-action-title"
            initial={{ opacity: 0, scale: 0.985 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.985 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            className="w-full max-w-md rounded-xl border border-neutral-200 bg-white p-5 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h3
              id="confirm-action-title"
              className="text-base font-semibold text-slate-900"
            >
              {title}
            </h3>

            <p className="mt-2 text-sm text-slate-600">{description}</p>

            {children ? <div className="mt-3">{children}</div> : null}

            {error ? (
              <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            ) : null}

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                disabled={loading}
                onClick={onClose}
                className="rounded-md border border-neutral-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {cancelLabel}
              </button>
              <button
                type="button"
                disabled={isConfirmDisabled}
                onClick={onConfirm}
                className="rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? loadingLabel : confirmLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
