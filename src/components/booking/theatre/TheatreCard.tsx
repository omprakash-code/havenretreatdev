"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown } from "@/components/icons";
import { useBooking } from "@/context/BookingContext";
import type { Theatre } from "@/types/theatre";
import { formatSlotTime } from "@/lib/formatters";
import { formatInTimeZone } from "date-fns-tz";
import { toast } from "sonner";
import { resolveTheatreCardContent } from "@/lib/theatre-card-content";
import { trackMetaCtaClick } from "@/lib/meta/browser";
import FeatureItemIcon from "@/components/packages/FeatureItemIcon";

type Props = {
  theatre: Theatre;
};

const IST_TIMEZONE = "Asia/Kolkata";
const DEFAULT_PACKAGE_CTA = "Continue with This Package";
const PACKAGE_HERO_IMAGE = "/media/booking/success/pool-view.avif";

export default function TheatreCard({ theatre }: Props) {
  const { booking, setTheatreAndSlot, setBookingId, setSlotLockExpiresAt } = useBooking();
  const router = useRouter();
  const [locking, setLocking] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);

  async function handleContinue() {
    if (locking) return;
    if (!booking.location || !booking.date || !booking.startTime || !booking.endTime) {
      toast.error("Choose your location, date, and time range first.");
      return;
    }

    setLocking(true);
    trackMetaCtaClick({
      ctaName: DEFAULT_PACKAGE_CTA,
      ctaLocation: "Package Card",
      destination: "/booking/contact",
    });

    try {
      const compatibleSlot = await resolveRangeSlotForPackage(theatre.id, {
        locationId: booking.location.id,
        date: booking.date,
        startTime: booking.startTime,
        endTime: booking.endTime,
      });

      if (!compatibleSlot?.id) {
        return;
      }

      const res = await fetch("/api/bookings/lock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slotId: compatibleSlot.id,
          theatreId: theatre.id,
        }),
      });

      const json = await res.json();

      if (!res.ok || !json.success || !json.data?.bookingId) {
        const code = json?.code as string | undefined;

        if (code === "LOCK_IN_USE") {
          toast.error("This slot is currently reserved.");
        } else if (
          code === "RESERVATION_EXPIRED" ||
          code === "SLOT_NOT_AVAILABLE"
        ) {
          toast.error("Reservation expired, please try again.");
        } else {
          toast.error(json.message || "Slot not available");
        }

        router.refresh();
        return;
      }

      setTheatreAndSlot(
        {
          id: theatre.id,
          name: theatre.name,
          capacity: theatre.capacity,
          basePrice: compatibleSlot.finalPrice ?? compatibleSlot.basePrice,
          baseGuests: theatre.baseGuests,
          extraPersonPrice: theatre.extraPersonPrice,
          decorationPrice: theatre.decorationPrice,
        },
        {
          id: compatibleSlot.id,
          time: formatSlotTime(compatibleSlot.startTime, compatibleSlot.endTime),
          basePrice: compatibleSlot.finalPrice ?? compatibleSlot.basePrice,
          decorationMandatory: Boolean(compatibleSlot.decorationMandatory),
        }
      );
      setBookingId(json.data.bookingId);
      setSlotLockExpiresAt(
        typeof json.data.lockExpiresAt === "string"
          ? json.data.lockExpiresAt
          : null
      );
      router.push("/booking/contact");
    } catch (error) {
      toast.error((error as Error)?.message || "Something went wrong. Please try again.");
    } finally {
      setLocking(false);
    }
  }

  const cardContent = resolveTheatreCardContent(theatre.cardContent, {
    capacity: theatre.capacity,
    decorationPrice: theatre.decorationPrice,
    baseGuests: theatre.baseGuests,
    extraPersonPrice: theatre.extraPersonPrice,
    location: booking.location?.name ?? "",
  });

  const badgeText =
    cardContent.badge.enabled && cardContent.badge.text.trim().length > 0
      ? cardContent.badge.text
      : "";
  const priceNoteText =
    cardContent.priceNote.enabled && cardContent.priceNote.text.trim().length > 0
      ? cardContent.priceNote.text
      : theatre.footerMessage?.trim() ?? "";
  const compactPriceNoteText = priceNoteText.replace(
    /\s+with\s+package\s+pricing\s*$/i,
    ""
  );
  const includedItems =
    cardContent.included.enabled && cardContent.included.items.length > 0
      ? cardContent.included.items
      : [
          cardContent.capacity.text,
          cardContent.food.enabled ? cardContent.food.text : "",
          cardContent.decor.enabled ? cardContent.decor.text : "",
          cardContent.freeCancellation.enabled ? cardContent.freeCancellation.text : "",
        ].filter((item) => item.trim().length > 0);
  const detailSections = cardContent.packageDetails.enabled
    ? cardContent.packageDetails.sections.filter(
        (section) => section.title.trim().length > 0 || section.items.length > 0
      )
    : [];
  const priceBreakdownRows = cardContent.priceBreakdown.enabled
    ? cardContent.priceBreakdown.items
    : [];
  const hasExpandedContent = detailSections.length > 0 || priceBreakdownRows.length > 0;
  const configuredCtaLabel = cardContent.cta.text.trim();
  const ctaLabel =
    configuredCtaLabel && configuredCtaLabel !== "Book This Package"
      ? configuredCtaLabel
      : DEFAULT_PACKAGE_CTA;

  const displayPrice = theatre.basePrice > 0 ? theatre.basePrice : null;
  const isMostPopular = badgeText.toLowerCase().includes("popular");
  return (
    <div className="flex flex-col bg-white shadow-[0_18px_45px_rgba(16,24,40,0.08)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_24px_60px_rgba(16,24,40,0.12)]">
      <div
        className="relative isolate min-h-[185px] overflow-hidden bg-[#102f2d] px-5 py-7 text-center text-white"
        style={{
          backgroundImage: `linear-gradient(180deg,rgba(9,22,20,0.36),rgba(9,22,20,0.84)), url(${PACKAGE_HERO_IMAGE})`,
          backgroundPosition: "center",
          backgroundSize: "cover",
        }}
      >
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_center,rgba(52,127,124,0.28),transparent_42%)]" />
        {badgeText && (
          <div
            className={`absolute left-2.5 top-2.5 z-10 px-3 py-1.5 text-[0.65rem] font-bold uppercase tracking-[0.06em] shadow-[0_10px_22px_rgba(16,24,40,0.18)] ring-1 ${
              isMostPopular
                ? "bg-[#347f7c] text-white ring-[#347f7c]"
                : "bg-[#e8f2ef] text-[#1d5f5b] ring-[#c6ddcf]"
            }`}
          >
            {badgeText}
          </div>
        )}

        <div className="mx-auto flex min-h-[132px] max-w-[20rem] flex-col items-center justify-center pt-4">
          <h3 className="max-w-full truncate font-playfair text-[1.75rem] font-semibold leading-none tracking-[-0.035em] drop-shadow-[0_2px_10px_rgba(0,0,0,0.45)]">
            {theatre.name}
          </h3>

          {displayPrice !== null ? (
            <div className="mt-3 flex items-center justify-center gap-2">
              <p className="font-playfair text-[1.9rem] font-medium leading-none tracking-[-0.04em] text-white/95">
                ${displayPrice.toLocaleString()}
              </p>
              {compactPriceNoteText && (
                <span className="bg-[#e8f2ef] px-2.5 py-1 text-[0.68rem] font-bold uppercase tracking-[0.04em] text-[#1d5f5b]">
                  {compactPriceNoteText}
                </span>
              )}
            </div>
          ) : (
            <p className="mt-3 text-sm font-medium text-white/78">
              Package price unavailable
            </p>
          )}

          {cardContent.capacity.text.trim().length > 0 && (
            <p className="mt-3 text-sm font-semibold text-white/84">
              {cardContent.capacity.text}
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col p-5">
        {includedItems.length > 0 && (
          <section>
            <h4 className="text-lg font-semibold text-[#222]">
              {cardContent.included.title.trim() || "Included"}
            </h4>
            <ul className="mt-3 space-y-2 text-sm text-[#667085]">
              {includedItems.map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <FeatureItemIcon label={item} />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {hasExpandedContent && (
          <section className="mt-5 border-y border-[#e4e7ec]">
            <button
              type="button"
              aria-expanded={detailsOpen}
              aria-controls={`package-details-${theatre.id}`}
              onClick={() => setDetailsOpen((value) => !value)}
              className="flex w-full cursor-pointer items-center justify-between gap-3 py-3 text-left text-sm font-semibold text-[#347f7c]"
            >
              <span>{cardContent.packageDetails.triggerLabel.trim() || "View Package Details"}</span>
              <ChevronDown
                size={16}
                className={`shrink-0 transition-transform duration-300 ease-out ${
                  detailsOpen ? "rotate-180" : ""
                }`}
              />
            </button>

            <div
              id={`package-details-${theatre.id}`}
              aria-hidden={!detailsOpen}
              className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${
                detailsOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
              }`}
            >
              <div className="min-h-0 overflow-hidden">
                <div className="space-y-4 pb-4">
                  {detailSections.map((section) => (
                    <div key={section.title || section.items.join("|")}>
                      {section.title.trim().length > 0 && (
                        <h5 className="text-base font-semibold text-[#3b3b3b]">
                          {section.title}
                        </h5>
                      )}
                      {section.items.length > 0 && (
                        <ul className="mt-2 space-y-2 text-sm text-[#667085]">
                          {section.items.map((item) => (
                            <li key={item} className="flex items-start gap-3">
                              <FeatureItemIcon label={item} />
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}

                  {priceBreakdownRows.length > 0 && (
                    <div>
                      <h5 className="text-base font-semibold text-[#3b3b3b]">
                        {cardContent.priceBreakdown.title.trim() || "Price Breakdown"}
                      </h5>
                      <div className="mt-2 space-y-2 text-sm text-[#667085]">
                        {priceBreakdownRows.map((row) => (
                          <div key={`${row.label}-${row.value}`} className="flex items-center justify-between gap-4">
                            <span>{row.label}</span>
                            <span>{row.value}</span>
                          </div>
                        ))}
                      </div>

                      {(cardContent.priceBreakdown.totalLabel.trim().length > 0 ||
                        cardContent.priceBreakdown.totalValue.trim().length > 0) && (
                        <div className="mt-3 flex items-center justify-between gap-4 border-t border-[#e4e7ec] pt-3 text-base font-semibold text-[#101828]">
                          <span>{cardContent.priceBreakdown.totalLabel}</span>
                          <span>{cardContent.priceBreakdown.totalValue}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>
        )}

        <div className="mt-auto pt-5">
          <button
            type="button"
            onClick={handleContinue}
            disabled={locking}
            className="inline-flex w-full items-center justify-center bg-[#347f7c] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#245e5b] disabled:cursor-not-allowed disabled:bg-[#98a2b3]"
          >
            {locking ? "Reserving..." : ctaLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

async function resolveRangeSlotForPackage(
  theatreId: string,
  range: {
    locationId: string;
    date: Date;
    startTime: string;
    endTime: string;
  }
) {
  const date = formatInTimeZone(range.date, IST_TIMEZONE, "yyyy-MM-dd");
  const res = await fetch("/api/bookings/resolve-range-slot", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      theatreId,
      locationId: range.locationId,
      date,
      startTime: range.startTime,
      endTime: range.endTime,
    }),
  });
  const json = await res.json().catch(() => null);

  if (!res.ok || !json?.success) {
    toast.error(json?.message || "Unable to reserve this time range.");
    return null;
  }

  return json.data?.slot ?? null;
}
