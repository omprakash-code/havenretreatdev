"use client";

import {
  ClientSplide,
  ClientSplideSlide,
} from "@/components/ui/ClientSplide";

import {
  Pencil,
  Trash,
  MapPin,
  Users,
  Utensils,
  Balloon,
  ShieldCheck,
  Heart,
  User,
  Cake,
  Wand2,
  Gift,
} from "@/components/icons";
import Image from "next/image";
// import { Splide, SplideSlide } from "@splidejs/react-splide";
// import "@splidejs/react-splide/css";
import { useState } from "react";
import type { AdminTheatre } from "@/types/admin/theatre-admin";
import { ToggleSwitch } from "@/components/ui/ToggleSwitch";
import { resolveTheatreCardContent } from "@/lib/theatre-card-content";

// Action Button Component with Tooltip
function ActionButton({
  icon,
  label,
  onClick,
  variant = "default",
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  variant?: "default" | "danger";
}) {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={onClick}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        className={`
          cursor-pointer p-2 rounded-lg transition-all duration-200
          ${variant === "danger"
            ? "hover:bg-red-50 text-slate-600 hover:text-red-600"
            : "hover:bg-slate-100 text-slate-600 hover:text-slate-900"
          }
        `}
      >
        {icon}
      </button>

      {/* Tooltip */}
      {showTooltip && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1.5 bg-slate-900 text-white text-xs rounded-lg whitespace-nowrap z-10 shadow-lg">
          {label}
          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-slate-900" />
        </div>
      )}
    </div>
  );
}

// Toggle with Tooltip Component
function ToggleWithTooltip({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: () => void;
}) {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div className="relative">
      <div
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        <ToggleSwitch checked={checked} onChange={onChange} />
      </div>

      {/* Tooltip */}
      {showTooltip && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1.5 bg-slate-900 text-white text-xs rounded-lg whitespace-nowrap z-10 shadow-lg">
          {checked ? "Active" : "Inactive"}
          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-slate-900" />
        </div>
      )}
    </div>
  );
}

function CarouselMedia({
  media,
  alt,
  priority = false,
}: {
  media: { url: string; type: "image" | "video" };
  alt: string;
  priority?: boolean;
}) {
  const [imageFailed, setImageFailed] = useState(false);

  if (media.type === "video") {
    return (
      <video
        src={media.url}
        className="h-full w-full object-cover"
        controls
        playsInline
        muted
        preload="metadata"
      />
    );
  }

  if (imageFailed) {
    return (
      <div
        role="img"
        aria-label={alt}
        className="h-full w-full bg-cover bg-center"
        style={{ backgroundImage: `url("${media.url}")` }}
      />
    );
  }

  return (
    <Image
      src={media.url}
      alt={alt}
      fill
      className="object-cover"
      sizes="(max-width: 768px) 100vw, 33vw"
      priority={priority}
      loading={priority ? "eager" : undefined}
      unoptimized
      onError={() => setImageFailed(true)}
    />
  );
}

export default function AdminTheatreCard({
  theatre,
  onEdit,
  onDelete,
  onDuplicate,
  onToggleActive,
}: {
  theatre: AdminTheatre;
  onEdit: (theatre: AdminTheatre) => void;
  onDelete?: (theatre: AdminTheatre) => void;
  onDuplicate?: (theatre: AdminTheatre) => void;
  onToggleActive?: (theatre: AdminTheatre) => void;
}) {
  const firstMedia = theatre.images?.[0];
  const cardContent = resolveTheatreCardContent(theatre.cardContent, {
    capacity: theatre.capacity,
    decorationPrice: theatre.decorationPrice,
    baseGuests: theatre.baseGuests,
    extraPersonPrice: theatre.extraPersonPrice,
    location: theatre.location?.name ?? "",
  });
  const nextStepItems = [
    {
      key: "details",
      icon: <User className="h-3.5 w-3.5" />,
      text: cardContent.nextStep.addDetails.text,
    },
    {
      key: "cake",
      icon: <Cake className="h-3.5 w-3.5" />,
      text: cardContent.nextStep.addCake.text,
    },
    {
      key: "fog",
      icon: <Wand2 className="h-3.5 w-3.5" />,
      text: cardContent.nextStep.fogEntry.text,
    },
    {
      key: "gifts",
      icon: <Gift className="h-3.5 w-3.5" />,
      text: cardContent.nextStep.gifts.text,
    },
  ].filter((step) => step.text.trim().length > 0);
  const idealForTitle = cardContent.idealFor.title.trim();
  const idealForLinePrimary = cardContent.idealFor.linePrimary.trim();
  const idealForLineSecondary = cardContent.idealFor.lineSecondary.trim();
  const hasIdealFor =
    cardContent.idealFor.enabled &&
    (idealForTitle.length > 0 ||
      idealForLinePrimary.length > 0 ||
      idealForLineSecondary.length > 0);
  const idealForTooltip = [
    idealForTitle,
    idealForLinePrimary,
    idealForLineSecondary,
  ]
    .filter((item) => item.length > 0)
    .join(" ");

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white transition-all duration-200 hover:border-slate-300 hover:shadow-lg">
      {/* Image Slider */}
      {theatre.images?.length > 0 && (
        <div className="relative h-[220px] overflow-hidden bg-slate-100 sm:h-[240px] lg:h-[260px]">
          {firstMedia?.type === "image" && (
            <div className="absolute inset-0">
              <CarouselMedia
                media={firstMedia}
                alt={`${theatre.name} preview`}
                priority
              />
            </div>
          )}

          <ClientSplide
            key={`${theatre.id}-${theatre.images.length}`}
            className="theatre-splide relative z-[1] h-full"
            options={{
              type: "loop",
              perPage: 1,
              arrows: theatre.images.length > 1,
              pagination: theatre.images.length > 1,
              drag: theatre.images.length > 1,
            }}
          >
            {theatre.images.map((media, index) => (
              <ClientSplideSlide key={`${media.url}-${index}`} className="h-full">
                <div className="relative w-full h-full">
                  <CarouselMedia
                    media={media}
                    alt={`${theatre.name} media ${index + 1}`}
                    priority={index === 0}
                  />
                </div>
              </ClientSplideSlide>
            ))}
          </ClientSplide>

          {/* Sort Order Badge - Compact */}
          {theatre.sortOrder !== undefined && (
            <div className="absolute top-3 left-3 z-10 bg-white/90 backdrop-blur-sm text-slate-800 text-xs font-bold px-2.5 py-1 rounded-lg shadow-md border border-slate-200">
              #{theatre.sortOrder}
            </div>
          )}
        </div>
      )}


      {/* Content */}
      <div className="flex flex-1 flex-col p-3 sm:p-4">
        {/* Title + Location + Map + Menu */}
        <div className="mb-3 flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="line-clamp-1 text-[15px] font-semibold text-slate-900 sm:text-base">
              {theatre.name}
            </h3>
            {theatre.location?.name && (
              <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {theatre.location?.name}
              </div>
            )}
          </div>

          <div className="flex gap-1.5 sm:gap-2">
            {/* Map Button */}
            {theatre.mapUrl && (
              <a
                href={theatre.mapUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex cursor-pointer flex-col items-center gap-0.5 text-gray-700 transition-colors hover:text-black"
              >
                <div className="flex h-7 w-7 items-center justify-center transition-all duration-200 group-hover:scale-105 sm:h-8 sm:w-8">
                  <Image
                    src="/assets/location.png"
                    alt="Map"
                    width={24}
                    height={24}
                  />
                </div>
                <span className="text-[9px] font-medium sm:text-[10px]">Map</span>
              </a>
            )}

            {/* Menu Button */}
            {theatre.menuFile && (
              <a
                href={theatre.menuFile}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex cursor-pointer flex-col items-center gap-0.5 text-gray-700 transition-colors hover:text-black"
              >
                <div className="flex h-7 w-7 items-center justify-center transition-all duration-200 group-hover:scale-105 sm:h-8 sm:w-8">
                  <Image
                    src="/assets/svg/Menu.svg"
                    alt="Menu"
                    width={24}
                    height={24}
                  />
                </div>
                <span className="text-[9px] font-medium sm:text-[10px]">Menu</span>
              </a>
            )}
          </div>
        </div>

        {/* Meta - Same as frontend */}
        <div className="mb-2 space-y-1 text-[10px] text-gray-600 sm:mb-1 sm:text-[12px]">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            {cardContent.capacity.enabled && cardContent.capacity.text.trim().length > 0 && (
              <span className="inline-flex items-center gap-1">
                <Users size={13} />
              {cardContent.capacity.text}
              </span>
            )}

            {cardContent.food.enabled &&
              cardContent.food.text.trim().length > 0 && (
              <span className="inline-flex items-center gap-1">
                <Utensils size={13} />
                {cardContent.food.text}
              </span>
            )}

            {cardContent.decor.enabled && cardContent.decor.text.trim().length > 0 && (
              <span className="inline-flex items-center gap-1">
                <Balloon size={13} />
                {cardContent.decor.text}
              </span>
            )}

            {cardContent.freeCancellation.enabled &&
              cardContent.freeCancellation.text.trim().length > 0 && (
                <span className="inline-flex items-center gap-1">
                  <ShieldCheck size={13} />
                  {cardContent.freeCancellation.text}
                </span>
              )}

            {hasIdealFor && (
              <div
                aria-label={idealForTooltip || "Ideal for"}
                className="group relative inline-flex min-w-0 cursor-help items-center gap-1"
              >
                {idealForTitle.length > 0 && <span className="truncate">{idealForTitle}</span>}
                {idealForLinePrimary.length > 0 && (
                  <>
                    <Heart size={12} className="shrink-0 text-gray-500" />
                    <span className="truncate">{idealForLinePrimary}</span>
                  </>
                )}
                {idealForLineSecondary.length > 0 && (
                  <>
                    <Users size={12} className="shrink-0 text-gray-500" />
                    <span className="truncate">{idealForLineSecondary}</span>
                  </>
                )}
                {idealForTooltip.length > 0 && (
                  <span className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-1 -translate-x-1/2 whitespace-nowrap rounded bg-black px-2 py-0.5 text-[9px] text-white opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100">
                    {idealForTooltip}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {cardContent.nextStep.enabled && nextStepItems.length > 0 && (
          <div className="mb-3 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-500">
            {cardContent.nextStep.title.trim().length > 0 && (
              <span className="font-medium text-slate-600">{cardContent.nextStep.title}</span>
            )}
            {nextStepItems.map((step, index) => (
              <div key={step.key} className="contents">
                {index > 0 && <span aria-hidden="true">&gt;</span>}
                <span className="inline-flex items-center gap-1">
                  {step.icon}
                  {step.text}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Footer Message */}
        {theatre.footerMessage && (
          <div className="mb-3 rounded-lg bg-slate-100 px-2 py-1 text-xs text-slate-900">
            {theatre.footerMessage}
          </div>
        )}

        {/* Admin Action Buttons */}
        <div className="mt-auto pt-3 border-t border-slate-200">
          <div className="flex items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[10px] text-slate-600 sm:text-[12px]">
              <span className="inline-flex items-center gap-1">
                <Balloon size={13} />
                Decoration ₹{theatre.decorationPrice.toLocaleString()}
              </span>
              <span className="inline-flex items-center gap-1">
                <Users size={13} />
                Extra ₹{theatre.extraPersonPrice.toLocaleString()}/person
              </span>
            </div>
            {/* Action buttons */}
            <div className="flex items-center gap-1.5 sm:gap-2">
              <ActionButton
                icon={
                  <Pencil className="h-4 w-4" />
                }
                label="Edit"
                onClick={() => onEdit(theatre)}
              />

              {onDuplicate && (
                <ActionButton
                  icon={
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  }
                  label="Duplicate"
                  onClick={() => onDuplicate(theatre)}
                />
              )}

              {onDelete && (
                <ActionButton
                  icon={
                    <Trash className="h-4 w-4" />
                  }
                  label="Delete"
                  onClick={() => onDelete(theatre)}
                  variant="danger"
                />
              )}

              {/* Toggle Button */}
              <ToggleWithTooltip
                checked={theatre.isActive}
                onChange={() => onToggleActive?.(theatre)}
              />
            </div>
          </div>

          {/* Price on left */}
          <div className="mt-2 flex min-h-[18px] items-center justify-end gap-2">
            {/* Updated at on right */}
            {theatre.updatedAt && (
              <div className="text-right text-[10px] leading-none text-slate-400">
                Updated: {theatre.updatedAtFormatted}
              </div>
            )}
          </div>


        </div>
      </div>

      <style jsx global>{`
        .theatre-splide,
        .theatre-splide .splide__track,
        .theatre-splide .splide__list,
        .theatre-splide .splide__slide {
          height: 100%;
        }
      `}</style>
    </div>
  );
}
