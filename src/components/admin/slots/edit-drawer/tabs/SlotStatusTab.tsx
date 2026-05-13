"use client";

import {
  forwardRef,
  useEffect,
  useId,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { AlertTriangle, Info } from "lucide-react";
import type { AdminSlot } from "@/types/admin/slot-admin";
import { ToggleSwitch } from "@/components/ui/ToggleSwitch";

export type SlotStatusPayload = {
  status: "AVAILABLE" | "DISABLED";
  discountText: string | null;
  reason: string;
};

export type SlotStatusTabMeta = {
  hasChanges: boolean;
  canSubmit: boolean;
  hasVisibilityChange: boolean;
  hasMessageChange: boolean;
};

export type SlotStatusTabHandle = {
  submit: (reason: string) => Promise<boolean>;
};

type SlotStatusTabProps = {
  slot: AdminSlot;
  disabled?: boolean;
  onSave: (payload: SlotStatusPayload) => Promise<void>;
  onMetaChange?: (meta: SlotStatusTabMeta) => void;
};

const MAX_DISCOUNT_TEXT_LENGTH = 25;

function InfoTooltipButton({
  label,
  content,
}: {
  label: string;
  content: string;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const tooltipId = useId();

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (triggerRef.current?.contains(target)) return;
      if (tooltipRef.current?.contains(target)) return;
      setOpen(false);
    };

    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onEscape);
    };
  }, [open]);

  return (
    <span className="relative inline-flex">
      <button
        ref={triggerRef}
        type="button"
        aria-label={`More info about ${label}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={tooltipId}
        className="inline-flex h-4 w-4 cursor-pointer items-center justify-center rounded-full text-slate-400 outline-none transition hover:text-slate-600 focus-visible:text-slate-700"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={(event) => {
          const next = event.relatedTarget as Node | null;
          if (next && tooltipRef.current?.contains(next)) return;
          setOpen(false);
        }}
        onClick={() => setOpen((prev) => !prev)}
      >
        <Info size={12} />
      </button>

      <div
        ref={tooltipRef}
        id={tooltipId}
        role="tooltip"
        tabIndex={-1}
        className={`absolute left-0 top-full z-20 mt-1 w-56 max-w-[calc(100vw-1.5rem)] rounded-md border border-slate-200 bg-white p-2 text-[11px] font-medium text-slate-700 shadow-sm transition-all duration-200 ease-out ${
          open
            ? "translate-y-0 opacity-100"
            : "-translate-y-1 pointer-events-none opacity-0"
        }`}
      >
        {content}
      </div>
    </span>
  );
}

const SlotStatusTab = forwardRef<SlotStatusTabHandle, SlotStatusTabProps>(
  function SlotStatusTab({ slot, disabled, onSave, onMetaChange }, ref) {
    const [status, setStatus] = useState(slot.status);
    const [discountText, setDiscountText] = useState(slot.pricing.discountText ?? "");

    const bookings = slot.bookings ?? [];
    const hasBookings = bookings.length > 0 || slot.bookingCount > 0;
    const isSystemLocked = slot.status === "LOCKED";
    const isChanged =
      status !== slot.status ||
      discountText.trim() !== (slot.pricing.discountText ?? "");
    const hasVisibilityChange = status !== slot.status;
    const hasMessageChange = discountText.trim() !== (slot.pricing.discountText ?? "");

    const overrideStatus: "AVAILABLE" | "DISABLED" =
      status === "DISABLED" ? "DISABLED" : "AVAILABLE";

    const isDisabled = status === "DISABLED";
    const hasDiscountText = discountText.trim().length > 0;
    const discountLength = discountText.length;
    const isTooLong =
      hasDiscountText && discountText.length > MAX_DISCOUNT_TEXT_LENGTH;
    const canSubmit =
      !isChanged ||
      Boolean(!disabled && !isSystemLocked && !isTooLong);

    useEffect(() => {
      onMetaChange?.({
        hasChanges: isChanged,
        canSubmit,
        hasVisibilityChange,
        hasMessageChange,
      });
    }, [canSubmit, hasMessageChange, hasVisibilityChange, isChanged, onMetaChange]);

    useImperativeHandle(
      ref,
      () => ({
        submit: async (reason: string) => {
          if (!isChanged) return false;
          if (disabled || isSystemLocked) {
            throw new Error("This slot is locked and cannot be modified.");
          }
          if (isTooLong) {
            throw new Error(`Offer message must be ${MAX_DISCOUNT_TEXT_LENGTH} characters or fewer.`);
          }
          if (status === "DISABLED" && hasBookings) {
            throw new Error("This slot has bookings and cannot be hidden.");
          }

          const hasVisibilityChange = status !== slot.status;
          const trimmedReason = reason.trim();
          if (hasVisibilityChange && trimmedReason.length < 10) {
            throw new Error("Reason is required for visibility change (minimum 10 characters).");
          }
          const overrideReason =
            trimmedReason.length >= 10
              ? trimmedReason
              : "Updated offer/display message";

          await onSave({
            status: overrideStatus,
            discountText: discountText.trim() || null,
            reason: overrideReason,
          });
          return true;
        },
      }),
      [
        disabled,
        discountText,
        hasBookings,
        isChanged,
        isSystemLocked,
        isTooLong,
        onSave,
        overrideStatus,
        status,
        slot.status,
      ]
    );

    return (
      <div className="space-y-2">
        <div className="space-y-2 rounded-lg border border-slate-200 p-3">
          <h3 className="text-sm font-semibold text-slate-900">Slot Visibility</h3>

          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-slate-700">
              {isDisabled
                ? "Hidden from customers."
                : hasBookings
                ? "Visible to customers. This slot already has bookings."
                : "Visible and bookable."}
            </p>

            <ToggleSwitch
              checked={!isDisabled}
              disabled={disabled || isSystemLocked || hasBookings}
              onChange={(checked) => setStatus(checked ? "AVAILABLE" : "DISABLED")}
            />
          </div>

          {hasBookings && isDisabled && (
            <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-700">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              <span>This slot has confirmed bookings and cannot be hidden.</span>
            </div>
          )}
        </div>

        {isSystemLocked && (
          <div className="rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-xs text-slate-600">
            This slot is currently locked by the system and cannot be modified.
          </div>
        )}

        <div className="space-y-1 rounded-lg border border-slate-200 p-3">
          <div className="flex justify-between">
            <div className="flex items-center gap-1">
              <label className="text-xs text-slate-500">
                Offer / Display Message (optional)
              </label>
              <InfoTooltipButton
                label="Offer / Display Message"
                content="Displayed on the slot chip on the theatre page."
              />
            </div>
            <span className={`text-xs ${isTooLong ? "text-red-600" : "text-slate-400"}`}>
              {discountLength}/{MAX_DISCOUNT_TEXT_LENGTH}
            </span>
          </div>

          <input
            type="text"
            disabled={disabled}
            value={discountText}
            onChange={(e) => setDiscountText(e.target.value)}
            placeholder="e.g. Festive Offer • Limited time"
            className={`w-full rounded-md border border-slate-300 px-3 py-2 text-sm ${
              isTooLong ? "border-red-500 focus:ring-red-500" : ""
            }`}
          />

          {hasDiscountText && isTooLong && (
            <p className="text-xs text-red-600">
              Text is too long and will be cut off in slot UI.
            </p>
          )}
        </div>
      </div>
    );
  }
);

export default SlotStatusTab;
