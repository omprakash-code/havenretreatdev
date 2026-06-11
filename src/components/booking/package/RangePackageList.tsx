"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Users, Sparkles, Timer, PartyPopper } from "lucide-react";
import PackageCard from "@/components/packages/PackageCard";
import { BOOKING_ROUTES } from "@/constants/routes";
import { useBooking } from "@/context/BookingContext";
import type { EventPackageSummary } from "@/types/venue-package";

export default function RangePackageList() {
  const router = useRouter();
  const { hydrated } = useBooking();
  const [packages, setPackages] = useState<EventPackageSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [navigating, setNavigating] = useState(false);

  useEffect(() => {
    if (!hydrated) return;

    let cancelled = false;
    fetch("/api/packages", { cache: "no-store" })
      .then((res) => res.json())
      .then((result) => {
        if (cancelled) return;
        setPackages(Array.isArray(result?.data) ? result.data : []);
      })
      .catch(() => {
        if (!cancelled) toast.error("Unable to load packages.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [hydrated]);

  function selectPackage(eventPackage: EventPackageSummary) {
    if (navigating) return;
    setNavigating(true);
    sessionStorage.setItem("hr_pending_package_id", eventPackage.id);
    sessionStorage.setItem("hr_pending_package_name", eventPackage.name);
    sessionStorage.setItem("hr_pending_package_rate", String(eventPackage.hourlyRate ?? 0));
    sessionStorage.setItem("hr_pending_package_base_price", String(eventPackage.subtotalAmount ?? 0));
    router.push(BOOKING_ROUTES.SCHEDULE);
  }

  if (loading) {
    return (
      <section className="bg-white min-h-[calc(100vh-120px)]">
        <div className="px-4 py-10 text-center sm:py-8 lg:py-12">
          <div className="mx-auto max-w-5xl space-y-3">
            <div className="mx-auto h-8 w-64 animate-pulse rounded bg-gray-200 sm:h-10 sm:w-[420px]" />
            <div className="mx-auto h-5 w-40 animate-pulse rounded bg-gray-200 sm:w-56" />
          </div>
        </div>
        <div className="mx-auto max-w-7xl px-4 pb-12 sm:pb-16 lg:pb-20">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex flex-col bg-white shadow-[0_18px_50px_rgba(16,24,40,0.08)]">
                <div className="min-h-[180px] animate-pulse bg-gray-200 px-3 pb-5 pt-3">
                  <div className="h-5 w-24 rounded bg-gray-300" />
                  <div className="mt-auto flex flex-col items-center justify-end pt-16">
                    <div className="h-7 w-40 rounded bg-gray-300" />
                    <div className="mt-2 h-9 w-28 rounded bg-gray-300" />
                    <div className="mt-2 h-4 w-36 rounded bg-gray-300" />
                  </div>
                </div>
                <div className="flex flex-1 flex-col p-5">
                  <div className="h-3.5 w-16 animate-pulse rounded bg-gray-200" />
                  <div className="mt-3 space-y-2">
                    {[0, 1, 2, 3].map((j) => (
                      <div key={j} className="flex items-center gap-2">
                        <div className="h-4 w-4 animate-pulse rounded-full bg-gray-200" />
                        <div className="h-3.5 animate-pulse rounded bg-gray-200" style={{ width: `${60 + j * 8}%` }} />
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 h-10 w-full animate-pulse rounded bg-gray-100" />
                </div>
                <div className="mx-6 mb-6 h-10 animate-pulse rounded bg-gray-200" />
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (packages.length === 0) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-sm text-gray-500">
        No active packages are available.
      </div>
    );
  }

  return (
    <section className="bg-white">
      <div className="px-4 py-10 text-center sm:py-8 lg:py-12">
        <div className="mx-auto max-w-5xl">
          <h1 className="font-playfair text-[1.35rem] font-semibold leading-none tracking-[-0.045em] text-[#101828] sm:text-[2.5rem] lg:text-[2.5rem]">
            Premium Package Selection
          </h1>

        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 pb-12 sm:pb-16 lg:pb-20">
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {packages.map((eventPackage) => (
            <PackageCard
              key={eventPackage.id}
              eventPackage={eventPackage}
              onBook={selectPackage}
              bookLabel={
                navigating ? "Just a moment..." : "Continue with This Package"
              }
            />
          ))}

          {/* 5th card — always visible customize option */}
          <div className="flex h-full flex-col bg-white shadow-[0_18px_50px_rgba(16,24,40,0.08)]">
            <div className="relative min-h-[180px] overflow-hidden bg-[url('/media/booking/success/pool-view.avif')] bg-cover bg-center px-3 pb-5 pt-3 text-center text-white">
              <div className="absolute inset-0 bg-[#0b1f24]/80" />
              <div className="relative z-10 flex h-full min-h-[152px] flex-col items-center justify-end pt-10">
                <div className="absolute left-0 top-0 bg-[#edf7f3] px-3 py-1.5 text-[0.65rem] font-extrabold uppercase tracking-[0.11em] text-[#245e5b]">
                  Fully Custom
                </div>
                <h2 className="font-playfair text-[1.55rem] font-semibold leading-tight drop-shadow-sm sm:text-[1.8rem]">
                  Your Event, Your Way
                </h2>
                <p className="mt-1 text-sm font-semibold text-white/90">
                  Built around your vision
                </p>
              </div>
            </div>

            <div className="flex flex-1 flex-col p-5">
              <p className="text-xs font-semibold text-gray-500">What we customize</p>
              <ul className="mt-3 space-y-2">
                {[
                  { icon: Users, label: "Guest count & seating" },
                  { icon: Sparkles, label: "Décor theme & setup" },
                  { icon: Timer, label: "Timing & duration" },
                  { icon: PartyPopper, label: "Any occasion type" },
                ].map(({ icon: Icon, label }) => (
                  <li key={label} className="flex items-center gap-2 text-sm text-[#374151]">
                    <Icon size={14} className="shrink-0 text-[#347f7c]" />
                    {label}
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-xs leading-relaxed text-gray-500">
                Don&apos;t see what you&apos;re looking for? We&apos;ll build the perfect setup for your event.
              </p>
            </div>

            <a
              href="https://havenretreatmiami.com/contact-us/"
              target="_blank"
              rel="noopener noreferrer"
              className="group mx-6 mb-6 mt-0 inline-flex items-center justify-center border border-[#347f7c] bg-white px-4 py-2.5 text-sm font-semibold text-[#347f7c] transition hover:bg-[#edf3f1]"
            >
              Contact Us to Customize
              <span
                aria-hidden="true"
                className="ml-1.5 inline-block translate-x-[-6px] opacity-0 transition-all duration-200 ease-out group-hover:translate-x-0 group-hover:opacity-100"
              >
                →
              </span>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
