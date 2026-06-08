import { useEffect, useRef, useState } from "react";
import {
  inputClass,
  sectionClass,
  selectableInputClass,
} from "@/components/admin/bookings/add/shared";
import { PaymentTypeToggle } from "@/components/admin/bookings/add/sections/PaymentTypeToggle";
import { isCouponConditionMessage } from "@/lib/coupon-feedback";
import { getCouponDisplayCode } from "@/lib/coupon-display";
import { AlertCircle, Info, Percent, Tag, X } from "lucide-react";

type PaymentModeSectionProps = {
  mode?: "create" | "edit";
  paymentType: "OFFLINE" | "ONLINE";
  paymentAmountMode: "ADVANCE" | "FULL" | "REMAINING";
  amountPayNow: number;
  minimumAdvanceAmount: number;
  offlineMethod: "CASH" | "BANK";
  offlineReference: string;
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
  errors: Record<string, string>;
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

function CouponFeedbackCallout({
  tone,
  message,
  onDismiss,
}: {
  tone: "info" | "error";
  message: string;
  onDismiss: () => void;
}) {
  const isInfo = tone === "info";
  const Icon = isInfo ? Info : AlertCircle;

  return (
    <div
      className={`inline-flex max-w-full items-start gap-1.5 rounded-md border px-2.5 py-1.5 text-[11px] shadow-sm sm:max-w-[min(32rem,calc(100vw-3rem))] sm:text-xs ${
        isInfo
          ? "border-sky-200 bg-sky-50 text-sky-800"
          : "border-red-200 bg-red-50 text-red-700"
      }`}
    >
      <Icon
        size={14}
        className={`mt-0.5 shrink-0 self-start ${isInfo ? "text-sky-700" : "text-red-600"}`}
      />
      <p className="min-w-0 flex-1 break-words leading-[1.05rem]">{message}</p>
      <button
        type="button"
        onClick={onDismiss}
        className={`-mr-0.5 mt-0.5 inline-flex h-4.5 w-4.5 shrink-0 cursor-pointer items-center justify-center self-start rounded-sm transition ${
          isInfo
            ? "text-sky-600 hover:bg-sky-100 hover:text-sky-800"
            : "text-red-500 hover:bg-red-100 hover:text-red-700"
        }`}
        aria-label="Dismiss coupon message"
      >
        <X size={12} />
      </button>
    </div>
  );
}

export function PaymentModeSection({
  mode = "create",
  paymentType,
  paymentAmountMode,
  amountPayNow,
  minimumAdvanceAmount,
  offlineMethod,
  offlineReference,
  couponCode,
  appliedCoupons,
  showCouponInput,
  couponDiscount,
  couponApplying,
  couponLocked = false,
  couponLockMessage = "",
  couponError = null,
  disablePaymentAmountMode = false,
  lockPaymentSection = false,
  errors,
  onPaymentTypeChange,
  onPaymentAmountModeChange,
  onAmountPayNowChange,
  onOfflineMethodChange,
  onOfflineReferenceChange,
  onCouponCodeChange,
  onShowCouponInput,
  onApplyCoupon,
  onDismissCouponFeedback,
  onRemoveCoupon,
}: PaymentModeSectionProps) {
  const normalizedCouponCode = couponCode.trim();
  const hasAppliedCoupons = appliedCoupons.length > 0;
  const shouldShowCouponInput =
    !hasAppliedCoupons || showCouponInput || Boolean(normalizedCouponCode);
  const isEditMode = mode === "edit";
  const isRemainingMode = paymentAmountMode === "REMAINING";
  const amountInputDisabled = isEditMode ? isRemainingMode : paymentAmountMode === "FULL";
  const couponInputDisabled = couponApplying;
  const couponInputReadOnly = couponLocked;
  const amountInputValue = amountPayNow <= 0 ? "" : amountPayNow;
  const couponMessageIsInfo = isCouponConditionMessage({ message: couponError });
  const [showCouponLockHint, setShowCouponLockHint] = useState(false);
  const couponLockHintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showCouponError =
    Boolean(couponError) &&
    (!couponLocked || couponError !== couponLockMessage);
  const couponFeedbackMessage = errors.couponCode || (showCouponError ? couponError ?? "" : "");
  const couponFeedbackTone: "info" | "error" =
    !errors.couponCode && couponMessageIsInfo ? "info" : "error";

  const triggerCouponLockHint = () => {
    if (!couponLocked || !couponLockMessage.trim()) return;
    setShowCouponLockHint(true);
    if (couponLockHintTimerRef.current) {
      clearTimeout(couponLockHintTimerRef.current);
    }
    couponLockHintTimerRef.current = setTimeout(() => {
      setShowCouponLockHint(false);
      couponLockHintTimerRef.current = null;
    }, 5000);
  };

  useEffect(() => {
    if (!couponLocked) {
      if (couponLockHintTimerRef.current) {
        clearTimeout(couponLockHintTimerRef.current);
        couponLockHintTimerRef.current = null;
      }
      if (!showCouponLockHint) return;
      const rafId = window.requestAnimationFrame(() => {
        setShowCouponLockHint(false);
      });
      return () => window.cancelAnimationFrame(rafId);
    }
  }, [couponLocked, showCouponLockHint]);

  useEffect(() => {
    return () => {
      if (couponLockHintTimerRef.current) {
        clearTimeout(couponLockHintTimerRef.current);
      }
    };
  }, []);

  return (
    <section className={sectionClass}>
      <h2 className="text-sm font-semibold text-slate-900">5. Payment</h2>
      <p className="mt-1 text-xs text-slate-500">
        Select collection mode and amount details for this booking.
      </p>
      {lockPaymentSection ? (
        <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
          <p className="text-xs font-medium text-slate-700">
            Payment completed. No collection required.
          </p>
        </div>
      ) : (
        <>
          {mode === "edit" ? (
            <div className="mt-3">
              <label className="mb-1 block text-xs font-medium text-slate-700">Collection Type</label>
              <PaymentTypeToggle value={paymentType} onChange={onPaymentTypeChange} />
            </div>
          ) : null}

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
                <option value="ADVANCE">Advance</option>
                <option value={isEditMode ? "REMAINING" : "FULL"}>
                  {isEditMode ? "Remaining" : "Full"}
                </option>
              </select>
              {errors.paymentAmountMode && (
                <p className="mt-1 text-xs text-red-600">{errors.paymentAmountMode}</p>
              )}
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">
                Amount to Collect Now
                {!isEditMode && paymentAmountMode === "ADVANCE" ? (
                  <span className="ml-1 font-normal text-slate-500">
                    (Min ${minimumAdvanceAmount})
                  </span>
                ) : null}
              </label>
              <input
                type="number"
                min={isEditMode ? 0 : minimumAdvanceAmount}
                placeholder="Enter amount to collect"
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

            {paymentType === "OFFLINE" && (
              <>
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
              </>
            )}
          </div>
        </>
      )}

      {mode === "edit" && !lockPaymentSection ? (
        <section className="mt-4 rounded-xl border border-slate-200 bg-white p-3.5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-slate-700">Coupon</p>
            {hasAppliedCoupons && !shouldShowCouponInput ? (
              <button
                type="button"
                onClick={onShowCouponInput}
                className="cursor-pointer text-xs font-semibold text-slate-600 transition hover:text-slate-900"
              >
                Add more
              </button>
            ) : null}
          </div>

          {shouldShowCouponInput ? (
            <div className="relative mt-2">
              <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-2.5 py-2">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-emerald-600 sm:h-8 sm:w-8">
                  <Percent size={13} />
                </div>

                <input
                  value={couponCode}
                  onChange={(event) => {
                    if (couponInputReadOnly) return;
                    onCouponCodeChange(event.target.value);
                  }}
                  onClick={couponInputReadOnly ? triggerCouponLockHint : undefined}
                  onFocus={couponInputReadOnly ? triggerCouponLockHint : undefined}
                  placeholder="Enter coupon code"
                  disabled={couponInputDisabled}
                  readOnly={couponInputReadOnly}
                  aria-disabled={couponInputReadOnly}
                  className="h-11 min-w-0 flex-1 rounded-lg border border-dashed border-emerald-500 bg-white px-3 text-base font-semibold uppercase tracking-[0.08em] text-slate-900 outline-none placeholder:tracking-[0.04em] placeholder:text-slate-400 disabled:cursor-not-allowed disabled:opacity-70 read-only:cursor-not-allowed read-only:bg-slate-50 sm:h-10 sm:text-sm sm:tracking-[0.12em] sm:placeholder:tracking-[0.06em]"
                />

                <button
                  type="button"
                  onClick={onApplyCoupon}
                  disabled={couponInputDisabled || couponInputReadOnly || !couponCode.trim()}
                  className="shrink-0 cursor-pointer rounded-md px-1.5 py-1 text-sm font-bold text-emerald-700 transition hover:bg-emerald-50 hover:text-emerald-800 disabled:cursor-not-allowed disabled:text-slate-400"
                >
                  {couponApplying ? "Applying..." : "Apply"}
                </button>
              </div>

              {couponFeedbackMessage ? (
                <div className="mt-2">
                  <CouponFeedbackCallout
                    tone={couponFeedbackTone}
                    message={couponFeedbackMessage}
                    onDismiss={onDismissCouponFeedback}
                  />
                </div>
              ) : null}
            </div>
          ) : null}

          {couponLocked && couponLockMessage.trim() ? (
            <p
              className={`overflow-hidden text-xs font-medium text-sky-700 transition-all duration-200 ${
                showCouponLockHint
                  ? "mt-1 max-h-10 translate-y-0 opacity-100"
                  : "mt-0 max-h-0 -translate-y-1 opacity-0"
              }`}
            >
              {couponLockMessage}
            </p>
          ) : null}

          {hasAppliedCoupons ? (
            <div className={`${shouldShowCouponInput ? "mt-3" : "mt-2"} space-y-2`}>
              {appliedCoupons.map((coupon) => (
                <div
                  key={coupon.couponId}
                  className="relative overflow-hidden rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-2.5"
                >
                  <span className="absolute -left-2 top-1/2 h-4 w-4 -translate-y-1/2 rounded-full border border-slate-300 bg-white" />
                  <span className="absolute -right-2 top-1/2 h-4 w-4 -translate-y-1/2 rounded-full border border-slate-300 bg-white" />

                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex items-center gap-2">
                      <Tag size={14} className="text-emerald-700" />
                      <p className="truncate text-sm font-semibold text-slate-900">
                        {getCouponDisplayCode(coupon.code)}
                      </p>
                      <p className="shrink-0 rounded-md bg-slate-100 px-2 py-0.5 text-sm font-semibold text-slate-900">
                        (Saved Rs {coupon.discountAmount.toLocaleString()})
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onRemoveCoupon(coupon.code)}
                      className="shrink-0 cursor-pointer text-xs font-medium text-slate-500 transition hover:text-red-700"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}

              {couponDiscount > 0 ? (
                <p className="text-xs font-semibold text-emerald-700">
                  Total saved: Rs {couponDiscount.toLocaleString()}
                </p>
              ) : null}
            </div>
          ) : null}
        </section>
      ) : null}
    </section>
  );
}
