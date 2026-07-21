"use client";

import { ReactNode } from "react";
import Link from "next/link";
import { TrendingUp, TrendingDown } from "@/components/icons";

type KpiCardProps = {
  title: string;
  value: string;
  delta: string;
  trend: "up" | "down" | "neutral";
  trendSentiment?: "positive" | "negative";
  icon: ReactNode;
  href?: string;
};

export default function KpiCard({
  title,
  value,
  delta,
  trend,
  trendSentiment = "positive",
  icon,
  href,
}: KpiCardProps) {
  const hasDelta = delta.trim().length > 0;
  const trendColorClass =
    trend === "neutral"
      ? "text-slate-500"
      : (trend === "up" && trendSentiment === "positive") ||
          (trend === "down" && trendSentiment === "negative")
        ? "text-emerald-600"
        : "text-red-600";

  const card = (
    <div className="min-h-[112px] rounded-2xl border border-gray-100 bg-white p-3 shadow-sm transition-shadow hover:shadow-md sm:min-h-[120px] sm:p-4 lg:p-5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-medium leading-snug text-gray-500 sm:text-sm sm:font-normal">
            {title}
          </p>
          <p className="mt-1 text-2xl font-semibold leading-tight text-gray-900">
            {value}
          </p>
        </div>

        <div
          className="flex h-8 w-8 min-w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600 [&_svg]:h-4 [&_svg]:w-4 sm:h-10 sm:w-10 sm:min-w-10 sm:rounded-xl sm:[&_svg]:h-5 sm:[&_svg]:w-5"
        >
          {icon}
        </div>
      </div>

      {hasDelta ? (
        <div className="mt-3 flex items-start gap-1 text-xs sm:items-center sm:gap-1.5 sm:text-sm">
          {trend === "up" && (
            <TrendingUp className={`h-3.5 w-3.5 shrink-0 ${trendColorClass} sm:h-4 sm:w-4`} />
          )}
          {trend === "down" && (
            <TrendingDown className={`h-3.5 w-3.5 shrink-0 ${trendColorClass} sm:h-4 sm:w-4`} />
          )}
          <span className={`min-w-0 leading-snug ${trendColorClass}`}>
            {delta}
          </span>
        </div>
      ) : null}
    </div>
  );

  if (!href) return card;

  return (
    <Link href={href} className="block rounded-2xl focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2">
      {card}
    </Link>
  );
}
