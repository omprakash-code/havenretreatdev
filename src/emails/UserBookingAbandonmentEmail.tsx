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
import { bookingEmailColors } from "@/emails/theme/booking-email-colors";
import { resolveBookingEmailTheme } from "@/emails/theme/booking-email-theme";

export type UserBookingAbandonmentEmailProps = {
  bookingRef: string;
  customerName?: string;
  theatreName: string;
  locationName?: string;
  date: string;
  timeSlot: string;
  guestCount: number;
  resumeUrl: string;
  cancelledReason?: string;
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

export default function UserBookingAbandonmentEmail({
  bookingRef,
  customerName,
  theatreName,
  locationName,
  date,
  timeSlot,
  guestCount,
  resumeUrl,
  cancelledReason,
  occasionLabel,
  occasionDetails = [],
  addonItems = [],
}: UserBookingAbandonmentEmailProps) {
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
  const isPaymentDropoff =
    cancelledReason === "PAYMENT_CHECKOUT_ABANDONED" ||
    cancelledReason === "PAYMENT_STEP_ABANDONED";
  const emailTitle = isPaymentDropoff
    ? "Payment Not Completed"
    : "Booking Not Completed";
  const primaryMessage = isPaymentDropoff
    ? "We could not complete your booking because the payment step was not finished. The earlier reservation has been released."
    : "Your booking session ended before confirmation, so the selected booking time has been released.";
  const secondaryMessage = isPaymentDropoff
    ? "If you still want to book, please start again and choose any available booking time."
    : "You can start again anytime and complete your booking in a few quick steps.";
  const ctaLabel = isPaymentDropoff ? "Start New Booking" : "Continue Booking";

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
            eyebrow="Haven Retreat"
            title={emailTitle}
            backgroundColor={bookingEmailColors.brandAccent}
            textColor={accentTextColor}
            logoBorder={logoBorder}
          />

          <tr>
            <td
              style={{
                padding: "12px",
                color: bodyTextColor,
                fontSize: 14,
                lineHeight: 1.5,
              }}
            >
              <p style={{ margin: "0 0 10px" }}>
                {customerName?.trim() ? `Hi ${customerName.trim()},` : "Hi,"}
              </p>
              <p style={{ margin: "0 0 10px" }}>{primaryMessage}</p>
              <p style={{ margin: "0 0 14px", color: color.textMuted, fontSize: 13 }}>
                {secondaryMessage}
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
                href={resumeUrl}
                label={ctaLabel}
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
              Automated booking status update from Haven Retreat.
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
