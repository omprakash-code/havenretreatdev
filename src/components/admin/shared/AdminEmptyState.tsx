"use client";

import type { ReactNode } from "react";

type AdminEmptyStateProps = {
  title: string;
  description: string;
  icon?: ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
};

export default function AdminEmptyState({
  title,
  description,
  icon,
  actionLabel,
  onAction,
  className = "",
}: AdminEmptyStateProps) {
  return (
    <div
      className={`mt-4 rounded-xl border border-dashed border-neutral-300 bg-white px-5 py-12 text-center sm:px-6 ${className}`.trim()}
    >
      {icon ? (
        <div className="mx-auto mb-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-neutral-100 text-neutral-600">
          {icon}
        </div>
      ) : null}

      <h3 className="text-base font-semibold text-neutral-900">{title}</h3>
      <p className="mt-1 text-sm text-neutral-500">{description}</p>

      {actionLabel && onAction ? (
        <button
          type="button"
          onClick={onAction}
          className="mt-4 inline-flex cursor-pointer items-center rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50"
        >
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}
