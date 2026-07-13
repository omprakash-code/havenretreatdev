import { formatSlotTime } from "@/lib/formatters";
import { calculateDurationHours } from "@/lib/booking-time-range";
import { ArrowRight } from "lucide-react";

import {
  type LocationOption,
  type PricingSummary,
  type SelectedProductSummaryItem,
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
  startTime?: string | null;
  endTime?: string | null;
  includedDurationHours?: number;
  extraHourlyRate?: number;
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
  return `$${value.toLocaleString()}`;
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
  startTime = null,
  endTime = null,
  includedDurationHours = 4,
  extraHourlyRate = 0,
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
  const hasTimeRange = Boolean(startTime && endTime);
  const effectiveStart = startTime;
  const effectiveEnd = endTime;
  const durationHours = calculateDurationHours(effectiveStart, effectiveEnd) ?? 0;
  const extraDurationHours = Math.max(durationHours - includedDurationHours, 0);
  const extraHoursCharge = Math.round(extraDurationHours * extraHourlyRate);
  const showDurationBreakdown = hasTimeRange && durationHours > 0;

  const selectedTimeRangeLabel = hasTimeRange
    ? formatSlotTime(startTime!, endTime!)
    : "";

  const packageAmount =
    pricing?.packageBaseAmount ??
    selectedTheatre?.basePrice ??
    0;
  const billedExtraHoursAmount =
    pricing?.extraHoursAmount ?? extraHoursCharge;
  const slotAmount =
    pricing?.baseAmount ?? packageAmount + billedExtraHoursAmount;
  const decorationAmount = pricing?.decorationAmount ?? 0;
  const productsAmount = pricing?.productsAmount ?? 0;
  const extrasAmount = pricing?.extrasAmount ?? 0;
  const discountAmount = pricing?.discountAmount ?? 0;
  const totalAmount = pricing?.totalAmount ?? 0;
  const subtotalAmount = slotAmount + decorationAmount + extrasAmount + productsAmount;
  const paidAmount = Math.max(alreadyPaidAmount, 0);
  const payNowAmount =
    paymentAmountMode === "FULL" || paymentAmountMode === "REMAINING"
      ? totalAmount
      : pricing?.advancePaid ?? 0;
  const remainingAmount = pricing?.remainingPayable ?? 0;
  const collectNowAmount = Math.max(amountToCollectNow, 0);
  // What the booking still owes once this update collects its amount, so typing
  // an advance moves the balance immediately.
  const remainingAfterCollection = Math.max(
    totalAmount - paidAmount - collectNowAmount,
    0
  );
  /** This update settles the booking: what is collected leaves nothing owing. */
  const clearsFullBalance =
    mode === "edit" &&
    totalAmount > 0 &&
    collectNowAmount > 0 &&
    remainingAfterCollection === 0;
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
      ? clearsFullBalance
        ? `Collect Full ${formatCurrencySymbol(collectNowDisplayAmount)} & Update`
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
            <SummaryRow label="Package" value={selectedTheatre?.name ?? "Selected"} />
          ) : null}
          {hasLocation && hasDate && hasTheatre && hasTimeRange ? (
            <SummaryRow label="Time" value={selectedTimeRangeLabel} />
          ) : null}

          {showDurationBreakdown ? (
            <div className="rounded-md border border-slate-100 bg-slate-50 px-2.5 py-2 text-xs text-slate-600 space-y-0.5">
              <div className="flex justify-between">
                <span>Duration</span>
                <span className="font-medium text-slate-800">
                  {durationHours % 1 === 0 ? durationHours : durationHours.toFixed(1)} hrs
                </span>
              </div>
              <div className="flex justify-between">
                <span>Included in package</span>
                <span className="font-medium text-slate-800">{includedDurationHours} hrs</span>
              </div>
              {extraDurationHours > 0 ? (
                <div className="flex justify-between border-t border-slate-200 pt-0.5 mt-0.5">
                  <span className="text-amber-700 font-medium">
                    +{extraDurationHours % 1 === 0 ? extraDurationHours : extraDurationHours.toFixed(1)} extra hrs
                    {extraHourlyRate > 0 ? ` · $${extraHourlyRate}/hr` : ""}
                  </span>
                  {extraHoursCharge > 0 ? (
                    <span className="font-semibold text-amber-700">{formatCurrency(extraHoursCharge)}</span>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}

          {guidanceMessage ? (
            <div className="mt-1 flex items-center gap-1.5 text-sm font-medium text-amber-700">
              <ArrowRight size={14} className="shrink-0" />
              <p>{guidanceMessage}</p>
            </div>
          ) : null}

          {hasTimeRange && pricing ? (
            <>
              <div className="my-3 border-t border-slate-200" />

              <SummaryRow
                label="Package price"
                value={formatCurrency(packageAmount)}
              />

              {billedExtraHoursAmount > 0 ? (
                <SummaryRow
                  label="Extra hours"
                  value={formatCurrency(billedExtraHoursAmount)}
                  valueClassName="font-semibold text-amber-700"
                />
              ) : null}

              {decorationAmount > 0 ? (
                <SummaryRow
                  label="Decoration price"
                  value={formatCurrency(decorationAmount)}
                />
              ) : null}

              {selectedProductItems.length > 0 ? (
                <div className="rounded-md border border-slate-200 bg-slate-50 p-2">
                  <p className="mb-1 text-xs font-semibold text-slate-700">Selected products</p>
                  <div className="space-y-1.5">
                    {selectedProductItems.map((item) => (
                      <div key={item.key} className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-xs font-medium text-slate-900">
                            {item.includedQuantity > 0
                              ? `${item.quantity} ${item.productName.toLowerCase()}`
                              : item.quantity > 1
                                ? `${item.quantity}× ${item.productName}`
                                : item.productName}
                          </p>
                          {item.includedQuantity > 0 && item.extraQuantity > 0 ? (
                            <p className="text-[11px] text-slate-500">
                              {item.extraQuantity} extra × {formatCurrency(item.unitPrice)}
                            </p>
                          ) : null}
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
                            {item.totalPrice > 0 ? (
                              formatCurrency(item.totalPrice)
                            ) : (
                              <span className="font-semibold text-emerald-700">
                                Included
                              </span>
                            )}
                          </span>
                          {item.includedQuantity === 0 || item.extraQuantity > 0 ? (
                            <button
                              type="button"
                              onClick={() => onRemoveSelectedProduct(item.key)}
                              className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-slate-300 text-[11px] font-semibold text-slate-600 hover:bg-slate-100"
                              aria-label={
                                item.includedQuantity > 0
                                  ? "Remove extra quantity"
                                  : "Remove product"
                              }
                              title={
                                item.includedQuantity > 0
                                  ? "Remove extras"
                                  : "Remove product"
                              }
                            >
                              x
                            </button>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>

                  {productsAmount > 0 ? (
                    <div className="mt-2 border-t border-slate-200 pt-2">
                      <SummaryRow
                        label="Products total"
                        value={formatCurrency(productsAmount)}
                        valueClassName="text-xs font-semibold text-slate-900"
                      />
                    </div>
                  ) : null}
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
                    {collectNowAmount > 0 ? (
                      <div className={hasEditPaidAmount ? "mt-1" : ""}>
                        <SummaryRow
                          label={
                            clearsFullBalance ? "Collecting Full Amount" : "Collecting Now"
                          }
                          value={formatCurrency(collectNowAmount)}
                          valueClassName="text-sm font-semibold text-slate-900"
                        />
                      </div>
                    ) : null}
                    {clearsFullBalance ? (
                      // Nothing is left to owe, so a "$0" balance row would only
                      // add a number to read. Say what the update actually does.
                      <div className="mt-1 border-t border-slate-200 pt-1">
                        <p className="text-xs font-medium text-emerald-700">
                          Booking will be fully paid. No balance left to collect.
                        </p>
                      </div>
                    ) : remainingAfterCollection > 0 ? (
                      <div
                        className={
                          hasEditPaidAmount || collectNowAmount > 0
                            ? "mt-1 border-t border-slate-200 pt-1"
                            : ""
                        }
                      >
                        <SummaryRow
                          // Balance left on the booking after this update, so an
                          // advance typed above is already subtracted here.
                          label={
                            hasEditPaidAmount || collectNowAmount > 0
                              ? "Remaining Balance"
                              : "Remaining to Collect"
                          }
                          value={formatCurrency(remainingAfterCollection)}
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
