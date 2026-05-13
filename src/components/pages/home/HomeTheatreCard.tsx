"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  MapPin,
  Users,
  User,
  Utensils,
  Gift,
  Cake,
  Heart,
  Monitor,
  Wand2,
  ShieldCheck,
  Balloon,
} from "@/components/icons";
import { BOOKING_ROUTES } from "@/constants/routes";
import { HomeOutlineButton } from "@/components/ui/HomeButtons";

type Props = {
  title: string;
  images: string[];
  capacity: number;
  price: string;
  location: string;
  mapUrl: string;
  menuUrl?: string;
  decorationPrice?: number;
};

const HOME_THEATRE_IMAGE_BY_NAME: Record<string, string> = {
  "Theatre 1": "/media/booking/theatres/theatre-1/theatre-1-1.png",
  "Theatre 2": "/media/booking/theatres/theatre-2/theatre-2-1.png",
  "Theatre 3": "/media/booking/theatres/theatre-3/theatre-3-1.png",
};

export default function HomeTheatreCard({
  title,
  images,
  capacity,
  price,
  location,
  mapUrl,
  menuUrl,
  decorationPrice = 700,
}: Props) {
  const router = useRouter();

  const displayImage =
    HOME_THEATRE_IMAGE_BY_NAME[title] ??
    images[0] ??
    "/media/booking/theatres/theatre-1/theatre-1-1.png";
  const featureTooltip = "Ideal for couples, family and friends";

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-gray-200 shadow-lg sm:rounded-2xl sm:shadow-xl">
      {/* Image */}
      <div className="booking-theatre-carousel relative h-[190px] sm:h-[210px] md:h-[220px] lg:h-[260px]">
        <div className="pointer-events-none absolute left-2 top-2 z-10 flex gap-1">
          <span className="inline-flex items-center gap-1 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-semibold text-white">
            <Monitor size={11} />
            150&quot; HD
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-semibold text-white">
            <SpeakerIcon className="h-3 w-3" />
            600W Sony
          </span>
        </div>
        <div className="relative h-full w-full">
          <Image
            src={displayImage}
            alt={`${title} image`}
            fill
            sizes="(max-width: 768px) 100vw, 33vw"
            className="object-cover"
            priority
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col p-2.5 sm:p-3.5 lg:p-4">
        {/* Title */}
        <div className="mb-1 flex items-start justify-between gap-2">
          <div className="min-w-0 flex items-center gap-2">
            <h3 className="truncate text-lg font-bold text-black sm:text-xl md:text-[22px] lg:text-2xl">
              {title}
            </h3>
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[#FFD700]/25 bg-[#FFD700]/8 px-1.5 py-0.5 text-[9px] font-semibold text-[#9a6b00] sm:px-2 sm:text-[10px]">
              Premium
            </span>
          </div>

          <div className="flex gap-1.5 sm:gap-2">
            <a
              href={mapUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex flex-col items-center gap-0.5 text-gray-700 transition-colors hover:text-black"
            >
              <div className="flex h-7 w-7 items-center justify-center rounded-full border border-gray-300 bg-white shadow-sm transition-all duration-200 group-hover:scale-105 group-hover:border-gray-300 group-hover:shadow sm:h-8 sm:w-8">
                <MapPin size={14} />
              </div>
              <span className="text-[9px] font-medium sm:text-[10px]">Map</span>
            </a>

            {menuUrl ? (
              <a
                href={menuUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex flex-col items-center gap-0.5 text-gray-700 transition-colors hover:text-black"
              >
                <div className="flex h-7 w-7 items-center justify-center rounded-full border border-gray-300 bg-white shadow-sm transition-all duration-200 group-hover:scale-105 group-hover:border-gray-300 group-hover:shadow sm:h-8 sm:w-8">
                  <Utensils size={14} />
                </div>
                <span className="text-[9px] font-medium sm:text-[10px]">Menu</span>
              </a>
            ) : null}
          </div>
        </div>

        {/* Info */}
        <div className="mb-2 space-y-1 text-[10px] text-gray-600 sm:mb-1 sm:text-[12px]">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <span className="inline-flex items-center gap-1">
              <MapPin size={13} />
              {location}
            </span>
            <span className="inline-flex items-center gap-1">
              <Users size={13} />
              Up to {capacity} People
            </span>
            <span className="inline-flex items-center gap-1">
              <Utensils size={13} />
              Food
            </span>
            <span className="inline-flex items-center gap-1">
              <Balloon size={13} />
              Decor ₹{decorationPrice} Only
            </span>
            <span className="inline-flex items-center gap-1">
              <ShieldCheck size={13} />
              Free Cancellation*
            </span>
            <div
              aria-label={featureTooltip}
              className="group relative inline-flex min-w-0 cursor-help items-center gap-1"
            >
              <span className="truncate">Ideal for</span>
              <Heart size={12} className="shrink-0 text-gray-500" />
              <span className="truncate">couple and</span>
              <Users size={12} className="shrink-0 text-gray-500" />
              <span className="truncate">family</span>
              <span className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-1 -translate-x-1/2 whitespace-nowrap rounded bg-black px-2 py-0.5 text-[9px] text-white opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100">
                {featureTooltip}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-gray-500">
            <span className="font-medium text-gray-600">Next Step:</span>
            <span className="inline-flex items-center gap-1">
              <User size={12} />
              Add Details
            </span>
            <span aria-hidden="true">&gt;</span>
            <span className="inline-flex items-center gap-1">
              <Cake size={12} />
              Add Cake
            </span>
            <span aria-hidden="true">&gt;</span>
            <span className="inline-flex items-center gap-1">
              <Wand2 size={12} />
              Fog Entry
            </span>
            <span aria-hidden="true">&gt;</span>
            <span className="inline-flex items-center gap-1">
              <Gift size={12} />
              Gifts
            </span>
          </div>
        </div>

        {/* Price + CTA */}
        <div className="mt-auto flex items-end justify-between gap-2 border-t border-gray-100 pt-2 sm:pt-2.5">
          <div className="min-w-0 flex-1">
            <p className="text-xl font-bold leading-none text-black sm:text-2xl md:text-2xl lg:text-3xl">{price}</p>
            <p className="mt-0.5 line-clamp-1 text-[10px] leading-tight text-gray-500 sm:text-xs lg:text-sm">
              For up to {capacity} Person
            </p>
          </div>

          <HomeOutlineButton
            onClick={() => router.push(BOOKING_ROUTES.ROOT)}
            className="min-w-[118px] shrink-0 border-black text-black hover:border-black hover:bg-black hover:text-white px-3.5 py-2 text-xs sm:min-w-[132px] sm:px-4 sm:py-2.5 sm:text-sm lg:min-w-[150px] lg:px-6 lg:py-3 lg:text-base"
          >
            Check Availability
          </HomeOutlineButton>
        </div>
      </div>
    </div>
  );
}

function SpeakerIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M8 9v6h3l4 3V6l-4 3H8z"
        fill="currentColor"
        opacity="0.95"
      />
      <path
        d="M17.5 9.5a4 4 0 010 5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M19 7a7 7 0 010 10"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
