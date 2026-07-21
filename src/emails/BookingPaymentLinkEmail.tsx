import BookingEmailHeader from "@/emails/components/BookingEmailHeader";
import {
  BookingEmailCenteredActionButton,
  BookingEmailDataRow,
  BookingEmailSummaryPanel,
} from "@/emails/components/BookingEmailContent";
import { bookingEmailColors, bookingEmailFonts } from "@/emails/theme/booking-email-colors";
import { resolveBookingEmailTheme } from "@/emails/theme/booking-email-theme";

export type BookingPaymentLinkEmailProps = {
  bookingRef: string;
  customerName?: string;
  amountDue: number;
  currency?: string;
  paymentLinkUrl: string;
};

function formatMoney(value: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Math.max(0, Number(value) || 0));
  } catch {
    return `${currency} ${Math.max(0, Number(value) || 0).toFixed(2)}`;
  }
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

export default function BookingPaymentLinkEmail({
  bookingRef,
  customerName,
  amountDue,
  currency = "USD",
  paymentLinkUrl,
}: BookingPaymentLinkEmailProps) {
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
            title="Complete Your Payment"
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
                There is a balance due on your Haven Retreat booking. Please use
                the secure payment link below to complete your payment.
              </p>
              <p style={{ margin: "0 0 14px", color: color.textMuted }}>
                Your booking is confirmed once the payment is received.
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
                      label="Amount Due"
                      value={formatMoney(amountDue, currency)}
                      labelColor={color.textSecondary}
                      last
                    />
                  </tbody>
                </table>
              </BookingEmailSummaryPanel>

              <BookingEmailCenteredActionButton
                href={paymentLinkUrl}
                label="Pay Now"
                backgroundColor={bookingEmailColors.brandAccent}
                textColor={accentTextColor}
              />

              <p style={{ margin: "14px 0 0", fontSize: 11, color: color.textSecondary }}>
                If the button does not work, copy and paste this link into your
                browser:
                <br />
                {paymentLinkUrl}
              </p>
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
              Secure payment powered by Square · Haven Retreat.
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
