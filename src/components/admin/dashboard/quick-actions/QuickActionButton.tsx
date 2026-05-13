"use client";

import Link from "next/link";
import clsx from "clsx";

type Props = {
  icon: React.ReactNode;
  title: string;
  desc: string;
  href: string;
  variant?: "primary" | "warning" | "default";
};

export default function QuickActionButton({
  icon,
  title,
  desc,
  href,
  variant = "default",
}: Props) {
  return (
    <Link
      href={href}
      className={clsx(
        "group w-full sm:w-[calc(50%-0.375rem)] lg:w-auto rounded-lg border px-2.5 py-2.5 sm:px-3 sm:py-3 transition-all duration-200",
        "hover:shadow-sm hover:-translate-y-[1px]",
        variant === "primary" &&
          "border-indigo-200 bg-indigo-50 hover:bg-indigo-100",
        variant === "warning" &&
          "border-amber-200 bg-amber-50 hover:bg-amber-100",
        variant === "default" &&
          "border-gray-200 bg-white hover:bg-gray-50"
      )}
    >
      <div className="flex items-center gap-3">
        <div
          className={clsx(
            "flex h-8 w-8 items-center justify-center rounded-md shrink-0",
            variant === "primary" && "bg-indigo-600 text-white",
            variant === "warning" && "bg-amber-500 text-white",
            variant === "default" && "bg-gray-900 text-white"
          )}
        >
          {icon}
        </div>

        <div className="flex-1 leading-tight">
          <p className="text-sm font-semibold text-gray-900">
            {title}
          </p>
          <p className="text-xs text-gray-500">
            {desc}
          </p>
        </div>
      </div>
    </Link>
  );
}
