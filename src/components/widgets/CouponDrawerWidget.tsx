"use client";

import { useEffect, useMemo, useRef, useState, type TouchEvent } from "react";
import { Check, Copy, Info, Percent, Sparkles, X } from "lucide-react";
import {
  HOME_FLOATING_ACTIONS_COLLAPSE_EVENT,
  HOME_FLOATING_ACTIONS_EXPAND_EVENT,
  useHomeFloatingActions,
} from "@/components/pages/home/HomeFloatingActionsContext";
import type { AvailableCouponsWidgetProps } from "./types";

function useIsMobileBreakpoint(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    const apply = () => setIsMobile(media.matches);

    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [breakpoint]);

  return isMobile;
}

export default function AvailableCouponsWidget({
  status = "on",
  coupons: couponsProp,
  isLoading = false,
  triggerLabel = "View Coupons",
  title = "Available Coupons",
  subtitle = "Copy and save instantly",
  desktopPosition = "right",
  mobilePosition = "bottom-right",
}: AvailableCouponsWidgetProps) {
  const { collapsed } = useHomeFloatingActions();
  const coupons = useMemo(
    () =>
      (couponsProp ?? [])
        .filter((coupon) => coupon.isActive !== false)
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
    [couponsProp]
  );

  const [isOpen, setIsOpen] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [appliedCode, setAppliedCode] = useState<string | null>(null);
  const [isTooltipVisible, setIsTooltipVisible] = useState(true);
  const [isTooltipMounted, setIsTooltipMounted] = useState(true);
  const isMobile = useIsMobileBreakpoint();

  const panelRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const touchStartYRef = useRef<number | null>(null);
  const touchCurrentYRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isOpen || isMobile) return;

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (panelRef.current?.contains(target)) return;
      if (triggerRef.current?.contains(target)) return;
      setIsOpen(false);
    };

    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [isOpen, isMobile]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };

    if (isOpen) {
      document.addEventListener("keydown", onKeyDown);
    }
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isOpen]);

  useEffect(() => {
    if (!isMobile || !isOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [isMobile, isOpen]);

  useEffect(() => {
    const closeDrawer = () => {
      setIsOpen(false);
      setIsTooltipVisible(false);
    };
    const showTooltip = () => {
      setIsTooltipMounted(true);
      setIsTooltipVisible(true);
    };

    window.addEventListener(HOME_FLOATING_ACTIONS_COLLAPSE_EVENT, closeDrawer);
    window.addEventListener(HOME_FLOATING_ACTIONS_EXPAND_EVENT, showTooltip);
    return () => {
      window.removeEventListener(HOME_FLOATING_ACTIONS_COLLAPSE_EVENT, closeDrawer);
      window.removeEventListener(HOME_FLOATING_ACTIONS_EXPAND_EVENT, showTooltip);
    };
  }, []);

  useEffect(() => {
    if (!isMobile || collapsed || isOpen || !isTooltipVisible) return;

    const timerId = window.setTimeout(() => {
      setIsTooltipVisible(false);
    }, 5000);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [collapsed, isMobile, isOpen, isTooltipVisible]);

  useEffect(() => {
    if (isTooltipVisible) return;

    const timerId = window.setTimeout(() => {
      setIsTooltipMounted(false);
    }, 220);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [isTooltipVisible]);

  const handleApply = async (couponCode: string) => {
    try {
      await navigator.clipboard.writeText(couponCode);
      setCopiedCode(couponCode);
      window.setTimeout(() => {
        setCopiedCode((current) => (current === couponCode ? null : current));
      }, 1500);
    } catch {
      // Copy can fail on unsupported browsers, keep UI flow non-blocking.
    }

    setAppliedCode(couponCode);
    window.setTimeout(() => {
      setAppliedCode((current) => (current === couponCode ? null : current));
    }, 1800);
  };

  const onSheetTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    touchStartYRef.current = event.touches[0]?.clientY ?? null;
    touchCurrentYRef.current = touchStartYRef.current;
  };

  const onSheetTouchMove = (event: TouchEvent<HTMLDivElement>) => {
    touchCurrentYRef.current = event.touches[0]?.clientY ?? null;
  };

  const onSheetTouchEnd = () => {
    if (touchStartYRef.current == null || touchCurrentYRef.current == null) return;
    const delta = touchCurrentYRef.current - touchStartYRef.current;
    if (delta > 90) setIsOpen(false);
    touchStartYRef.current = null;
    touchCurrentYRef.current = null;
  };

  const listContent = (
    <div className="space-y-2.5">
      {isLoading ? (
        <div className="space-y-2">
          <div className="h-20 animate-pulse rounded-xl bg-gray-100" />
          <div className="h-20 animate-pulse rounded-xl bg-gray-100" />
          <div className="h-20 animate-pulse rounded-xl bg-gray-100" />
        </div>
      ) : coupons.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-6 text-center text-sm text-gray-500">
          No coupons available.
        </div>
      ) : (
        coupons.map((coupon, index) => (
          <article
            key={coupon.id}
            className={`rounded-xl border bg-white px-3.5 py-3 shadow-sm transition-all duration-300 ${
              isOpen ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
            } ${
              appliedCode === coupon.code
                ? "border-emerald-300 ring-1 ring-emerald-200"
                : "border-gray-200 hover:-translate-y-0.5 hover:shadow-md"
            }`}
            style={{ transitionDelay: `${Math.min(index * 40, 160)}ms` }}
          >
            <div className="mb-2 flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-base font-semibold tracking-wide text-gray-900">
                  {coupon.code}
                </p>
                <p className="truncate text-xs text-gray-600">{coupon.description}</p>
              </div>
              <span className="shrink-0 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                {coupon.badge}
              </span>
            </div>

            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1 text-xs text-gray-500">
                <Info size={12} />
                <span className="truncate">{coupon.terms ?? "Terms apply"}</span>
              </div>

              <button
                type="button"
                onClick={() => void handleApply(coupon.code)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-xs font-semibold text-gray-700 transition-transform duration-150 hover:bg-gray-100 active:scale-95"
              >
                {copiedCode === coupon.code ? (
                  <>
                    <Check size={12} className="text-emerald-600" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy size={12} />
                    Copy
                  </>
                )}
              </button>
            </div>
          </article>
        ))
      )}
    </div>
  );

  if (status === "off") return null;

  const desktopTrigger = (
    <button
      ref={triggerRef}
      type="button"
      aria-expanded={isOpen}
      aria-controls="home-coupon-drawer"
      onClick={() => setIsOpen((prev) => !prev)}
      className={`fixed top-1/2 z-40 hidden -translate-y-1/2 items-center gap-1 border border-emerald-200 bg-white px-2 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-emerald-700 shadow-lg shadow-black/10 transition-all duration-200 hover:bg-emerald-50 md:inline-flex ${
        desktopPosition === "left"
          ? "left-0 rounded-r-2xl border-l-0"
          : "right-0 rounded-l-2xl border-r-0"
      }`}
    >
      <span className="rotate-180 [direction:ltr] [writing-mode:vertical-lr] [text-orientation:mixed]">
        %{` ${triggerLabel}`}
      </span>
    </button>
  );

  const mobileTrigger = (
    <div
      className={`fixed bottom-5 z-40 transition-all duration-300 md:hidden ${
        mobilePosition === "bottom-left" ? "left-4" : "right-4"
      } ${
        collapsed
          ? "translate-x-5 opacity-0 pointer-events-none"
          : "translate-x-0 opacity-100"
      }`}
    >
      {!isOpen && isTooltipMounted ? (
        <div
          className={`pointer-events-none absolute top-1/2 -translate-y-1/2 transition-all duration-200 ${
            isTooltipVisible ? "opacity-100 translate-x-0" : "opacity-0 translate-x-1"
          } ${
            mobilePosition === "bottom-left" ? "left-full ml-3" : "right-full mr-3"
          }`}
        >
          <div className="relative whitespace-nowrap rounded-full border border-emerald-200/90 bg-white/95 px-3 py-1.5 text-xs font-semibold text-emerald-700 shadow-[0_10px_26px_rgba(15,23,42,0.12)] backdrop-blur">
            Available Coupons
            <span
              aria-hidden="true"
              className={`absolute top-1/2 h-2.5 w-2.5 -translate-y-1/2 rotate-45 border-emerald-200/90 bg-white/95 ${
                mobilePosition === "bottom-left"
                  ? "-left-1 border-b border-l"
                  : "-right-1 border-r border-t"
              }`}
            />
          </div>
        </div>
      ) : null}

      <button
        ref={triggerRef}
        type="button"
        aria-expanded={isOpen}
        aria-controls="home-coupon-drawer"
        aria-label={triggerLabel}
        title={triggerLabel}
        onClick={() => {
          setIsTooltipVisible(false);
          setIsOpen((prev) => !prev);
        }}
        className="relative inline-flex h-12 w-12 items-center justify-center rounded-full border border-emerald-200 bg-white text-emerald-700 shadow-[0_16px_35px_rgba(5,150,105,0.18)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-emerald-50"
      >
        <Percent size={18} className="relative z-10" />
      </button>
    </div>
  );

  return (
    <>
      {isMobile ? mobileTrigger : desktopTrigger}

      <div
        id="home-coupon-drawer"
        ref={panelRef}
        className={`fixed z-50 transition-all duration-300 ease-out ${
          isMobile
            ? "inset-x-0 bottom-0"
            : desktopPosition === "left"
              ? "left-[5px] top-1/2 w-[380px] -translate-y-1/2"
              : "right-[5px] top-1/2 w-[380px] -translate-y-1/2"
        } ${
          isOpen
            ? isMobile
              ? "pointer-events-auto translate-y-0 opacity-100"
              : "pointer-events-auto translate-x-0 opacity-100"
            : isMobile
              ? "pointer-events-none translate-y-full opacity-0"
              : desktopPosition === "left"
                ? "pointer-events-none -translate-x-[105%] opacity-0"
                : "pointer-events-none translate-x-[105%] opacity-0"
        }`}
        onTouchStart={isMobile ? onSheetTouchStart : undefined}
        onTouchMove={isMobile ? onSheetTouchMove : undefined}
        onTouchEnd={isMobile ? onSheetTouchEnd : undefined}
      >
        {isMobile ? (
          <>
            <button
              type="button"
              aria-label="Close coupons"
              onClick={() => setIsOpen(false)}
              className={`fixed inset-0 z-40 bg-black/35 backdrop-blur-[2px] transition-opacity duration-300 ${
                isOpen ? "opacity-100" : "opacity-0"
              }`}
            />

            <section className="relative z-50 h-[80vh] rounded-t-3xl border border-gray-200 bg-white p-4 shadow-2xl">
              <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-gray-300" />
              <header className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold text-gray-900">{title}</h3>
                  <p className="text-xs text-gray-500">{subtitle}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-800"
                  aria-label="Close coupons panel"
                >
                  <X size={16} />
                </button>
              </header>
              <div className="h-[calc(80vh-88px)] overflow-y-auto pr-1">{listContent}</div>
            </section>
          </>
        ) : (
          <section className="h-[min(58vh,540px)] rounded-2xl border border-gray-200 bg-white p-3.5 shadow-xl shadow-black/10">
            <header className="mb-3 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="flex items-center gap-1.5 text-base font-semibold text-gray-900">
                  <Sparkles size={15} className="text-emerald-600" />
                  {title}
                </h3>
                <p className="text-xs text-gray-500">{subtitle}</p>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-800"
                aria-label="Close coupons panel"
              >
                <X size={16} />
              </button>
            </header>

            <div className="max-h-[calc(58vh-76px)] overflow-y-auto pr-1">{listContent}</div>
          </section>
        )}
      </div>

    </>
  );
}
