import BookingEmailHeader from "@/emails/components/BookingEmailHeader";
import {
  BookingEmailCenteredActionButton,
  BookingEmailDataRow,
  BookingEmailSectionLabel,
  BookingEmailSummaryPanel,
} from "@/emails/components/BookingEmailContent";
import type {
  BookingConfirmationAddonItem,
  BookingConfirmationDetail,
} from "@/emails/BookingConfirmationEmail";
import { bookingEmailColors, bookingEmailFonts } from "@/emails/theme/booking-email-colors";
import { resolveBookingEmailTheme } from "@/emails/theme/booking-email-theme";

export type UserPaymentReceivedBookingFailedEmailProps = {
  bookingRef: string;
  customerName?: string;
  theatreName: string;
  locationName?: string;
  date: string;
  timeSlot: string;
  guestCount: number;
  amountPaid: number;
  paymentReference?: string;
  restartUrl: string;
  occasionLabel?: string;
  occasionDetails?: BookingConfirmationDetail[];
  addonItems?: BookingConfirmationAddonItem[];
};

const moneyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatMoney(value: number) {
  const amount = Math.max(0, Number(value) || 0);
  return moneyFormatter.format(amount);
}

const resolvedTheme = resolveBookingEmailTheme(process.env.BOOKING_EMAIL_THEME);
const color =
  resolvedTheme === "light"
    ? bookingEmailColors.light
    : bookingEmailColors.dark;
const accentTextColor = bookingEmailColors.dark.textStrong;
const bodyTextColor =
  resolvedTheme === "light"
    ? bookingEmailColors.light.textPrimary
    : bookingEmailColors.dark.textSubtle;
const logoBorder =
  resolvedTheme === "light"
    ? bookingEmailColors.light.logoBorder
    : bookingEmailColors.dark.logoBorder;

export default function UserPaymentReceivedBookingFailedEmail({
  bookingRef,
  customerName,
  theatreName,
  locationName,
  date,
  timeSlot,
  guestCount,
  amountPaid,
  paymentReference,
  restartUrl,
  occasionLabel,
  occasionDetails = [],
  addonItems = [],
}: UserPaymentReceivedBookingFailedEmailProps) {
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
            eyebrow="Haven Retreat"
            title="Payment Received, Booking Not Confirmed"
            backgroundColor="#ffffff"
            textColor={accentTextColor}
            logoBorder={logoBorder}
          />

          <tr>
            <td
              style={{
                padding: "12px",
                color: bodyTextColor,
                fontSize: 14,
                lineHeight: 1.6,
              }}
            >
              <p style={{ margin: "0 0 10px" }}>
                {customerName?.trim() ? `Hi ${customerName.trim()},` : "Hi,"}
              </p>
              <p style={{ margin: "0 0 10px" }}>
                We received your payment, but this booking could not be confirmed.
              </p>
              <p style={{ margin: "0 0 14px", color: color.textMuted }}>
                Our team will process the refund shortly. You can restart booking right away if you want another booking time.
              </p>

              <BookingEmailSummaryPanel palette={color}>
                <table role="presentation" cellPadding={0} cellSpacing={0} style={{ width: "100%" }}>
                  <tbody>
                    <BookingEmailDataRow
                      label="Booking Ref"
                      value={bookingRef}
                      labelColor={color.textSecondary}
                      valueColor={bookingEmailColors.brandAccent}
                      valueWeight={700}
                    />
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
                      label="Time"
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

              <BookingEmailCenteredActionButton
                href={restartUrl}
                label="Restart Booking"
                backgroundColor={bookingEmailColors.brandAccent}
                textColor={accentTextColor}
              />
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
              Automated payment update from Haven Retreat.
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
