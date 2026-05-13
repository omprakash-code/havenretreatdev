"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import {
  dismissCouponStripForHours,
  HOME_COUPON_STRIP_DISMISS_HOURS,
  isCouponStripDismissed,
} from "@/lib/coupon-strip-storage";
import { useMounted } from "@/hooks/useMounted";
import type { HomeCouponStripProps } from "./types";

export default function HomeCouponStrip({
  status = "on",
  message = "Get up to 50% off on selected bookings. Use code",
  couponCode = "GET50",
  dismissForHours = HOME_COUPON_STRIP_DISMISS_HOURS,
  forceShow = false,
  appearDelayMs = 2200,
  ctaLabel = "Book Now",
  ctaHref = "/booking",
  ctaPosition = "right",
}: HomeCouponStripProps) {
  const [dismissed, setDismissed] = useState(false);
  const [showAfterDelay, setShowAfterDelay] = useState(false);
  const mounted = useMounted();

  const handleDismiss = () => {
    dismissCouponStripForHours(dismissForHours);
    setDismissed(true);
  };

  const persistedDismissed = mounted ? isCouponStripDismissed() : false;
  const isVisible = useMemo(
    () =>
      mounted &&
      status === "on" &&
      !dismissed &&
      (forceShow || !persistedDismissed),
    [mounted, status, dismissed, forceShow, persistedDismissed]
  );

  useEffect(() => {
    if (!isVisible) return;
    const safeDelayMs = Math.max(0, Number(appearDelayMs) || 0);
    const timerId = window.setTimeout(() => {
      setShowAfterDelay(true);
    }, safeDelayMs);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [appearDelayMs, isVisible]);

  if (!isVisible) return null;

  const stripLayoutClass =
    ctaPosition === "left"
      ? "justify-start"
      : ctaPosition === "right"
        ? "justify-end"
        : ctaPosition === "center"
          ? "justify-center"
          : "justify-between";

  const groupedContentClass =
    ctaPosition === "space-between"
      ? "contents"
      : "flex items-center gap-3 sm:gap-4";

  const messageClass =
    ctaPosition === "right"
      ? "text-right"
      : ctaPosition === "center"
        ? "text-center"
        : "text-left";

  const messageWidthClass =
    ctaPosition === "space-between" ? "min-w-0 flex-1" : "min-w-0";

  return (
    <section
      className={`fixed inset-x-0 bg-slate-950 px-4 py-3 text-white shadow-lg shadow-black/20 transition-all duration-500 ease-out ${
        showAfterDelay
          ? "translate-y-0 opacity-100"
          : "translate-y-6 opacity-0 pointer-events-none"
      } bottom-0 top-auto z-[90]`}
      role="status"
      aria-live="polite"
    >
      <div className="mx-auto max-w-7xl pr-12">
        <div className="flex items-center justify-start">
          <div
            className={`flex w-full items-center gap-3 sm:gap-4 ${stripLayoutClass}`}
          >
            <div className={groupedContentClass}>
              <p
                className={`${messageWidthClass} text-sm font-medium tracking-tight text-slate-100 sm:text-base ${messageClass}`}
              >
                {message}{" "}
                <span className="rounded-md bg-white/10 px-2 py-0.5 font-semibold text-white">
                  {couponCode}
                </span>
              </p>
              <Link
                href={ctaHref}
                className="inline-flex h-8 shrink-0 items-center rounded-full bg-white px-3.5 text-xs font-semibold text-slate-900 transition-colors hover:bg-slate-100 sm:h-9 sm:px-4 sm:text-sm"
              >
                {ctaLabel}
              </Link>
            </div>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={handleDismiss}
        className="absolute right-4 top-3 rounded-full border border-white/15 bg-white/10 p-2 text-white/80 transition-colors hover:bg-white/15 hover:text-white sm:top-1/2 sm:-translate-y-1/2"
        aria-label="Close coupon strip"
      >
        <X size={14} />
      </button>
    </section>
  );
}
