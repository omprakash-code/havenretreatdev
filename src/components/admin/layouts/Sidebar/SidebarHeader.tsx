"use client";

// import { Menu } from "@/components/icons";
import Image from "next/image";
import Link from "next/link";

interface SidebarHeaderProps {
  collapsed: boolean;
  onToggle: () => void;
}

export default function SidebarHeader({
  collapsed,
}: SidebarHeaderProps) {
  return (
    <div className="h-16 flex items-center justify-between px-4 border-b border-neutral-200 sticky top-[0px] bg-white z-20">
      {/* Brand */}
      <Link
        href="/"
        aria-label="Go to home page"
        className="flex items-center gap-3 min-w-[180px]"
      >
        {/* Logo */}
       <Image src="/assets/logo.png" alt="Haven Retreat's Logo" width={44} height={44} className="bg-[#FFD700] rounded-full"/>
        {/* Text (NO layout animation) */}
        <div
          className={`transition-all duration-300 ease-out
          ${collapsed
              ? "opacity-0 -translate-x-2 pointer-events-none"
              : "opacity-100 translate-x-0"}
          `}
        >
          <div className="leading-tight">
            <div className="text-sm font-semibold text-neutral-900 tracking-tight">
              Haven Retreat
            </div>
            <div className="text-xs text-neutral-500">
              Admin Dashboard
            </div>
          </div>
        </div>
      </Link>
    </div>
  );
}
