//src/components/booking/theatre/SlotChip.tsx
"use client";

type SlotChipProps = {
  label: string;
  isBooked?: boolean;
  isSelected?: boolean;
  isLocked?: boolean; //
  isLockedByMe?: boolean;
  lockRemainingSec?: number;
  isSpecial?: boolean;
  specialText?: string; // e.g. "₹749 less"
  onClick?: () => void;
};

export default function SlotChip({
  label,
  isBooked,
  isLocked,
  isLockedByMe,
  lockRemainingSec,
  isSelected,
  specialText,
  onClick,
}: SlotChipProps) {
  const locked = isLocked === true;
  const lockedByMe = isLockedByMe === true;
  const booked = isBooked === true;
  const disabled = booked || (locked && !lockedByMe);


  const tooltipText = booked
    ? "Already booked"
    : lockedByMe
      ? "Reserved for you"
      : locked
        ? "Temporarily locked"
        : "Available";
  const tooltipWithCountdown =
    locked && typeof lockRemainingSec === "number"
      ? `${tooltipText} · ${formatCountdown(lockRemainingSec)}`
      : tooltipText;
  const isExpiringSoon =
    lockedByMe &&
    typeof lockRemainingSec === "number" &&
    lockRemainingSec > 0 &&
    lockRemainingSec <= 60;

  const hasSpecialText =
    !booked &&
    !locked &&
    typeof specialText === "string" &&
    specialText.trim().length > 0;
  const slotVariantClass = isBooked
    ? "border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed"
    : locked && !lockedByMe
      ? "border-amber-300 bg-amber-100 text-amber-900 cursor-not-allowed"
      : isSelected
        ? "border-green-600 bg-green-600 text-white hover:bg-green-700 cursor-pointer"
      : lockedByMe
          ? `border-green-600 bg-green-100 text-green-900 hover:bg-green-200 cursor-pointer ${
              isExpiringSoon ? "ring-1 ring-red-300 ring-offset-1 animate-pulse" : ""
            }`
          : "border-green-500 bg-white text-green-800 hover:bg-green-50 cursor-pointer";

  return (
    <div className="group relative w-full">
      {hasSpecialText && (
        <div className="pointer-events-none absolute inset-x-0 top-2 sm:top-1 z-10 flex justify-center">
          <div className="-translate-y-1/2 inline-flex w-full items-center justify-center rounded-t-[16px] rounded-b-[12px] border border-green-200 bg-green-50 px-2 pb-6 sm:pb-6 pt-0.5 text-[8px] font-semibold leading-none text-green-700 sm:text-[11px]">
            <span className="truncate">{specialText.trim()}</span>
          </div>
        </div>
      )}

      <button
        type="button"
        disabled={disabled}
        onClick={onClick}
        aria-label={tooltipWithCountdown}
        className={`relative z-20 inline-flex w-full font-semibold justify-center rounded-full border px-2 py-1 text-[9px] font-medium tracking-tight whitespace-nowrap transition sm:text-[12px] lg:px-3 lg:py-1 lg:text-[11px] ${slotVariantClass}`}
      >
        {label}
      </button>

      <div className="pointer-events-none absolute left-1/2 z-30 -top-4.5 hidden -translate-x-1/2 opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100 lg:block">
        <div className="bg-black text-white text-[9px] px-2 py-[2px] rounded-full whitespace-nowrap">
          {tooltipText}
          {locked && typeof lockRemainingSec === "number" ? (
            <> · {formatCountdown(lockRemainingSec)}</>
          ) : null}
          {isExpiringSoon ? <span className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-red-400 align-middle animate-pulse" /> : null}
        </div>
      </div>
    </div>
  );
}


/* -----------------------------
 Countdown formatter
------------------------------ */
function formatCountdown(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}
