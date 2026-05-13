"use client";

import { Toaster } from "sonner";

export default function ToastProvider() {
  return (
    <Toaster
      position="top-right"
      toastOptions={{
        classNames: {
          toast:
            "bg-white border border-neutral-200 text-neutral-900 shadow-md",
          description: "text-neutral-600 text-sm",
          actionButton: "bg-black text-white",
          cancelButton: "bg-neutral-100 text-neutral-900",
        },
      }}
    />
  );
}
