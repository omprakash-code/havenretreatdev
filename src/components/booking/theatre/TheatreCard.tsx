"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Calendar } from "@/components/icons";
import SlotList from "./SlotList";
import { useBooking } from "@/context/BookingContext";
import type { Theatre } from "@/types/theatre";
import { formatSlotTime } from "@/lib/formatters";
import { toast } from "sonner";
import MobileStickyAction from "@/components/booking/global/MobileStickyAction";
import { resolveTheatreCardContent } from "@/lib/theatre-card-content";
import { trackMetaCtaClick } from "@/lib/meta/browser";
import FeatureItemIcon from "@/components/packages/FeatureItemIcon";

type UISlot = {
  id: string;
  time: string;
  date?: string;
  isBooked: boolean;
  isLocked: boolean;
  isLockedByMe?: boolean;
  lockRemainingSec?: number;
  isSpecial?: boolean;
  specialText?: string;
  basePrice: number;
  decorationMandatory: boolean;
};

type Props = {
  theatre: Theatre;
  onNextDayClick?: () => void;
  nextDayCount?: number;
  hasNextDay?: boolean;
  changingDate?: boolean;
};

export default function TheatreCard({
  theatre,
  onNextDayClick,
  nextDayCount = 0,
  hasNextDay = false,
  changingDate = false,
}: Props) {
  const { booking, setTheatreAndSlot, setBookingId, setSlotLockExpiresAt } = useBooking();
  const router = useRouter();
  const [locking, setLocking] = useState(false);
  const [isReserveShaking, setIsReserveShaking] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const selectedSlotId =
    booking.theatre?.id === theatre.id
      ? booking.slot?.id ?? null
      : null;

  const canContinue = Boolean(selectedSlotId);

  function triggerSlotSelectionFeedback() {
    toast.warning("Please select an available event time to continue.", {
      id: "slot-selection-required",
    });
    setIsReserveShaking(false);
    window.requestAnimationFrame(() => {
      setIsReserveShaking(true);
    });
  }

  useEffect(() => {
    if (canContinue) {
      setIsReserveShaking(false);
    }
  }, [canContinue]);

  useEffect(() => {
    if (!isReserveShaking) return;
    const timeoutId = window.setTimeout(() => {
      setIsReserveShaking(false);
    }, 360);
    return () => window.clearTimeout(timeoutId);
  }, [isReserveShaking]);

  async function handleContinue() {
    if (locking) return;
    if (!canContinue || !booking.slot || !booking.date) {
      triggerSlotSelectionFeedback();
      return;
    }

    setLocking(true);
    trackMetaCtaClick({
      ctaName: "Book This Package",
      ctaLocation: "Package Card",
      destination: "/booking/contact",
    });

    try {
      const res = await fetch("/api/bookings/lock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slotId: booking.slot.id,
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

  const uiSlots: UISlot[] = theatre.slots.map((slot) => {
    const isExpired = slot.isExpired === true;

    const isBooked =
      slot.status === "BOOKED" ||
      slot.status === "DISABLED" ||
      isExpired;

    const isLocked = slot.status === "LOCKED" && !isExpired;
    const isLockedByMe = isLocked && slot.isLockedByMe === true;

    return {
      id: slot.id,
      time: formatSlotTime(slot.startTime, slot.endTime),
      isBooked,
      isLocked,
      isLockedByMe,
      lockRemainingSec:
        isLocked && typeof slot.lockRemainingSec === "number"
          ? slot.lockRemainingSec
          : undefined,
      isSpecial: slot.isSpecial,
      specialText: slot.discountText ?? undefined,
      basePrice: slot.finalPrice ?? slot.basePrice,
      decorationMandatory: Boolean(slot.decorationMandatory),
    };
  });

  const isSelectableSlot = (slot: UISlot) =>
    !slot.isBooked && (!slot.isLocked || slot.isLockedByMe);

  const hasAvailableSlot = uiSlots.some(isSelectableSlot);
  const availableSlotCount = uiSlots.filter(isSelectableSlot).length;
  const slotBadgeText =
    availableSlotCount === 0
      ? "No times available"
      : `${availableSlotCount} time${availableSlotCount === 1 ? "" : "s"} available`;

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

  const displayPrice = (() => {
    if (
      booking.theatre?.id === theatre.id &&
      booking.slot?.basePrice
    ) {
      return booking.slot.basePrice;
    }

    const firstAvailableSlot = uiSlots.find(isSelectableSlot);
    return firstAvailableSlot?.basePrice ?? null;
  })();

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
            Price available after selecting a time
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

      <section className="mt-4 border-t border-[#e4e7ec] pt-3">
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="text-base font-semibold text-[#1f2937]">
            Choose Event Time
          </p>
          <span className="inline-flex items-center gap-1 rounded-full border border-[#d0d5dd] bg-[#f8fafb] px-2.5 py-1 text-xs font-semibold text-[#475467]">
            <Calendar size={13} />
            {slotBadgeText}
          </span>
        </div>

        <SlotList
          slots={uiSlots}
          selectedSlotId={selectedSlotId}
          onNextDayClick={onNextDayClick}
          nextDayCount={nextDayCount}
          hasNextDay={hasNextDay}
          changingDate={changingDate}
          onSelect={(slot) => {
            setTheatreAndSlot({
              id: theatre.id,
              name: theatre.name,
              capacity: theatre.capacity,
              basePrice: slot.basePrice,
              baseGuests: theatre.baseGuests,
              extraPersonPrice: theatre.extraPersonPrice,
              decorationPrice: theatre.decorationPrice,
            }, {
              id: slot.id,
              time: slot.time,
              basePrice: slot.basePrice,
              decorationMandatory: slot.decorationMandatory,
            });
          }}
        />
      </section>

      <div className="mt-5 flex items-end justify-between gap-3 border-t border-[#e4e7ec] pt-4">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-[#475467]">
            {hasAvailableSlot
              ? "Choose a time to continue"
              : "No available times for this package"}
          </p>
        </div>

        <div className="hidden shrink-0 lg:flex">
          <button
            type="button"
            onClick={handleContinue}
            disabled={locking}
            className={`inline-flex min-w-[170px] items-center justify-center bg-[#347f7c] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#245e5b] disabled:cursor-not-allowed disabled:bg-[#98a2b3] ${
              isReserveShaking ? "is-shaking" : ""
            }`}
          >
            {locking ? "Reserving..." : ctaLabel}
          </button>
        </div>
      </div>

      {canContinue && (
        <MobileStickyAction
          key={`slot-${selectedSlotId}`}
          label={locking ? "Reserving..." : ctaLabel}
          onClick={handleContinue}
          disabled={locking}
          totalPrice={displayPrice ?? booking.pricing?.total ?? null}
          advancePay={booking.pricing?.advancePay ?? null}
        />
      )}
    </div>
  );
}
