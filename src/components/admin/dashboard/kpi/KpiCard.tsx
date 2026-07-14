"use client";

import { ReactNode } from "react";
import Link from "next/link";
import { TrendingUp, TrendingDown } from "@/components/icons";

type KpiCardProps = {
  title: string;
  value: string;
  delta: string;
  trend: "up" | "down" | "neutral";
  icon: ReactNode;
  href?: string;
};

export default function KpiCard({
  title,
  value,
  delta,
  trend,
  icon,
  href,
}: KpiCardProps) {
  const hasDelta = delta.trim().length > 0;
  const trendColorClass = "text-slate-500";

  const card = (
    <div className="min-h-[94px] rounded-2xl border border-gray-100 bg-white p-2 shadow-sm transition-shadow hover:shadow-md sm:min-h-[120px] sm:p-4 lg:p-5">
      <div className="flex items-start justify-between gap-1.5">
        <div className="min-w-0 flex-1 pr-1 sm:pr-2">
          <p className="whitespace-nowrap text-xs font-medium leading-none tracking-tight text-gray-500 sm:text-sm sm:font-normal sm:leading-normal sm:tracking-normal">
            {title}
          </p>
          <p className="mt-1 text-xl font-semibold leading-tight text-gray-900 sm:mt-1 sm:text-2xl">
            {value}
          </p>
        </div>

        <div
          className="flex h-7 w-7 min-w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600 [&_svg]:h-3.5 [&_svg]:w-3.5 sm:h-10 sm:w-10 sm:min-w-10 sm:rounded-xl sm:[&_svg]:h-5 sm:[&_svg]:w-5"
        >
          {icon}
        </div>
      </div>

      {hasDelta ? (
        <div className="mt-2.5 flex items-center gap-1 text-xs sm:mt-3 sm:gap-1.5 sm:text-sm">
          {trend === "up" && (
            <TrendingUp className={`h-3.5 w-3.5 shrink-0 ${trendColorClass} sm:h-4 sm:w-4`} />
          )}
          {trend === "down" && (
            <TrendingDown className={`h-3.5 w-3.5 shrink-0 ${trendColorClass} sm:h-4 sm:w-4`} />
          )}
          <span className={`min-w-0 whitespace-nowrap leading-none ${trendColorClass} sm:leading-snug`}>
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
