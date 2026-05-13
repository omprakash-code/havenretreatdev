"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { X } from "@/components/icons";
import { NAV_LINKS } from "@/constants/routes";
import { trackMetaCtaClick } from "@/lib/meta/browser";

type MobileMenuDrawerProps = {
  isOpen: boolean;
  onClose: () => void;
};

export default function MobileMenuDrawer({
  isOpen,
  onClose,
}: MobileMenuDrawerProps) {
  const router = useRouter();
  const [pressedHref, setPressedHref] = useState<string | null>(null);

  const closeDrawer = () => {
    setPressedHref(null);
    onClose();
  };

  const handleMenuNavigate = (
    event: React.MouseEvent<HTMLAnchorElement>,
    href: string
  ) => {
    event.preventDefault();
    setPressedHref(href);

    window.setTimeout(() => {
      closeDrawer();
      router.push(href);
    }, 140);
  };

  return (
    <div
      className={`md:hidden fixed inset-0 z-[220] transition-opacity duration-200 ${
        isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
      }`}
    >
      <button
        type="button"
        aria-label="Close mobile menu"
        onClick={closeDrawer}
        className="absolute inset-0 bg-black/35"
      />

      <aside
        className={`fixed inset-y-0 right-0 h-[100dvh] w-[86vw] max-w-[360px] border-l border-gray-200 bg-white shadow-[-20px_0_60px_rgba(0,0,0,0.18)] transition-transform duration-220 ease-out will-change-transform flex flex-col ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-4">
          <div className="flex items-center">
            <div className="flex items-center justify-center">
              <Image src="/assets/logo.png" width={40} height={40} alt="Haven Retreat" />
            </div>
          </div>

          <button
            type="button"
            onClick={closeDrawer}
            className="h-10 w-10 rounded-[5px] border border-gray-200 bg-white text-black flex items-center justify-center shadow-[0_1px_4px_rgba(15,23,42,0.08)] active:bg-gray-100"
            aria-label="Close mobile menu"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="px-3 py-3 flex flex-col divide-y divide-gray-200">
          {NAV_LINKS.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              onClick={(event) => handleMenuNavigate(event, item.href)}
              className={`px-3 py-3 text-sm font-medium transition-colors duration-150 ${
                pressedHref === item.href
                  ? "text-[#FFD700]"
                  : "text-gray-700 hover:text-gray-900"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="mt-auto border-t border-gray-200 px-4 py-4 bg-gray-50/80">
          <Link
            href="/booking"
            onClick={() => {
              trackMetaCtaClick({
                ctaName: "Book Now",
                ctaLocation: "Mobile Menu",
                destination: "/booking",
              });
              closeDrawer();
            }}
            className="block w-full rounded-lg bg-[#FFD700] px-4 py-2.5 text-center text-sm font-semibold text-black active:bg-[#FFD700]/80"
          >
            Book Now
          </Link>

          <div className="mt-4 space-y-2 text-xs text-gray-700">
            <a href="tel:+919289289696" className="block hover:text-gray-900">
              Contact: +91 92892 89696
            </a>
            <a
              href="mailto:hello@havenretreat.com"
              className="block break-all hover:text-gray-900"
            >
              Email: hello@havenretreat.com
            </a>
            <a
              href="https://maps.google.com/?q=B-299, Outer Ring Rd, Block B, Saraswati Vihar, Pitampura, Delhi, 110034"
              target="_blank"
              rel="noopener noreferrer"
              className="block leading-relaxed hover:text-gray-900"
            >
              Address: B-299, Outer Ring Rd, Block B, Saraswati Vihar, Pitampura, Delhi 110034
            </a>
          </div>
        </div>
      </aside>
    </div>
  );
}
