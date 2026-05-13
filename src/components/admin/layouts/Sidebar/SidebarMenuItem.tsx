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
}

export default function SidebarMenuItem({
  name,
  href,
  icon: Icon,
  collapsed,
  activeLayoutId,
}: SidebarMenuItemProps) {
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

        <div className="w-6 flex justify-center shrink-0">
          <Icon size={18} />
        </div>

        <div
          className={`overflow-hidden transition-all duration-300 ease-out
            ${collapsed ? "w-0 opacity-0 -translate-x-2" : "w-[180px] opacity-100 translate-x-0"}`}>
          <span className="block whitespace-nowrap">{name}</span>
        </div>
      </div>
    </Link>
  );
}
