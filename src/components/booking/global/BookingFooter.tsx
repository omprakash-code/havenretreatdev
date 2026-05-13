"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";

export default function BookingFooter() {
  const pathname = usePathname();
  const isPackagePage = pathname === "/booking/package";

  return (
    <footer
      className={`border-t border-white/10 bg-[#111827] px-6 pt-4 ${
        isPackagePage ? "pb-24 lg:pb-4" : "pb-4"
      }`}
    >
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3 text-sm">

        {/* Brand */}
        <div className="flex items-center">
          <div className="flex items-center justify-center">
            <Image
              src="/assets/logo.png"
              width={120}
              height={48}
              alt="Haven Retreat's Logo"
            />
          </div>
        </div>

        {/* Copyright */}
        <p className="text-center text-white/75 md:text-right">
          © 2026 Haven Retreat. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
