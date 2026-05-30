"use client";

import type { ReactNode } from "react";

type BookingHeroCardProps = {
  title: string;
  subtitle: string;
  rateLabel?: ReactNode;
  children: ReactNode;
};

export default function BookingHeroCard({
  title,
  subtitle,
  rateLabel,
  children,
}: BookingHeroCardProps) {
  return (
    <div className="relative z-2 w-full max-w-[39rem] overflow-hidden bg-white/94 shadow-[0_36px_110px_rgba(15,23,42,0.28)] ring-1 ring-white/75 backdrop-blur-xl transition duration-500 ease-out">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white to-transparent" />

      <div className="flex items-start justify-between gap-5 border-b border-[#e4eeeb] px-5 py-5 sm:px-8 sm:py-6">
        <div className="min-w-0">
          <h1 className="font-playfair text-[1.3rem] font-semibold leading-none tracking-[-0.045em] text-[#101828] sm:text-[2.15rem]">
            {title}
          </h1>
          <p className="mt-1 truncate text-sm font-semibold text-[#245e5b]">
            {subtitle}
          </p>
        </div>
        {rateLabel && (
          <div className="shrink-0 text-right">
            {rateLabel}
          </div>
        )}
      </div>

      <div className="px-5 py-5 sm:px-8 sm:py-6">
        {children}
      </div>
    </div>
  );
}
