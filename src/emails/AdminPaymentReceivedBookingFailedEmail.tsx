import BookingEmailHeader from "@/emails/components/BookingEmailHeader";
import {
  BookingEmailDataRow,
  BookingEmailSectionLabel,
  BookingEmailSummaryPanel,
} from "@/emails/components/BookingEmailContent";
import type {
  BookingConfirmationAddonItem,
  BookingConfirmationDetail,
} from "@/emails/BookingConfirmationEmail";
import { bookingEmailColors } from "@/emails/theme/booking-email-colors";
import { resolveBookingEmailTheme } from "@/emails/theme/booking-email-theme";

export type AdminPaymentReceivedBookingFailedEmailProps = {
  bookingRef: string;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  theatreName: string;
  locationName?: string;
  date: string;
  timeSlot: string;
  guestCount: number;
  amountPaid: number;
  paymentReference?: string;
  failureReason: string;
  occasionLabel?: string;
  occasionDetails?: BookingConfirmationDetail[];
  addonItems?: BookingConfirmationAddonItem[];
};

const moneyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

function formatMoney(value: number) {
  return moneyFormatter.format(Math.max(0, Math.trunc(value || 0)));
}

const resolvedTheme = resolveBookingEmailTheme(process.env.BOOKING_EMAIL_THEME);
const color =
  resolvedTheme === "light"
    ? bookingEmailColors.light
    : bookingEmailColors.admin;
const dangerHeaderText = "#ffffff";
const failureReferenceText = resolvedTheme === "light" ? "#b91c1c" : "#FCA5A5";
const logoBorder =
  resolvedTheme === "light"
    ? bookingEmailColors.light.logoBorder
    : bookingEmailColors.dark.logoBorder;

export default function AdminPaymentReceivedBookingFailedEmail({
  bookingRef,
  customerName,
  customerPhone,
  customerEmail,
  theatreName,
  locationName,
  date,
  timeSlot,
  guestCount,
  amountPaid,
  paymentReference,
  failureReason,
  occasionLabel,
  occasionDetails = [],
  addonItems = [],
}: AdminPaymentReceivedBookingFailedEmailProps) {
  return (
    <div
      style={{
        margin: 0,
        padding: "12px",
        backgroundColor: color.pageBg,
        fontFamily: "'Courier New', Courier, monospace",
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
            eyebrow="Operations Update"
            title="Payment Captured, Booking Failed"
            backgroundColor="#ef4444"
            textColor={dangerHeaderText}
            logoBorder={logoBorder}
            fallbackBackgroundColor={dangerHeaderText}
            fallbackTextColor="#ef4444"
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
                      valueColor={failureReferenceText}
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
                      label="Venue"
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
                      label="Time Slot"
                      value={timeSlot}
                      labelColor={color.textSecondary}
                    />
                    <BookingEmailDataRow
                      label="Guests"
                      value={guestCount}
                      labelColor={color.textSecondary}
                    />
                    <BookingEmailDataRow
                      label="Amount Received"
                      value={formatMoney(amountPaid)}
                      labelColor={color.textSecondary}
                    />
                    <BookingEmailDataRow
                      label="Payment Reference"
                      value={paymentReference ?? "-"}
                      labelColor={color.textSecondary}
                    />
                    <BookingEmailDataRow
                      label="Failure Reason"
                      value={failureReason}
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
                          label={`${item.name}${item.numberValue ? ` (#${item.numberValue})` : ""}${item.variantLabel ? ` - ${item.variantLabel}` : ""} x${item.quantity}`}
                          value={formatMoney(item.totalPrice)}
                          labelColor={color.textSecondary}
                          last={index === addonItems.length - 1}
                        />
                      ))}
                    </tbody>
                  </table>
                </BookingEmailSummaryPanel>
              ) : null}
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
              Manual refund follow-up required.
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
