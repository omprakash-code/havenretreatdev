import type { BookingConfirmationEmailProps } from "@/emails/BookingConfirmationEmail";
import {
  BookingEmailDataRow,
  BookingEmailSectionLabel,
  BookingEmailSummaryPanel,
} from "@/emails/components/BookingEmailContent";
import BookingEmailHeader from "@/emails/components/BookingEmailHeader";
import { bookingEmailColors } from "@/emails/theme/booking-email-colors";
import { resolveBookingEmailTheme } from "@/emails/theme/booking-email-theme";

export type AdminBookingConfirmationEmailProps = BookingConfirmationEmailProps & {
  confirmationSource?: string;
};

const moneyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

const resolvedTheme = resolveBookingEmailTheme(process.env.BOOKING_EMAIL_THEME);
const color =
  resolvedTheme === "light"
    ? bookingEmailColors.light
    : bookingEmailColors.admin;
const accentTextColor = bookingEmailColors.dark.textStrong;
const logoBorder =
  resolvedTheme === "light"
    ? bookingEmailColors.light.logoBorder
    : bookingEmailColors.dark.logoBorder;

function formatMoney(value: number) {
  return moneyFormatter.format(Math.max(0, Math.trunc(value || 0)));
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
  confirmationSource,
}: AdminBookingConfirmationEmailProps) {
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
            eyebrow="New Booking"
            title="Booking Confirmed"
            backgroundColor={bookingEmailColors.brandAccent}
            textColor={accentTextColor}
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

              <BookingEmailSummaryPanel palette={color}>
                <table role="presentation" cellPadding={0} cellSpacing={0} style={{ width: "100%" }}>
                  <tbody>
                    <BookingEmailSectionLabel textColor={color.textSecondary}>
                      Payment Summary
                    </BookingEmailSectionLabel>
                    <BookingEmailDataRow
                      label="Total"
                      value={formatMoney(totalAmount)}
                      labelColor={color.textSecondary}
                    />
                    <BookingEmailDataRow
                      label="Paid"
                      value={formatMoney(advancePaid)}
                      labelColor={color.textSecondary}
                    />
                    <BookingEmailDataRow
                      label="Remaining"
                      value={formatMoney(remainingPayable)}
                      labelColor={color.textSecondary}
                      last={!paymentType && !paymentMethod && !paymentStatus && !paymentReference && !confirmationSource}
                    />
                    {paymentType ? (
                      <BookingEmailDataRow
                        label="Payment Type"
                        value={paymentType}
                        labelColor={color.textSecondary}
                        last={!paymentMethod && !paymentStatus && !paymentReference && !confirmationSource}
                      />
                    ) : null}
                    {paymentMethod ? (
                      <BookingEmailDataRow
                        label="Payment Method"
                        value={paymentMethod}
                        labelColor={color.textSecondary}
                        last={!paymentStatus && !paymentReference && !confirmationSource}
                      />
                    ) : null}
                    {paymentStatus ? (
                      <BookingEmailDataRow
                        label="Payment Status"
                        value={paymentStatus}
                        labelColor={color.textSecondary}
                        last={!paymentReference && !confirmationSource}
                      />
                    ) : null}
                    {paymentReference ? (
                      <BookingEmailDataRow
                        label="Reference"
                        value={paymentReference}
                        labelColor={color.textSecondary}
                        last={!confirmationSource}
                      />
                    ) : null}
                    {confirmationSource ? (
                      <BookingEmailDataRow
                        label="Source"
                        value={confirmationSource}
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
