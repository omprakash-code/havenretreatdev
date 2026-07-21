"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import {
  inputClass,
  sectionClass,
  selectableInputClass,
} from "@/components/admin/bookings/add/shared";

function formatCurrency(value: number) {
  const amount = Number(value) || 0;
  return `$${amount.toLocaleString(undefined, {
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

const PAYMENT_LATER_TOOLTIP_ID = "payment-later-tooltip";
const TOOLTIP_CLOSE_DELAY_MS = 180;
const TOOLTIP_GAP_PX = 8;
const TOOLTIP_WIDTH_PX = 288;
const VIEWPORT_MARGIN_PX = 12;

type PaymentModeSectionProps = {
  mode?: "create" | "edit";
  paymentType: "OFFLINE" | "ONLINE";
  paymentAmountMode: "ADVANCE" | "FULL" | "REMAINING";
  amountPayNow: number;
  /** Advance already collected on this booking. Drives what is collectable now. */
  advancePaidAlready?: number;
  minimumAdvanceAmount: number;
  offlineMethod: "CASH" | "BANK";
  offlineReference: string;
  // Coupon props are retained so the form keeps preserving any coupon already
  // applied to a booking; the coupon entry UI is intentionally hidden here.
  couponCode: string;
  appliedCoupons: Array<{
    couponId: string;
    code: string;
    discountAmount: number;
  }>;
  showCouponInput: boolean;
  couponDiscount: number;
  couponApplying: boolean;
  couponLocked?: boolean;
  couponLockMessage?: string;
  couponError?: string | null;
  disablePaymentAmountMode?: boolean;
  lockPaymentSection?: boolean;
  /** Create-mode only: whether the admin records a payment with this booking. */
  collectPaymentNow?: boolean;
  errors: Record<string, string>;
  onCollectPaymentNowChange?: (value: boolean) => void;
  onPaymentTypeChange: (value: "OFFLINE" | "ONLINE") => void;
  onPaymentAmountModeChange: (value: "ADVANCE" | "FULL" | "REMAINING") => void;
  onAmountPayNowChange: (value: number) => void;
  onOfflineMethodChange: (value: "CASH" | "BANK") => void;
  onOfflineReferenceChange: (value: string) => void;
  onCouponCodeChange: (value: string) => void;
  onShowCouponInput: () => void;
  onApplyCoupon: () => void;
  onDismissCouponFeedback: () => void;
  onRemoveCoupon: (couponCode: string) => void;
};

export function PaymentModeSection({
  mode = "create",
  paymentAmountMode,
  amountPayNow,
  advancePaidAlready = 0,
  minimumAdvanceAmount,
  offlineMethod,
  offlineReference,
  disablePaymentAmountMode = false,
  lockPaymentSection = false,
  collectPaymentNow = true,
  errors,
  onCollectPaymentNowChange,
  onPaymentAmountModeChange,
  onAmountPayNowChange,
  onOfflineMethodChange,
  onOfflineReferenceChange,
}: PaymentModeSectionProps) {
  // The customer pays nothing during booking, so the first payment an admin
  // records is the choice: an advance, or the full amount. Once an advance
  // exists, follow-up collections are a typed partial amount or the balance —
  // and an edit may collect nothing at all (amount left empty).
  const hasAdvancePaid = advancePaidAlready > 0;
  const isAdvanceEntryMode = paymentAmountMode === "ADVANCE";
  const amountInputDisabled = !isAdvanceEntryMode;
  const amountInputValue = amountPayNow <= 0 ? "" : amountPayNow;
  // A new booking can be created without any payment (phone/email bookings paid
  // later via Zelle). Edits always show the collection fields as before.
  const showCollectionToggle = mode === "create" && Boolean(onCollectPaymentNowChange);
  const collapseCollectionFields = showCollectionToggle && !collectPaymentNow;
  const infoButtonRef = useRef<HTMLButtonElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [tooltipOpen, setTooltipOpen] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState({
    top: 0,
    left: 0,
    placement: "top" as const,
  });

  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const closeTooltip = useCallback(() => {
    clearCloseTimer();
    setTooltipOpen(false);
  }, [clearCloseTimer]);

  const scheduleCloseTooltip = useCallback(() => {
    clearCloseTimer();
    closeTimerRef.current = setTimeout(() => {
      setTooltipOpen(false);
      closeTimerRef.current = null;
    }, TOOLTIP_CLOSE_DELAY_MS);
  }, [clearCloseTimer]);

  const updateTooltipPosition = useCallback(() => {
    const trigger = infoButtonRef.current;
    if (!trigger || typeof window === "undefined") return;

    const rect = trigger.getBoundingClientRect();
    const tooltipWidth = tooltipRef.current?.offsetWidth || TOOLTIP_WIDTH_PX;
    const tooltipHeight = tooltipRef.current?.offsetHeight || 96;
    const viewportWidth = window.innerWidth;
    const preferredLeft = rect.right - tooltipWidth;
    const left = Math.min(
      Math.max(preferredLeft, VIEWPORT_MARGIN_PX),
      Math.max(VIEWPORT_MARGIN_PX, viewportWidth - tooltipWidth - VIEWPORT_MARGIN_PX)
    );
    const top = Math.max(
      rect.top - tooltipHeight - TOOLTIP_GAP_PX,
      VIEWPORT_MARGIN_PX
    );

    setTooltipPosition({ top, left, placement: "top" });
  }, []);

  const openTooltip = useCallback(() => {
    clearCloseTimer();
    setTooltipOpen(true);
  }, [clearCloseTimer]);

  useLayoutEffect(() => {
    if (!tooltipOpen) return;
    updateTooltipPosition();
  }, [tooltipOpen, updateTooltipPosition]);

  useEffect(() => {
    if (!tooltipOpen) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeTooltip();
      }
    };

    window.addEventListener("keydown", handleEscape);
    window.addEventListener("resize", updateTooltipPosition);
    window.addEventListener("scroll", updateTooltipPosition, true);

    return () => {
      window.removeEventListener("keydown", handleEscape);
      window.removeEventListener("resize", updateTooltipPosition);
      window.removeEventListener("scroll", updateTooltipPosition, true);
    };
  }, [closeTooltip, tooltipOpen, updateTooltipPosition]);

  useEffect(() => {
    return () => clearCloseTimer();
  }, [clearCloseTimer]);

  return (
    <section className={sectionClass}>
      <h2 className="text-sm font-semibold text-slate-900">5. Payment</h2>
      <p className="mt-1 text-xs text-slate-500">
        Select collection mode and amount details for this booking.
      </p>
      {showCollectionToggle ? (
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <label
            className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition ${
              collectPaymentNow
                ? "border-black bg-slate-50 font-medium text-slate-900"
                : "border-slate-300 text-slate-700 hover:bg-slate-50"
            }`}
          >
            <input
              type="radio"
              name="payment-collection-mode"
              checked={collectPaymentNow}
              onChange={() => onCollectPaymentNowChange?.(true)}
              className="accent-black"
            />
            <span>Collect payment now</span>
          </label>
          <div
            className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition ${
              !collectPaymentNow
                ? "border-black bg-slate-50 font-medium text-slate-900"
                : "border-slate-300 text-slate-700 hover:bg-slate-50"
            }`}
          >
            <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2">
              <input
                type="radio"
                name="payment-collection-mode"
                checked={!collectPaymentNow}
                onChange={() => onCollectPaymentNowChange?.(false)}
                className="accent-black"
              />
              <span>Collect payment later</span>
            </label>
            <span className="group relative inline-flex">
              <button
                ref={infoButtonRef}
                type="button"
                aria-label="About collecting payment later"
                aria-describedby={tooltipOpen ? PAYMENT_LATER_TOOLTIP_ID : undefined}
                aria-expanded={tooltipOpen}
                onClick={() => {
                  if (tooltipOpen) {
                    closeTooltip();
                  } else {
                    openTooltip();
                  }
                }}
                onFocus={openTooltip}
                onBlur={scheduleCloseTooltip}
                onPointerEnter={openTooltip}
                onPointerLeave={scheduleCloseTooltip}
                className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-slate-300 text-[11px] font-semibold text-slate-500 transition hover:border-slate-400 hover:bg-white hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-300"
              >
                i
              </button>
              {tooltipOpen ? (
                <div
                  ref={tooltipRef}
                  id={PAYMENT_LATER_TOOLTIP_ID}
                  role="tooltip"
                  onPointerEnter={openTooltip}
                  onPointerLeave={scheduleCloseTooltip}
                  className="fixed z-50 w-72 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-normal leading-relaxed text-slate-600 shadow-lg"
                  style={{
                    top: tooltipPosition.top,
                    left: tooltipPosition.left,
                  }}
                  data-placement={tooltipPosition.placement}
                >
                When payment is collected later, the booking is created as
                Approved with payment pending. You can record the payment
                anytime from Edit Booking.
                </div>
              ) : null}
            </span>
          </div>
        </div>
      ) : null}
      {collapseCollectionFields ? null : lockPaymentSection ? (
        <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
          <p className="text-xs font-medium text-slate-700">
            Payment completed. No collection required.
          </p>
        </div>
      ) : (
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">Amount Type</label>
            <select
              value={paymentAmountMode}
              disabled={disablePaymentAmountMode}
              onChange={(event) =>
                onPaymentAmountModeChange(
                  event.target.value as "ADVANCE" | "FULL" | "REMAINING"
                )
              }
              className={selectableInputClass}
            >
              {hasAdvancePaid ? (
                <>
                  <option value="ADVANCE">Partial Amount</option>
                  <option value="REMAINING">Remaining Balance</option>
                </>
              ) : (
                <>
                  <option value="ADVANCE">Advance</option>
                  <option value="FULL">Full</option>
                </>
              )}
            </select>
            {hasAdvancePaid ? (
              <p className="mt-1 text-xs text-slate-500">
                {formatCurrency(advancePaidAlready)} already collected. Enter a
                partial amount, pick the remaining balance, or leave empty to collect nothing.
              </p>
            ) : null}
            {errors.paymentAmountMode && (
              <p className="mt-1 text-xs text-red-600">{errors.paymentAmountMode}</p>
            )}
          </div>

          <div>
            <div className="mb-1 flex min-h-[16px] items-center justify-between gap-2">
              <label className="block text-xs font-medium text-slate-700">
                Amount to Collect
              </label>
              {isAdvanceEntryMode && !hasAdvancePaid ? (
                <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                  Min {formatCurrency(minimumAdvanceAmount)}
                </span>
              ) : null}
            </div>
            <input
              type="number"
              // An edit may collect nothing at all, so the browser must not block
              // an empty amount there; the form validates a typed advance itself.
              min={mode === "create" && isAdvanceEntryMode ? minimumAdvanceAmount : 0}
              step={0.01}
              placeholder="e.g. 150.50"
              value={amountInputValue}
              disabled={amountInputDisabled}
              onChange={(event) => {
                const val = event.target.value;
                if (val === "") {
                  onAmountPayNowChange(0);
                } else {
                  onAmountPayNowChange(Math.max(0, Number(val) || 0));
                }
              }}
              className={inputClass}
            />
            {errors.amountPayNow && <p className="mt-1 text-xs text-red-600">{errors.amountPayNow}</p>}
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">
              Method <span className="text-red-500">*</span>
            </label>
            <select
              value={offlineMethod}
              onChange={(event) => onOfflineMethodChange(event.target.value as "CASH" | "BANK")}
              className={selectableInputClass}
            >
              <option value="CASH">Cash</option>
              <option value="BANK">Zelle / Bank Transfer</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">
              Reference ID{" "}
              {offlineMethod === "BANK" && (
                <span className="text-red-500">*</span>
              )}
            </label>
            <input
              value={offlineReference}
              onChange={(event) => onOfflineReferenceChange(event.target.value)}
              className={inputClass}
              placeholder={offlineMethod === "BANK" ? "Zelle confirmation ID / bank reference" : "Optional reference"}
            />
            {errors.offlineReference && (
              <p className="mt-1 text-xs text-red-600">{errors.offlineReference}</p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
