"use client";

import { useMounted } from "@/hooks/useMounted";
import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { Menu } from "@/components/icons";
import { useRouter } from "next/navigation";
import { NAV_LINKS } from "@/constants/routes";
import AnnouncementBar from "@/components/layouts/AnnouncementBar";
import MobileMenuDrawer from "@/components/layouts/MobileMenuDrawer";
import { trackMetaCtaClick } from "@/lib/meta/browser";

export default function Header() {
  const mounted = useMounted();
  const [showHeader, setShowHeader] = useState(true);
  const [isAtTop, setIsAtTop] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const lastScrollYRef = useRef(0);
  const router = useRouter();
  const isTransparentHeader = isAtTop;

  useEffect(() => {
    lastScrollYRef.current = window.scrollY;

    const handleScroll = () => {
      if (mobileMenuOpen) return;
      const currentScroll = window.scrollY;
      setIsAtTop(currentScroll <= 8);

      const delta = currentScroll - lastScrollYRef.current;

      if (currentScroll <= 0) {
        setShowHeader(true);
      } else if (delta > 0) {
        setShowHeader(false);
      } else if (delta < 0) {
        setShowHeader(true);
      }

      lastScrollYRef.current = currentScroll;
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [mobileMenuOpen]);

  useEffect(() => {
    if (!mobileMenuOpen) return;

    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileMenuOpen]);

  if (!mounted) return null;

  return (
    <>
      <header
        className={`fixed top-0 left-0 w-full z-[100] will-change-transform transition-[transform,opacity,background-color,border-color] duration-300 ease-out
      ${showHeader || mobileMenuOpen ? "translate-y-0 opacity-100" : "-translate-y-full opacity-0"}
      ${
        isTransparentHeader
          ? "bg-transparent border-b border-transparent backdrop-blur-0"
          : "bg-white/75 backdrop-blur-md border-b border-gray-200/70"
      }`}
      >
        <AnnouncementBar />

        <div className="max-w-7xl mx-auto px-4 md:px-8 py-3 md:py-1 flex items-center justify-between text-gray-900">
          <button
            type="button"
            onClick={() => {
              setMobileMenuOpen(false);
              router.push("/");
            }}
            className="flex items-center gap-2 cursor-pointer rounded-md px-1 py-1 active:bg-gray-100"
          >
            <div className="flex items-center justify-center">
              <Image
                src="/assets/logo.png"
                width={70}
                height={70}
                alt="Haven Retreat"
                className="h-[45px] w-[45px] md:h-[70px] md:w-[70px]"
              />
            </div>
          </button>

          <nav className="hidden md:flex items-center gap-8">
            {NAV_LINKS.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className={`text-md font-medium transition relative after:absolute after:left-0 after:-bottom-1 after:h-0.5 after:w-0 after:bg-[#FFD700] after:transition-all hover:after:w-full ${
                  isTransparentHeader
                    ? "text-white/95 hover:text-[#FFD700]"
                    : "text-black hover:text-[#FFD700]"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <Link
              href="/booking"
              onClick={() => {
                trackMetaCtaClick({
                  ctaName: "Book Now",
                  ctaLocation: "Header",
                  destination: "/booking",
                });
                setMobileMenuOpen(false);
              }}
              className="hidden md:inline-flex px-4 md:px-8 py-2 md:py-3 bg-[#FFD700] text-black rounded-full font-semibold text-xs md:text-sm hover:shadow-xl hover:shadow-[#FFD700]/35 active:bg-[#FFD700]/80 transition-all"
            >
              Book Now
            </Link>

            <button
              type="button"
              onClick={() => {
                setShowHeader(true);
                setMobileMenuOpen((prev) => !prev);
              }}
              className={`md:hidden h-10 w-10 rounded-[5px] border flex items-center justify-center transition-colors ${
                isTransparentHeader
                  ? "border-white/60 bg-white/10 text-white active:bg-white/20"
                  : "border-gray-200 bg-white text-black active:bg-gray-100"
              }`}
              aria-label={mobileMenuOpen ? "Close mobile menu" : "Open mobile menu"}
              aria-expanded={mobileMenuOpen}
            >
              <Menu size={18} />
            </button>
          </div>
        </div>
      </header>

      <MobileMenuDrawer
        isOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
      />
    </>
  );
}
