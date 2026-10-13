"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { LucideIcon } from "lucide-react";

interface SidebarMenuItemProps {
  name: string;
  href: string;
  icon: LucideIcon;
  collapsed: boolean;
  activeLayoutId: string;
  badge?: number | null;
}

export default function SidebarMenuItem({
  name,
  href,
  icon: Icon,
  collapsed,
  activeLayoutId,
  badge = null,
}: SidebarMenuItemProps) {
  const badgeLabel = badge && badge > 0 ? (badge > 99 ? "99+" : String(badge)) : null;
  const pathname = usePathname();
  const normalizedPathname =
    pathname && pathname !== "/" ? pathname.replace(/\/+$/, "") : pathname;
  const normalizedHref = href !== "/" ? href.replace(/\/+$/, "") : href;

  const isActive =
    normalizedHref === "/admin"
      ? normalizedPathname === "/admin"
      : normalizedPathname === normalizedHref;

  return (
    <Link href={href} className="relative block">
      {/* Active background */}
      {isActive && (
        <motion.div
          layoutId={activeLayoutId}
          className="absolute inset-0 rounded-md bg-neutral-900/10"
          transition={{ type: "spring", stiffness: 260, damping: 30 }}
        />
      )}

      {/* Item container — ALWAYS full width */}
      <div
        className={`relative z-10 h-10 flex items-center rounded-md text-sm transition-colors
          ${collapsed ? "justify-center" : "px-3 gap-3"}
          ${
            isActive
              ? "text-neutral-900"
              : "text-neutral-500 hover:text-neutral-900 hover:bg-neutral-900/5"
          }
        `}
      >

        <div className="relative w-6 flex justify-center shrink-0">
          <Icon size={18} />
          {badgeLabel && collapsed && (
            <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[9px] font-semibold leading-none text-white">
              {badgeLabel}
            </span>
          )}
        </div>

        <div
          className={`overflow-hidden transition-all duration-300 ease-out
            ${collapsed ? "w-0 opacity-0 -translate-x-2" : "w-[180px] opacity-100 translate-x-0"}`}>
          <span className="flex items-center justify-between gap-2 whitespace-nowrap pr-1">
            {name}
            {badgeLabel && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500 px-1.5 text-[11px] font-semibold leading-none text-white">
                {badgeLabel}
                <span className="sr-only"> awaiting review</span>
              </span>
            )}
          </span>
        </div>
      </div>
    </Link>
  );
}
