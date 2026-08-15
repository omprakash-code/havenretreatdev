// The booking payment summary, as rows.
//
// One builder shared by the PDF receipt, the customer confirmation email and
// the admin notification email, so those surfaces cannot drift from each other
// or from the Booking Summary. It performs NO pricing arithmetic beyond
// presentation: every amount is taken from the booking as already calculated by
// calculateBookingPricing(), and the only derived figures are the two the rows
// themselves need (the pre-discount subtotal and the per-hour rate label).
//
// This module deliberately has no PDF, React or Prisma dependencies so it can be
// imported from a server email service and a browser PDF builder alike.

export type PaymentSummaryRowTone = "normal" | "strong" | "success" | "muted";

export type PaymentSummaryRow = {
  label: string;
  value: string;
  tone?: PaymentSummaryRowTone;
};

export type PaymentSummaryItem = {
  productName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  /** Quantity the package covers. Charged lines are those ABOVE it. */
  includedQuantity?: number | null;
  /** Quantity actually billed. Derived from totalPrice when absent. */
  extraQuantity?: number | null;
};

export type PaymentSummaryInput = {
  /** Package price AFTER any included-item reduction. */
  packageAmount?: number | null;
  /** Package price as listed, before any reduction. */
  packageListAmount?: number | null;
  /** Credit for included items reduced below the package quantity. */
  packageAdjustmentAmount?: number | null;
  extraDurationAmount?: number | null;
  extraDurationHours?: number | null;
  decorationAmount?: number | null;
  additionalChargeAmount?: number | null;
  additionalChargeReason?: string | null;
  discountAmount?: number | null;
  totalAmount: number;
  items?: PaymentSummaryItem[];
};

export function formatPaymentAmount(value: number): string {
  const amount = Number(value) || 0;
  return `$${amount.toLocaleString("en-US", {
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatPaymentHours(hours: number): string {
  return Number.isInteger(hours) ? `${hours}h` : `${hours.toFixed(1)}h`;
}

/** Collapses newlines and runs of whitespace so a label stays on one line. */
export function sanitizePaymentLabel(value: string): string {
  return String(value || "")
    .replace(/[\r\n]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Quantity a line is actually billed for. Prefers the stored extra quantity and
 * falls back to what the charged total implies, for records that predate it.
 */
export function resolveChargedQuantity(item: PaymentSummaryItem): number {
  if (item.extraQuantity !== null && item.extraQuantity !== undefined) {
    return item.extraQuantity;
  }
  if (item.unitPrice > 0) {
    return Math.max(Math.round(item.totalPrice / item.unitPrice), 1);
  }
  return item.quantity;
}

function isChargedLine(item: PaymentSummaryItem): boolean {
  return item.extraQuantity !== null && item.extraQuantity !== undefined
    ? item.extraQuantity > 0
    : item.totalPrice > 0;
}

/**
 * The pricing breakdown, ending at the total. Surfaces that also report payment
 * state (the PDF receipt) append their own rows after these.
 *
 * When included items have been reduced, the PUBLISHED package price is shown
 * with the reduction as its own line, so the rows still sum to the same base and
 * the recipient can see why the package is below its usual price.
 */
export function buildBookingPaymentRows(
  input: PaymentSummaryInput
): PaymentSummaryRow[] {
  const rows: PaymentSummaryRow[] = [];

  const discountAmount = input.discountAmount ?? 0;
  const showDiscountBreakdown = discountAmount > 0;
  const subtotalBeforeDiscount = input.totalAmount + discountAmount;

  const packageAdjustmentAmount = input.packageAdjustmentAmount ?? 0;
  const packageAmount =
    packageAdjustmentAmount > 0
      ? input.packageListAmount ?? input.packageAmount ?? 0
      : input.packageAmount ?? 0;

  if (packageAmount > 0) {
    rows.push({ label: "Package", value: formatPaymentAmount(packageAmount) });
  }

  if (packageAdjustmentAmount > 0) {
    rows.push({
      label: "Included Items Reduced",
      value: `- ${formatPaymentAmount(packageAdjustmentAmount)}`,
    });
  }

  const extraDurationAmount = input.extraDurationAmount ?? 0;
  const extraDurationHours = input.extraDurationHours ?? 0;
  if (extraDurationAmount > 0) {
    const rateLabel =
      extraDurationHours > 0
        ? ` (${formatPaymentHours(extraDurationHours)} × ${formatPaymentAmount(
            Math.round(extraDurationAmount / extraDurationHours)
          )}/hr)`
        : "";
    rows.push({
      label: `Extra Hours${rateLabel}`,
      value: formatPaymentAmount(extraDurationAmount),
    });
  }

  const decorationAmount = input.decorationAmount ?? 0;
  if (decorationAmount > 0) {
    rows.push({
      label: "Decoration",
      value: formatPaymentAmount(decorationAmount),
    });
  }

  (input.items ?? []).filter(isChargedLine).forEach((item) => {
    rows.push({
      label: `${sanitizePaymentLabel(item.productName)} (${resolveChargedQuantity(
        item
      )} × ${formatPaymentAmount(item.unitPrice)})`,
      value: formatPaymentAmount(item.totalPrice),
    });
  });

  const additionalChargeAmount = input.additionalChargeAmount ?? 0;
  if (additionalChargeAmount > 0) {
    rows.push({
      label: input.additionalChargeReason
        ? `Additional Charge (${sanitizePaymentLabel(
            input.additionalChargeReason
          )})`
        : "Additional Charge",
      value: formatPaymentAmount(additionalChargeAmount),
    });
  }

  if (showDiscountBreakdown) {
    rows.push({
      label: "Subtotal (Before Discount)",
      value: formatPaymentAmount(subtotalBeforeDiscount),
    });
    rows.push({
      label: "Discount",
      value: `-${formatPaymentAmount(discountAmount)}`,
      tone: "success",
    });
  }

  rows.push({
    label: showDiscountBreakdown
      ? "Final Total (After Discount)"
      : "Total Amount",
    value: formatPaymentAmount(input.totalAmount),
    tone: "strong",
  });

  return rows;
}
