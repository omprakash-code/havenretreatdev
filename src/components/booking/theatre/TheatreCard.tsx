"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown } from "@/components/icons";
import { useBooking } from "@/context/BookingContext";
import type { Slot, Theatre } from "@/types/theatre";
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
      ctaName: "Book This Package",
      ctaLocation: "Package Card",
      destination: "/booking/contact",
    });

    try {
      const compatibleSlot = await resolveLegacySlotForRange(theatre.id, {
        locationId: booking.location.id,
        date: booking.date,
        startTime: booking.startTime,
        endTime: booking.endTime,
      });

      if (!compatibleSlot) {
        toast.error("This time range cannot be reserved yet. Choose another time range.");
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
  const ctaLabel = cardContent.cta.text.trim() || "Book This Package";

  const displayPrice = theatre.basePrice > 0 ? theatre.basePrice : null;

  return (
    <div className="flex flex-col border border-[#2f7e7a]/45 bg-white p-3">
      {badgeText && (
        <div className="mb-3 bg-[#edf3f1] px-3 py-2 text-center text-sm font-medium text-[#2b2b2b]">
          {badgeText}
        </div>
      )}

      <div className="bg-[#347f7c] px-4 py-4 text-center text-white">
        <h3 className="font-playfair text-[2rem] font-semibold leading-tight">
          {theatre.name}
        </h3>
        {cardContent.capacity.text.trim().length > 0 && (
          <p className="mt-1 text-base text-white/90">
            {cardContent.capacity.text}
          </p>
        )}
        {displayPrice !== null ? (
          <p className="mt-3 text-4xl font-semibold tracking-tight">
            ${displayPrice.toLocaleString()}
          </p>
        ) : (
          <p className="mt-3 text-sm font-medium text-white/80">
            Package price unavailable
          </p>
        )}
        {priceNoteText && (
          <p className="mt-2 text-sm text-white/90">
            {priceNoteText}
          </p>
        )}
      </div>

      {includedItems.length > 0 && (
        <section className="mt-4">
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
        <section className="mt-4 border border-[#e4e7ec]">
          <button
            type="button"
            onClick={() => setDetailsOpen((value) => !value)}
            className="flex w-full cursor-pointer items-center justify-between gap-3 bg-[#fafafa] px-3 py-2.5 text-left text-sm font-semibold text-[#347f7c]"
          >
            <span>{cardContent.packageDetails.triggerLabel.trim() || "View Package Details"}</span>
            <ChevronDown
              size={16}
              className={`shrink-0 transition-transform ${detailsOpen ? "rotate-180" : ""}`}
            />
          </button>

          {detailsOpen && (
            <div className="space-y-4 border-t border-[#e4e7ec] px-3 py-3">
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
          )}
        </section>
      )}

      <div className="mt-5 border-t border-[#e4e7ec] pt-4">
        <button
          type="button"
          onClick={handleContinue}
          disabled={locking}
          className="inline-flex w-full items-center justify-center bg-[#347f7c] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#245e5b] disabled:cursor-not-allowed disabled:bg-[#98a2b3]"
        >
          {locking ? "Reserving..." : ctaLabel}
        </button>
      </div>
    </div>
  );
}

async function resolveLegacySlotForRange(
  theatreId: string,
  range: {
    locationId: string;
    date: Date;
    startTime: string;
    endTime: string;
  }
) {
  const date = formatInTimeZone(range.date, IST_TIMEZONE, "yyyy-MM-dd");
  const res = await fetch(
    `/api/theatres?locationId=${encodeURIComponent(
      range.locationId
    )}&date=${date}&startTime=${encodeURIComponent(
      range.startTime
    )}&endTime=${encodeURIComponent(range.endTime)}`,
    { credentials: "include" }
  );
  const json = await res.json().catch(() => null);

  if (!res.ok || !json?.success) return null;

  const matchedTheatre = (json.data?.theatres as Theatre[] | undefined)?.find(
    (item) => item.id === theatreId
  );

  return matchedTheatre?.slots.find(isLockableLegacySlot) ?? null;
}

function isLockableLegacySlot(slot: Slot) {
  if (slot.isExpired === true || slot.status === "BOOKED" || slot.status === "DISABLED") {
    return false;
  }

  return slot.status === "AVAILABLE" || slot.isLockedByMe === true;
}
