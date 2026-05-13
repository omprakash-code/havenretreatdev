"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Menu, Search, Bell, User, LogOut, ChevronDown } from "@/components/icons";
import Image from "next/image";
import { resolveAdminProfileImage } from "@/lib/admin-profile-image";

interface GlobalHeaderProps {
  onToggleSidebar: () => void;
}

type AdminProfilePayload = {
  fullName?: string;
  email?: string;
  phone?: string;
};

export default function GlobalHeader({ onToggleSidebar }: GlobalHeaderProps) {
  const router = useRouter();
  const [visible, setVisible] = useState(true);
  const lastScrollTop = useRef(0);
  const [imageError, setImageError] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);
  const [profile, setProfile] = useState<AdminProfilePayload | null>(null);

  const profileImageSrc = resolveAdminProfileImage(
    {
      fullName: profile?.fullName,
      email: profile?.email,
      phone: profile?.phone,
    },
    "header"
  );
  const displayName = profile?.fullName?.trim() || "Admin";
  const displayMeta =
    profile?.email?.trim() || profile?.phone?.trim() || "Manage account";

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const res = await fetch("/api/admin/profile", { cache: "no-store" });
        if (!res.ok) return;
        const json = (await res.json()) as {
          success?: boolean;
          data?: AdminProfilePayload;
        };
        if (!cancelled && json.success && json.data) {
          setProfile(json.data);
        }
      } catch {
        // Keep fallback avatar on fetch failure.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const container = document.getElementById("admin-scroll-container");
    if (!container) return;

    const onScroll = () => {
      const current = container.scrollTop;

      if (current > lastScrollTop.current && current > 80) {
        setVisible(false);
      } else {
        setVisible(true);
      }

      lastScrollTop.current = current;
    };

    container.addEventListener("scroll", onScroll, { passive: true });
    return () => container.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setImageError(false);
  }, [profileImageSrc]);

  useEffect(() => {
    const handleOutside = (event: PointerEvent) => {
      if (!profileMenuRef.current) return;
      if (!profileMenuRef.current.contains(event.target as Node)) {
        setProfileMenuOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setProfileMenuOpen(false);
      }
    };

    document.addEventListener("pointerdown", handleOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("pointerdown", handleOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  const handleLogout = async () => {
    try {
      await fetch("/api/admin/logout", {
        method: "POST",
      });
    } catch (error) {
      console.error("LOGOUT_ERROR", error);
    } finally {
      window.location.href = "/admin/login";
    }
  };

  const handleGoToProfile = () => {
    setProfileMenuOpen(false);
    router.push("/admin/profile");
  };

  const toggleProfileMenu = () => {
    setProfileMenuOpen((prev) => !prev);
  };

  return (
    <header
      className={`fixed top-0 right-0 z-30 bg-white border-b border-neutral-200
  transition-transform duration-300 ease-out
  ${visible ? "translate-y-0" : "-translate-y-full"} left-0 lg:left-[var(--sidebar-width)]`}
    >
      <div className="h-14 sm:h-16 px-3 sm:px-4 md:px-5 lg:px-6 flex items-center justify-between">
        {/* Left */}
        <div className="flex items-center gap-2 sm:gap-4">
          <button
            onClick={onToggleSidebar}
            className="w-9 h-9 rounded-md flex cursor-pointer items-center justify-center hover:bg-neutral-100 active:scale-95 transition"
          >
            <Menu size={17} className="text-neutral-700" />
          </button>

          <div className="relative hidden">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
            />
            <input
              placeholder="Search bookings, customers, theatres"
              className="h-10 w-[340px] pl-9 pr-4 rounded-full border border-neutral-200 text-sm focus:outline-none focus:ring-1 focus:ring-neutral-400"
            />
          </div>
        </div>

        {/* Right */}
        <div className="flex items-center gap-1.5 sm:gap-3">
          <button className="w-9 h-9 rounded-full flex cursor-pointer items-center justify-center hover:bg-neutral-100 active:scale-95 transition">
            <Bell size={18} className="text-neutral-700" />
          </button>

          <div
            ref={profileMenuRef}
            className="relative group flex items-center gap-1"
          >
            <button
              type="button"
              onClick={toggleProfileMenu}
              aria-haspopup="menu"
              aria-expanded={profileMenuOpen}
              aria-label="Toggle profile menu"
              className="w-9 h-9 rounded-full bg-neutral-200 flex cursor-pointer items-center justify-center overflow-hidden hover:ring-2 hover:ring-neutral-300 transition"
            >
              {!imageError ? (
                <Image
                  src={profileImageSrc}
                  alt="Admin"
                  width={40}
                  height={40}
                  className="object-cover"
                  onError={() => setImageError(true)}
                />
              ) : (
                <User className="w-5 h-5 text-neutral-500" />
              )}
            </button>
            <button
              type="button"
              onClick={toggleProfileMenu}
              aria-label="Toggle profile menu"
              aria-haspopup="menu"
              aria-expanded={profileMenuOpen}
              className="inline-flex cursor-pointer items-center justify-center rounded-md p-0.5 text-neutral-500 transition hover:bg-neutral-100"
            >
              <ChevronDown
                size={14}
                className={`transition-transform duration-150 ${profileMenuOpen ? "translate-y-[1px]" : "group-hover:translate-y-[1px]"}`}
              />
            </button>

            {/* Dropdown */}
            <div
              className={`absolute right-0 top-full mt-2 w-56 bg-white border border-neutral-200 rounded-xl shadow-lg transition-all duration-150 ${
                profileMenuOpen
                  ? "opacity-100 visible"
                  : "opacity-0 invisible"
              }`}
            >
              <div className="border-b border-neutral-100 px-3.5 py-3">
                <p className="truncate text-sm font-semibold text-neutral-900">
                  {displayName}
                </p>
                <p className="mt-0.5 truncate text-xs text-neutral-500">
                  {displayMeta}
                </p>
              </div>

              <button
                onClick={handleGoToProfile}
                className="w-full flex cursor-pointer items-center gap-2 px-3.5 py-2.5 text-sm text-neutral-700 transition hover:bg-neutral-50 hover:text-black"
              >
                <User size={16} className="text-neutral-500" />
                Profile
              </button>

              <div className="h-px bg-neutral-100" />
              <button
                onClick={handleLogout}
                className="w-full flex cursor-pointer items-center gap-2 px-3.5 py-2.5 text-sm text-rose-600 transition hover:bg-rose-50 hover:text-rose-700"
              >
                <LogOut size={16} className="text-rose-500" />
                Logout
              </button>

            </div>
          </div>

        </div>
      </div>
    </header>
  );
}
