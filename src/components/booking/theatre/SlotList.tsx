"use client";

import { useEffect, useState } from "react";
import { Calendar } from "@/components/icons";
import SlotChip from "./SlotChip";

/* -----------------------------
 Types
------------------------------ */

type Slot = {
  id: string;
  time: string;
  isBooked?: boolean;
  isLocked?: boolean;
  isLockedByMe?: boolean;
  lockRemainingSec?: number;
  isSpecial?: boolean;
  specialText?: string;
  basePrice: number;
  decorationMandatory: boolean;
};

type SlotListProps = {
  slots: Slot[];
  selectedSlotId?: string | null;
  onNextDayClick?: () => void;
  nextDayCount?: number;
  hasNextDay?: boolean;
  changingDate?: boolean;
  onSelect: (slot: {
    id: string;
    time: string;
    basePrice: number;
    decorationMandatory: boolean;
  }) => void;
};

/* -----------------------------
 Component
------------------------------ */

export default function SlotList({
  slots,
  selectedSlotId,
  onNextDayClick,
  nextDayCount = 0,
  hasNextDay = false,
  changingDate = false,
  onSelect,
}: SlotListProps) {
  const [tick, setTick] = useState(0);
  const nextDayDisabled = !onNextDayClick || !hasNextDay || changingDate;

  useEffect(() => {
    const i = setInterval(() => {
      setTick((t) => t + 1);
    }, 1000);

    return () => clearInterval(i);
  }, []);

  return (
    <div className="mt-2 grid grid-cols-3 items-start gap-1 lg:gap-1.5">
      {slots.map((slot) => (
        <SlotChip
          key={slot.id}
          label={slot.time}
          isBooked={slot.isBooked}
          isLocked={slot.isLocked}
          isLockedByMe={slot.isLockedByMe}
          lockRemainingSec={
            typeof slot.lockRemainingSec === "number"
              ? Math.max(slot.lockRemainingSec - tick, 0)
              : undefined
          }

          isSpecial={slot.isSpecial}
          specialText={slot.specialText}
          isSelected={selectedSlotId === slot.id}
          onClick={() =>
            onSelect({
              id: slot.id,
              time: slot.time,
              basePrice: slot.basePrice,
              decorationMandatory: slot.decorationMandatory,
            })
          }
        />
      ))}

      <button
        type="button"
        onClick={() => onNextDayClick?.()}
        disabled={nextDayDisabled}
        aria-label={`Check next day slots (${nextDayCount})`}
        title={`Check next day slots (${nextDayCount})`}
        className={`inline-flex w-full max-w-full items-center justify-center gap-1 rounded-full border px-2 py-1 text-[10px] font-semibold tracking-tight whitespace-nowrap transition sm:text-[12px] lg:px-3 lg:py-1 lg:text-[11px] ${
          nextDayDisabled
            ? "cursor-not-allowed border-gray-200 bg-gray-100 text-gray-400 opacity-80"
            : "cursor-pointer border-emerald-200 bg-emerald-50 text-emerald-800 shadow-sm hover:border-emerald-300 hover:bg-emerald-100"
        }`}
      >
        <Calendar size={12} />
        {`Tomorrow ${nextDayCount} Slot`}
      </button>
    </div>
  );
}
