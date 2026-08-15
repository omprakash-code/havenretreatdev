import type { BookingConfirmationEmailProps } from "@/emails/BookingConfirmationEmail";
import {
  BookingEmailDataRow,
  BookingEmailSectionLabel,
  BookingEmailSummaryPanel,
} from "@/emails/components/BookingEmailContent";
import BookingEmailHeader from "@/emails/components/BookingEmailHeader";
import { bookingEmailColors, bookingEmailFonts } from "@/emails/theme/booking-email-colors";
import { resolveBookingEmailTheme } from "@/emails/theme/booking-email-theme";

export type AdminBookingConfirmationEmailProps = BookingConfirmationEmailProps;

const moneyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const resolvedTheme = resolveBookingEmailTheme(process.env.BOOKING_EMAIL_THEME);
const color =
  resolvedTheme === "light"
    ? bookingEmailColors.light
    : bookingEmailColors.admin;
const logoBorder =
  resolvedTheme === "light"
    ? bookingEmailColors.light.logoBorder
    : bookingEmailColors.dark.logoBorder;

function formatMoney(value: number) {
  const amount = Math.max(0, Number(value) || 0);
  return moneyFormatter.format(amount);
}

function formatAddonPrice(value: number) {
  return value === 0 ? "Included" : formatMoney(value);
}

function formatPaymentMethod(method: string) {
  const prefix = method.split(":")[0];
  return prefix.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatPaymentStatus(status: string) {
  const normalized = status.trim().toUpperCase();
  if (normalized === "INITIALIZED" || normalized === "PENDING") {
    return "Awaiting Payment";
  }
  if (normalized === "PAID") return "Paid";
  if (normalized === "OFFLINE") return "Recorded Offline";
  if (normalized === "FAILED") return "Payment Failed";
  if (normalized === "REFUNDED") return "Refunded";
  if (normalized === "MANUAL_REVIEW") return "Manual Review";

  return normalized
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function AdminBookingConfirmationEmail({
  bookingRef,
  customerName,
  customerPhone,
  customerEmail,
  theatreName,
  locationName,
  date,
  timeSlot,
  guestCount,
  occasionLabel,
  occasionDetails = [],
  addonItems = [],
  totalAmount,
  advancePaid,
  remainingPayable,
  paymentType,
  paymentMethod,
  paymentStatus,
  paymentReference,
  paymentRows,
}: AdminBookingConfirmationEmailProps) {
  const isPayLater = advancePaid <= 0 && remainingPayable > 0;

  return (
    <div
      style={{
        margin: 0,
        padding: "32px 12px",
        backgroundColor: color.pageBg,
        fontFamily: bookingEmailFonts.body,
      }}
    >
      <table
        role="presentation"
        cellPadding={0}
        cellSpacing={0}
        style={{
          width: "100%",
          maxWidth: 520,
          margin: "0 auto",
          borderCollapse: "collapse",
          backgroundColor: color.cardBg,
          border: color.borderLine,
          borderRadius: 6,
          overflow: "hidden",
        }}
      >
        <tbody>
          <BookingEmailHeader
            eyebrow="Booking Received"
            title={bookingRef}
            referenceTitle
            backgroundColor="#ffffff"
            logoBorder={logoBorder}
          />

          <tr>
            <td style={{ padding: "12px", color: color.textPrimary, fontSize: 13 }}>
              <BookingEmailSummaryPanel palette={color}>
                <table role="presentation" cellPadding={0} cellSpacing={0} style={{ width: "100%" }}>
                  <tbody>
                    <BookingEmailDataRow
                      label="Booking Ref"
                      value={bookingRef}
                      labelColor={color.textSecondary}
                      valueColor={bookingEmailColors.brandAccent}
                      valueWeight={800}
                    />
                    <BookingEmailDataRow
                      label="Customer"
                      value={customerName?.trim() || "-"}
                      labelColor={color.textSecondary}
                    />
                    <BookingEmailDataRow
                      label="Phone"
                      value={customerPhone?.trim() || "-"}
                      labelColor={color.textSecondary}
                    />
                    {customerEmail ? (
                      <BookingEmailDataRow
                        label="Email"
                        value={customerEmail}
                        labelColor={color.textSecondary}
                      />
                    ) : null}
                    <BookingEmailDataRow
                      label="Package"
                      value={theatreName}
                      labelColor={color.textSecondary}
                    />
                    <BookingEmailDataRow
                      label="Location"
                      value={locationName ?? "-"}
                      labelColor={color.textSecondary}
                    />
                    <BookingEmailDataRow
                      label="Date"
                      value={date}
                      labelColor={color.textSecondary}
                    />
                    <BookingEmailDataRow
                      label="Booking Time"
                      value={timeSlot}
                      labelColor={color.textSecondary}
                    />
                    <BookingEmailDataRow
                      label="Guests"
                      value={guestCount}
                      labelColor={color.textSecondary}
                      last={!occasionLabel}
                    />
                    {occasionLabel ? (
                      <BookingEmailDataRow
                        label="Occasion"
                        value={occasionLabel}
                        labelColor={color.textSecondary}
                        last
                      />
                    ) : null}
                  </tbody>
                </table>
              </BookingEmailSummaryPanel>

              {occasionDetails.length > 0 ? (
                <BookingEmailSummaryPanel palette={color}>
                  <table role="presentation" cellPadding={0} cellSpacing={0} style={{ width: "100%" }}>
                    <tbody>
                      <BookingEmailSectionLabel textColor={color.textSecondary}>
                        Occasion Details
                      </BookingEmailSectionLabel>
                      {occasionDetails.map((detail, index) => (
                        <BookingEmailDataRow
                          key={`${detail.label}-${detail.value}`}
                          label={detail.label}
                          value={detail.value}
                          labelColor={color.textSecondary}
                          last={index === occasionDetails.length - 1}
                        />
                      ))}
                    </tbody>
                  </table>
                </BookingEmailSummaryPanel>
              ) : null}

              {addonItems.length > 0 ? (
                <BookingEmailSummaryPanel palette={color}>
                  <table role="presentation" cellPadding={0} cellSpacing={0} style={{ width: "100%" }}>
                    <tbody>
                      <BookingEmailSectionLabel textColor={color.textSecondary}>
                        Add-ons
                      </BookingEmailSectionLabel>
                      {addonItems.map((item, index) => (
                        <BookingEmailDataRow
                          key={`${item.name}-${item.variantLabel ?? "default"}-${index}`}
                          label={`${item.name}${item.numberValue ? ` (#${item.numberValue})` : ""}${item.variantLabel ? ` - ${item.variantLabel}` : ""} x${item.quantity}${
                            item.includedQuantity && item.includedQuantity > 0
                              ? ` — included: ${item.includedQuantity}${
                                  item.extraQuantity && item.extraQuantity > 0
                                    ? `, ${item.extraQuantity} extra`
                                    : ""
                                }`
                              : ""
                          }`}
                          value={formatAddonPrice(item.totalPrice)}
                          labelColor={color.textSecondary}
                          last={index === addonItems.length - 1}
                        />
                      ))}
                    </tbody>
                  </table>
                </BookingEmailSummaryPanel>
              ) : null}

              <BookingEmailSummaryPanel palette={color}>
                <table role="presentation" cellPadding={0} cellSpacing={0} style={{ width: "100%" }}>
                  <tbody>
                    <BookingEmailSectionLabel textColor={color.textSecondary}>
                      Payment Summary
                    </BookingEmailSectionLabel>
                    {/* The same breakdown the PDF and the customer email show,
                        so the admin sees why a package differs from its list
                        price. Built by buildBookingPaymentRows(). */}
                    {paymentRows && paymentRows.length > 0
                      ? paymentRows.map((row, index) => (
                          <BookingEmailDataRow
                            key={`${row.label}-${index}`}
                            label={row.label}
                            value={row.value}
                            labelColor={color.textSecondary}
                          />
                        ))
                      : (
                          <BookingEmailDataRow
                            label="Total"
                            value={formatMoney(totalAmount)}
                            labelColor={color.textSecondary}
                          />
                        )}
                    {!isPayLater ? (
                      <BookingEmailDataRow
                        label="Paid"
                        value={formatMoney(advancePaid)}
                        labelColor={color.textSecondary}
                      />
                    ) : null}
                    <BookingEmailDataRow
                      label={isPayLater ? "Balance Due" : "Remaining"}
                      value={formatMoney(remainingPayable)}
                      labelColor={color.textSecondary}
                      last={!paymentType && !paymentMethod && !paymentStatus && !paymentReference}
                    />
                    {paymentType ? (
                      <BookingEmailDataRow
                        label="Payment Type"
                        value={paymentType}
                        labelColor={color.textSecondary}
                        last={!paymentMethod && !paymentStatus && !paymentReference}
                      />
                    ) : null}
                    {paymentMethod ? (
                      <BookingEmailDataRow
                        label="Payment Method"
                        value={formatPaymentMethod(paymentMethod)}
                        labelColor={color.textSecondary}
                        last={!paymentStatus && !paymentReference}
                      />
                    ) : null}
                    {paymentStatus ? (
                      <BookingEmailDataRow
                        label="Payment Status"
                        value={formatPaymentStatus(paymentStatus)}
                        labelColor={color.textSecondary}
                        last={!paymentReference}
                      />
                    ) : null}
                    {paymentReference ? (
                      <BookingEmailDataRow
                        label="Reference"
                        value={paymentReference}
                        labelColor={color.textSecondary}
                        last
                      />
                    ) : null}
                  </tbody>
                </table>
              </BookingEmailSummaryPanel>
            </td>
          </tr>

          <tr>
            <td
              style={{
                borderTop: color.borderLine,
                padding: "10px 12px",
                color: color.textSecondary,
                fontSize: 11,
                textAlign: "center",
              }}
            >
              Automated admin booking confirmation notification.
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
