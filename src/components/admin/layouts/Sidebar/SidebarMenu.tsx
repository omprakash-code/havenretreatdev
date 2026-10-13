"use client";

import { useEffect, useState } from "react";
import { PENDING_REVIEW_COUNT_EVENT } from "@/lib/admin/pending-review-count";
import { sidebarMenu } from "./Sidebar.config";
import SidebarMenuItem from "./SidebarMenuItem";

const PENDING_REVIEW_HREF = "/admin/bookings/pending";

interface SidebarMenuProps {
  collapsed: boolean;
  activeLayoutId: string;
}

function usePendingReviewCount(enabled: boolean) {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    // A count pushed by the pending page is fresher than the KPI response.
    let announced = false;

    const onAnnounce = (event: Event) => {
      announced = true;
      setCount((event as CustomEvent<number>).detail);
    };
    window.addEventListener(PENDING_REVIEW_COUNT_EVENT, onAnnounce);

    fetch("/api/admin/kpis", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        const value = Number(json?.data?.pendingReview);
        if (!cancelled && !announced && json?.success && Number.isFinite(value)) {
          setCount(value);
        }
      })
      .catch(() => {
        // Badge is a hint only; the page still works without it.
      });

    return () => {
      cancelled = true;
      window.removeEventListener(PENDING_REVIEW_COUNT_EVENT, onAnnounce);
    };
  }, [enabled]);

  return count;
}

export default function SidebarMenu({ collapsed, activeLayoutId }: SidebarMenuProps) {
  const hasPendingReview = sidebarMenu.some((section) =>
    section.items.some((item) => item.href === PENDING_REVIEW_HREF)
  );
  const pendingReviewCount = usePendingReviewCount(hasPendingReview);

  return (
    <div className="px-2 py-4 space-y-6">
      {sidebarMenu.map((section) => {
        const collapsedLabel =
          section.label === "Main Menu"
            ? "Menu"
            : section.label === "Admin System"
              ? "System"
              : section.label;

        return (
          <div key={section.label}>
            {/* Section header – header-grade stability */}
            <div
              className={`px-3 mb-2 h-6 flex items-center min-w-[180px]
            ${collapsed
                  ? section.label === "Main Menu"
                    ? "-ml-[8px]"
                    : section.label === "Admin System"
                      ? "-ml-[16px]"
                      : ""
                  : ""
                }`}
            >
              <div className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
                {collapsed ? collapsedLabel : section.label}
              </div>
            </div>



            <div className="space-y-1">
              {section.items.map((item) => (
                <SidebarMenuItem
                  key={item.href}
                  {...item}
                  badge={item.href === PENDING_REVIEW_HREF ? pendingReviewCount : null}
                  collapsed={collapsed}
                  activeLayoutId={activeLayoutId}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
