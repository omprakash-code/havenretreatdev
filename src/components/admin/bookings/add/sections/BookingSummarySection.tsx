import { formatSlotTime } from "@/lib/formatters";
import { ArrowRight } from "lucide-react";

import {
  toTitleStatus,
  type LocationOption,
  type PricingSummary,
  type SelectedProductSummaryItem,
  type SlotOption,
  type TheatreOption,
} from "@/components/admin/bookings/add/shared";
import {
  formatCurrency,
} from "@/components/admin/bookings/add/sections/bookingSummary.helpers";
import { getNumberDecorationLabel } from "@/lib/product-numbering";

type BookingSummarySectionProps = {
  mode?: "create" | "edit";
  bookingRef?: string | null;
  pendingOnlineBookingRef?: string | null;
  selectedLocation: LocationOption | null;
  locationId: string;
  date: string;
  selectedTheatre: TheatreOption | null;
  theatreId: string;
  selectedSlot: SlotOption | null;
  pricing: PricingSummary | null;
  selectedProductItems: SelectedProductSummaryItem[];
  paymentAmountMode: "ADVANCE" | "FULL" | "REMAINING";
  paymentStatus?:
  | "INITIALIZED"
  | "AWAITING_PAYMENT"
  | "PAID"
  | "FAILED"
  | "CANCELLED"
  | "EXPIRED"
  | "OFFLINE";
  alreadyPaidAmount?: number;
  amountToCollectNow?: number;
  wasInitiallyFullyPaid?: boolean;
  hasPriceImpactingChanges?: boolean;
  guidanceMessage?: string | null;
  isFormReady: boolean;
  submitting: boolean;
  onRemoveSelectedProduct: (selectionKey: string) => void;
};

function SummaryRow({
  label,
  value,
  labelClassName = "text-slate-600",
  valueClassName = "font-medium text-slate-900",
}: {
  label: string;
  value: string;
  labelClassName?: string;
  valueClassName?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className={labelClassName}>{label}</span>
      <span className={`text-right ${valueClassName}`}>{value}</span>
    </div>
  );
}

function formatCurrencySymbol(value: number) {
  return `₹${value.toLocaleString()}`;
}

export function BookingSummarySection({
  mode = "create",
  bookingRef = null,
  pendingOnlineBookingRef = null,
  selectedLocation,
  locationId,
  date,
  selectedTheatre,
  theatreId,
  selectedSlot,
  pricing,
  selectedProductItems,
  paymentAmountMode,
  paymentStatus = "AWAITING_PAYMENT",
  alreadyPaidAmount = 0,
  amountToCollectNow = 0,
  wasInitiallyFullyPaid = false,
  hasPriceImpactingChanges = false,
  guidanceMessage = null,
  isFormReady,
  submitting,
  onRemoveSelectedProduct,
}: BookingSummarySectionProps) {
  const hasLocation = Boolean(locationId);
  const hasDate = Boolean(date);
  const hasTheatre = Boolean(theatreId);
  const hasSlot = Boolean(selectedSlot);
  const selectedSlotLabel = selectedSlot
    ? `${formatSlotTime(selectedSlot.startTime, selectedSlot.endTime)} (${selectedSlot.statusLabel || toTitleStatus(selectedSlot.status)})`
    : "";

  const slotAmount = pricing?.baseAmount ?? selectedSlot?.finalPrice ?? 0;
  const decorationAmount = pricing?.decorationAmount ?? 0;
  const productsAmount = pricing?.productsAmount ?? 0;
  const extrasAmount = pricing?.extrasAmount ?? 0;
  const discountAmount = pricing?.discountAmount ?? 0;
  const totalAmount = pricing?.totalAmount ?? 0;
  const subtotalAmount = slotAmount + decorationAmount + extrasAmount + productsAmount;
  const paidAmount = Math.max(alreadyPaidAmount, 0);
  const outstandingAmount = Math.max(totalAmount - paidAmount, 0);
  const payNowAmount =
    paymentAmountMode === "FULL" || paymentAmountMode === "REMAINING"
      ? totalAmount
      : pricing?.advancePaid ?? 0;
  const remainingAmount = pricing?.remainingPayable ?? 0;
  const collectNowAmount = Math.max(amountToCollectNow, 0);
  const hasEditPaidAmount = mode === "edit" && paidAmount > 0;
  const isFullyPaidSnapshot = mode === "edit" && paidAmount >= totalAmount;
  const shouldUsePaidAmountLabel =
    mode === "edit" && (isFullyPaidSnapshot || wasInitiallyFullyPaid);

  const isEditPaidPartial =
    mode === "edit" && paymentStatus === "PAID" && remainingAmount > 0;
  const showRemainingAmount =
    (paymentAmountMode !== "FULL" && paymentAmountMode !== "REMAINING" || isEditPaidPartial) &&
    remainingAmount > 0;
  const payNowLabel = isEditPaidPartial
    ? "Advance Paid"
    : paymentAmountMode === "FULL"
      ? "Amount Payable Now"
      : "Advance (Pay Now)";
  const createCollectAmount = Math.max(payNowAmount, 0);
  const collectNowDisplayAmount =
    mode === "edit" && paymentAmountMode === "REMAINING"
      ? Math.max(totalAmount - Math.max(alreadyPaidAmount, 0), 0)
      : collectNowAmount;
  const createCtaLabel =
    pendingOnlineBookingRef
      ? `Retry Payment (${pendingOnlineBookingRef})`
      : createCollectAmount > 0
      ? `Collect ${formatCurrencySymbol(createCollectAmount)} & Create Booking`
      : "Create Booking";
  const editCtaLabel =
    collectNowDisplayAmount > 0
      ? paymentAmountMode === "REMAINING"
        ? `Collect ${formatCurrencySymbol(collectNowDisplayAmount)} & Update`
        : `Collect ${formatCurrencySymbol(collectNowDisplayAmount)} & Update`
      : "Update Booking";

  return (
    <aside className="lg:sticky lg:top-0 lg:self-start">
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-900">Booking Summary</h2>
        <p className="mt-1 text-xs text-slate-500">Review booking details before submit.</p>

        <div className="mt-4 space-y-2 text-sm">
          {mode === "edit" && bookingRef ? (
            <SummaryRow label="Booking Ref" value={bookingRef} />
          ) : null}

          {hasLocation ? (
            <SummaryRow label="Location" value={selectedLocation?.name ?? "Selected"} />
          ) : null}
          {hasLocation && hasDate ? <SummaryRow label="Date" value={date} /> : null}
          {hasLocation && hasDate && hasTheatre ? (
            <SummaryRow label="Theatre" value={selectedTheatre?.name ?? "Selected"} />
          ) : null}
          {hasLocation && hasDate && hasTheatre && hasSlot ? (
            <SummaryRow label="Slot" value={selectedSlotLabel} />
          ) : null}

          {guidanceMessage ? (
            <div className="mt-1 flex items-center gap-1.5 text-sm font-medium text-amber-700">
              <ArrowRight size={14} className="shrink-0" />
              <p>{guidanceMessage}</p>
            </div>
          ) : null}

          {hasSlot ? (
            <>
              <div className="my-3 border-t border-slate-200" />

              <SummaryRow label="Slot price" value={formatCurrency(slotAmount)} />

              {decorationAmount > 0 ? (
                <SummaryRow
                  label="Decoration price"
                  value={formatCurrency(decorationAmount)}
                />
              ) : null}

              {extrasAmount > 0 ? (
                <SummaryRow label="Extra guests" value={formatCurrency(extrasAmount)} />
              ) : null}

              {selectedProductItems.length > 0 ? (
                <div className="rounded-md border border-slate-200 bg-slate-50 p-2">
                  <p className="mb-1 text-xs font-semibold text-slate-700">Selected products</p>
                  <div className="space-y-1.5">
                    {selectedProductItems.map((item) => (
                      <div key={item.key} className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-xs font-medium text-slate-900">
                            {item.productName} ({item.variantLabel}) x{item.quantity}
                          </p>
                          {item.ledNumber ? (
                            <p className="text-[11px] text-slate-500">
                              {getNumberDecorationLabel({
                                slug: undefined,
                                name: item.productName,
                              })}
                              : {item.ledNumber}
                            </p>
                          ) : null}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-slate-800">
                            {formatCurrency(item.totalPrice)}
                          </span>
                          <button
                            type="button"
                            onClick={() => onRemoveSelectedProduct(item.key)}
                            className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-slate-300 text-[11px] font-semibold text-slate-600 hover:bg-slate-100"
                            aria-label="Remove product"
                            title="Remove product"
                          >
                            x
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-2 border-t border-slate-200 pt-2">
                    <SummaryRow
                      label="Products total"
                      value={formatCurrency(productsAmount)}
                      valueClassName="text-xs font-semibold text-slate-900"
                    />
                  </div>
                </div>
              ) : null}

              {discountAmount > 0 ? (
                <>
                  <SummaryRow label="Subtotal" value={formatCurrency(subtotalAmount)} />
                  <SummaryRow
                    label="Discount"
                    value={`- ${formatCurrency(discountAmount)}`}
                    valueClassName="font-semibold text-emerald-700"
                  />
                </>
              ) : null}

              <SummaryRow
                label={discountAmount > 0 ? "Final Total" : "Total"}
                value={formatCurrency(totalAmount)}
                valueClassName="text-base font-semibold text-slate-900"
              />

              <div className="mt-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                {mode === "edit" ? (
                  <>
                    {hasEditPaidAmount ? (
                      <SummaryRow
                        label={shouldUsePaidAmountLabel ? "Paid Amount" : "Advance Paid"}
                        value={formatCurrency(paidAmount)}
                        labelClassName="font-medium text-emerald-700"
                        valueClassName="text-sm font-bold text-emerald-700"
                      />
                    ) : null}
                    {outstandingAmount > 0 ? (
                      <div className={hasEditPaidAmount ? "mt-1 border-t border-slate-200 pt-1" : ""}>
                        <SummaryRow
                          label="Remaining to Collect"
                          value={formatCurrency(outstandingAmount)}
                          valueClassName="text-sm font-semibold text-slate-900"
                        />
                      </div>
                    ) : null}
                  </>
                ) : (
                  <>
                    <SummaryRow
                      label={payNowLabel}
                      value={formatCurrency(payNowAmount)}
                      valueClassName="text-sm font-bold text-slate-900"
                    />
                    {showRemainingAmount ? (
                      <div className="mt-1 border-t border-slate-200 pt-1">
                        <SummaryRow
                          label="Remaining amount"
                          value={formatCurrency(remainingAmount)}
                          valueClassName="text-sm font-semibold text-slate-900"
                        />
                      </div>
                    ) : null}
                  </>
                )}
              </div>
            </>
          ) : null}
        </div>

        <button
          type="submit"
          disabled={!isFormReady || submitting}
          className="mt-5 w-full rounded-md bg-neutral-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {submitting
            ? mode === "edit"
              ? "Updating..."
              : "Creating..."
            : mode === "edit"
              ? hasPriceImpactingChanges || collectNowDisplayAmount > 0
                ? editCtaLabel
                : "Update Booking"
              : createCtaLabel}
        </button>
      </div>
    </aside>
  );
}
