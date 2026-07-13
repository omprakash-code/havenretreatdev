import {
  inputClass,
  sectionClass,
  selectableInputClass,
} from "@/components/admin/bookings/add/shared";

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
  errors,
  onPaymentAmountModeChange,
  onAmountPayNowChange,
  onOfflineMethodChange,
  onOfflineReferenceChange,
}: PaymentModeSectionProps) {
  // The customer pays nothing during booking, so the first payment an admin
  // records is the choice: an advance, or the full amount. Once an advance
  // exists, the only thing left to collect is the balance.
  const hasAdvancePaid = advancePaidAlready > 0;
  const isAdvanceEntryMode = !hasAdvancePaid && paymentAmountMode === "ADVANCE";
  const amountInputDisabled = !isAdvanceEntryMode;
  const amountInputValue = amountPayNow <= 0 ? "" : amountPayNow;

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
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">Amount Type</label>
            <select
              value={paymentAmountMode}
              disabled={disablePaymentAmountMode || hasAdvancePaid}
              onChange={(event) =>
                onPaymentAmountModeChange(
                  event.target.value as "ADVANCE" | "FULL" | "REMAINING"
                )
              }
              className={selectableInputClass}
            >
              {hasAdvancePaid ? (
                <option value="REMAINING">Remaining</option>
              ) : (
                <>
                  <option value="ADVANCE">Advance</option>
                  <option value="FULL">Full</option>
                </>
              )}
            </select>
            {hasAdvancePaid ? (
              <p className="mt-1 text-xs text-slate-500">
                An advance is already recorded, so only the balance is left to
                collect.
              </p>
            ) : null}
            {errors.paymentAmountMode && (
              <p className="mt-1 text-xs text-red-600">{errors.paymentAmountMode}</p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">
              Amount to Collect Now
              {isAdvanceEntryMode ? (
                <span className="ml-1 font-normal text-slate-500">
                  (Min ${minimumAdvanceAmount})
                </span>
              ) : null}
            </label>
            <input
              type="number"
              // An edit may collect nothing at all, so the browser must not block
              // an empty amount there; the form validates a typed advance itself.
              min={mode === "create" && isAdvanceEntryMode ? minimumAdvanceAmount : 0}
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
