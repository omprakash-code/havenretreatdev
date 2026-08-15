import BookingEmailHeader from "@/emails/components/BookingEmailHeader";
import type { PaymentSummaryRow } from "@/lib/booking-payment-rows";
import { resolveBookingEmailTheme } from "@/emails/theme/booking-email-theme";
import {
  BookingEmailCenteredActionButton,
  BookingEmailDataRow,
  BookingEmailSectionLabel,
  BookingEmailSummaryPanel,
} from "@/emails/components/BookingEmailContent";
import { bookingEmailColors, bookingEmailFonts } from "@/emails/theme/booking-email-colors";
import {
  BOOKING_PAYMENT_NOT_REQUIRED_VALUE,
  BOOKING_REJECTED_MESSAGE,
  BOOKING_REVIEW_TITLE,
} from "@/constants/booking-status-copy";

/**
 * One template for every review-workflow notification. The booking journey has
 * no payment step, so none of these variants request money.
 */
export type BookingReviewEmailVariant =
  | "SUBMITTED"
  | "ADMIN_SUBMITTED"
  | "APPROVED"
  | "REJECTED";

export type BookingReviewEmailProps = {
  variant: BookingReviewEmailVariant;
  bookingRef: string;
  customerName: string;
  customerPhone?: string | null;
  customerEmail?: string | null;
  theatreName: string;
  locationName?: string | null;
  date: string;
  timeSlot: string;
  guestCount: number;
  occasionLabel?: string | null;
  decorationRequired?: boolean;
  additionalChargeAmount?: number | null;
  additionalChargeReason?: string | null;
  totalAmount: number;
  /**
   * The pricing breakdown from buildBookingPaymentRows() — the same rows the
   * PDF and the confirmation emails render. Without it the recipient sees only
   * a total and cannot tell why a reduced package differs from its list price.
   */
  paymentRows?: PaymentSummaryRow[];
  agreementSigned: boolean;
  rejectionReason?: string | null;
  actionUrl?: string | null;
  actionLabel?: string;
};

// Resolved like every other template so the look never depends on which flow
// created the booking.
const color =
  resolveBookingEmailTheme(process.env.BOOKING_EMAIL_THEME) === "light"
    ? bookingEmailColors.light
    : bookingEmailColors.dark;

const moneyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatMoney(value: number) {
  const amount = Math.max(0, Number(value) || 0);
  return moneyFormatter.format(amount);
}

function resolveVariantCopy(props: BookingReviewEmailProps) {
  switch (props.variant) {
    case "APPROVED":
      return {
        eyebrow: "Booking Approved",
        title: "Your booking has been approved! 🎉",
        message:
          "To secure your reservation, please submit your $150 advance deposit via Zelle using the payment details below.",
        note: null,
      };
    case "REJECTED":
      // The reason gets its own section below, so it is not repeated here.
      return {
        eyebrow: "Booking Update",
        title: "About your booking request",
        message: BOOKING_REJECTED_MESSAGE,
        note: null,
      };
    case "ADMIN_SUBMITTED":
      return {
        eyebrow: "Review Required",
        title: "New booking request",
        message:
          "A new booking request has been submitted and is awaiting review. Review the details in the admin panel and approve or reject it.",
        note: null,
      };
    case "SUBMITTED":
    default:
      return {
        eyebrow: "Request Received",
        title: BOOKING_REVIEW_TITLE,
        message:
          "Thank you for choosing Haven Retreat. We've received your booking request.",
        note: "Haven Retreat will review your request and reach out to confirm your event.",
      };
  }
}

export default function BookingReviewEmail(props: BookingReviewEmailProps) {
  const copy = resolveVariantCopy(props);
  const isAdmin = props.variant === "ADMIN_SUBMITTED";
  const isApproved = props.variant === "APPROVED";
  const amountLabel = isAdmin ? "Total Estimate" : "Estimated Total";
  // Everything above the total. The builder's own final row is dropped so the
  // wording stays "Estimated Total" / "Total Estimate", but its VALUE is reused
  // so the figure matches the PDF exactly.
  const breakdownRows = (props.paymentRows ?? []).filter(
    (row) => row.tone !== "strong"
  );
  const totalValue =
    props.paymentRows?.find((row) => row.tone === "strong")?.value ??
    formatMoney(props.totalAmount);
  const rejectionReason =
    props.variant === "REJECTED" ? props.rejectionReason?.trim() : null;

  return (
    <div
      style={{
        margin: 0,
        padding: "32px 5px",
        backgroundColor: color.pageBg,
        fontFamily: bookingEmailFonts.body,
      }}
    >
      <table
        role="presentation"
        cellPadding={0}
        cellSpacing={0}
        width="100%"
        style={{
          width: "100%",
          maxWidth: 420,
          margin: "0 auto",
          borderCollapse: "collapse",
          backgroundColor: color.cardBg,
          border: color.borderLine,
          borderRadius: 4,
          overflow: "hidden",
          boxShadow: color.cardShadow,
        }}
      >
        <tbody>
          <BookingEmailHeader
            title={props.bookingRef}
            referenceTitle
            eyebrow={copy.eyebrow}
            backgroundColor="#ffffff"
            logoBorder={color.logoBorder}
          />

          <tr>
            <td style={{ padding: "16px 12px" }}>
              {isApproved && (
                <p
                  style={{
                    margin: "0 0 6px",
                    fontSize: 12,
                    lineHeight: "20px",
                    color: color.textMuted,
                  }}
                >
                  Hi {props.customerName},
                </p>
              )}
              <p
                style={{
                  margin: 0,
                  fontSize: 14,
                  fontWeight: 700,
                  color: color.textPrimary,
                }}
              >
                {copy.title}
              </p>
              <p
                style={{
                  margin: "6px 0 0",
                  fontSize: 12,
                  lineHeight: "20px",
                  color: color.textMuted,
                }}
              >
                {isApproved ? (
                  <>
                    To secure your reservation, please submit your{" "}
                    <strong style={{ color: color.textPrimary }}>
                      $150 advance deposit
                    </strong>{" "}
                    via{" "}
                    <strong style={{ color: color.textPrimary }}>Zelle</strong>{" "}
                    using the payment details below.
                  </>
                ) : isAdmin ? (
                  copy.message
                ) : (
                  `Hi ${props.customerName}, ${copy.message}`
                )}
              </p>

              {copy.note && (
                <p
                  style={{
                    margin: "10px 0 0",
                    padding: "8px 10px",
                    fontSize: 11,
                    lineHeight: "18px",
                    color: color.textSubtle,
                    backgroundColor: color.panelBg,
                    border: color.borderLine,
                    borderRadius: 4,
                  }}
                >
                  {copy.note}
                </p>
              )}

              {isApproved && (
                <>
                  <table
                    role="presentation"
                    cellPadding={0}
                    cellSpacing={0}
                    style={{ width: "100%", marginTop: 6 }}
                  >
                    <tbody>
                      <BookingEmailSectionLabel textColor={color.textMuted}>
                        Payment Instructions
                      </BookingEmailSectionLabel>
                    </tbody>
                  </table>

                  <BookingEmailSummaryPanel
                    palette={{
                      textSecondary: color.textSecondary,
                      borderLine: color.borderLine,
                      cardBg: color.panelBg,
                    }}
                  >
                    <table
                      role="presentation"
                      cellPadding={0}
                      cellSpacing={0}
                      style={{ width: "100%" }}
                    >
                      <tbody>
                        <BookingEmailDataRow
                          label="Advance Deposit"
                          value="$150"
                          labelColor={color.textSecondary}
                          valueColor={color.textPrimary}
                          valueWeight={700}
                        />
                        <BookingEmailDataRow
                          label="Payment Method"
                          value="Zelle"
                          labelColor={color.textSecondary}
                          valueColor={color.textPrimary}
                          valueWeight={700}
                        />
                        <BookingEmailDataRow
                          label="Send Payment To"
                          value="jessika111190@gmail.com"
                          labelColor={color.textSecondary}
                          valueColor={color.textPrimary}
                          valueWeight={700}
                          last
                        />
                      </tbody>
                    </table>
                  </BookingEmailSummaryPanel>

                  <div style={{ margin: "0 0 14px" }}>
                    <p
                      style={{
                        margin: 0,
                        fontSize: 10,
                        fontWeight: 700,
                        letterSpacing: "0.12em",
                        textTransform: "uppercase" as const,
                        color: color.textMuted,
                      }}
                    >
                      Payment Reference
                    </p>
                    <p
                      style={{
                        margin: "4px 0 0",
                        fontSize: 14,
                        fontWeight: 700,
                        fontFamily: bookingEmailFonts.mono,
                        letterSpacing: "0.04em",
                        color: color.textPrimary,
                      }}
                    >
                      {props.bookingRef}
                    </p>
                    <p
                      style={{
                        margin: "6px 0 0",
                        fontSize: 11,
                        lineHeight: "18px",
                        color: color.textSubtle,
                      }}
                    >
                      Please include this reference in your Zelle payment note
                      so we can match your payment quickly.
                    </p>
                  </div>

                  <p
                    style={{
                      margin: "0 0 6px",
                      fontSize: 12,
                      lineHeight: "20px",
                      color: color.textMuted,
                    }}
                  >
                    Once your payment is received, we&apos;ll confirm your
                    reservation and send you a payment confirmation email.
                  </p>
                </>
              )}

              {rejectionReason && (
                <>
                  <table
                    role="presentation"
                    cellPadding={0}
                    cellSpacing={0}
                    style={{ width: "100%", marginTop: 6 }}
                  >
                    <tbody>
                      <BookingEmailSectionLabel textColor={color.textMuted}>
                        Reason
                      </BookingEmailSectionLabel>
                    </tbody>
                  </table>

                  <BookingEmailSummaryPanel
                    palette={{
                      textSecondary: color.textSecondary,
                      borderLine: color.borderLine,
                      cardBg: color.panelBg,
                    }}
                  >
                    <p
                      style={{
                        margin: 0,
                        fontSize: 12,
                        lineHeight: "20px",
                        color: color.textSecondary,
                        whiteSpace: "pre-wrap",
                      }}
                    >
                      {rejectionReason}
                    </p>
                  </BookingEmailSummaryPanel>
                </>
              )}

              <table
                role="presentation"
                cellPadding={0}
                cellSpacing={0}
                style={{ width: "100%", marginTop: 6 }}
              >
                <tbody>
                  <BookingEmailSectionLabel textColor={color.textMuted}>
                    Event Details
                  </BookingEmailSectionLabel>
                </tbody>
              </table>

              <BookingEmailSummaryPanel
                palette={{
                  textSecondary: color.textSecondary,
                  borderLine: color.borderLine,
                  cardBg: color.panelBg,
                }}
              >
                <table
                  role="presentation"
                  cellPadding={0}
                  cellSpacing={0}
                  style={{ width: "100%" }}
                >
                  <tbody>
                    <BookingEmailDataRow
                      label="Package"
                      value={props.theatreName}
                      labelColor={color.textSecondary}
                      valueColor={color.textPrimary}
                      valueWeight={700}
                    />
                    <BookingEmailDataRow
                      label="Date"
                      value={props.date}
                      labelColor={color.textSecondary}
                      valueColor={color.textPrimary}
                    />
                    <BookingEmailDataRow
                      label="Time"
                      value={props.timeSlot}
                      labelColor={color.textSecondary}
                      valueColor={color.textPrimary}
                    />
                    <BookingEmailDataRow
                      label="Guests"
                      value={String(props.guestCount)}
                      labelColor={color.textSecondary}
                      valueColor={color.textPrimary}
                    />
                    {props.occasionLabel && (
                      <BookingEmailDataRow
                        label="Occasion"
                        value={props.occasionLabel}
                        labelColor={color.textSecondary}
                        valueColor={color.textPrimary}
                      />
                    )}
                    <BookingEmailDataRow
                      label="Decoration"
                      value={props.decorationRequired ? "Yes" : "No"}
                      labelColor={color.textSecondary}
                      valueColor={color.textPrimary}
                    />
                    <BookingEmailDataRow
                      label="Rental Agreement"
                      value={props.agreementSigned ? "Signed" : "Not signed"}
                      labelColor={color.textSecondary}
                      valueColor={
                        props.agreementSigned
                          ? bookingEmailColors.success
                          : color.textPrimary
                      }
                      valueWeight={700}
                    />
                    {/* The shared breakdown, rendered verbatim so this email
                        cannot disagree with the PDF or the confirmation emails.
                        It already carries the additional-charge row, so no row
                        is repeated here. Empty rows are never produced: the
                        builder only emits lines that apply. */}
                    {breakdownRows.map((row, index) => (
                      <BookingEmailDataRow
                        key={`${row.label}-${index}`}
                        label={row.label}
                        value={row.value}
                        labelColor={color.textSecondary}
                        valueColor={
                          row.tone === "success"
                            ? bookingEmailColors.success
                            : color.textPrimary
                        }
                      />
                    ))}
                    <BookingEmailDataRow
                      label={amountLabel}
                      value={totalValue}
                      labelColor={color.textSecondary}
                      valueColor={color.textPrimary}
                      valueWeight={700}
                    />
                    {/* Approval asks for the advance deposit; every other
                        variant owes nothing until Haven Retreat records a
                        payment. */}
                    <BookingEmailDataRow
                      label={isApproved ? "Payment Status" : "Payment"}
                      value={
                        isApproved
                          ? "Awaiting Payment"
                          : BOOKING_PAYMENT_NOT_REQUIRED_VALUE
                      }
                      labelColor={color.textSecondary}
                      valueColor={color.textPrimary}
                      last
                    />
                  </tbody>
                </table>
              </BookingEmailSummaryPanel>

              {/* The customer sees the contact details their request was filed
                  under, so a typo is caught before Haven Retreat calls. */}
              <BookingEmailSummaryPanel
                  palette={{
                    textSecondary: color.textSecondary,
                    borderLine: color.borderLine,
                    cardBg: color.panelBg,
                  }}
                >
                  <table
                    role="presentation"
                    cellPadding={0}
                    cellSpacing={0}
                    style={{ width: "100%" }}
                  >
                    <tbody>
                      <BookingEmailDataRow
                        label="Customer"
                        value={props.customerName}
                        labelColor={color.textSecondary}
                        valueColor={color.textPrimary}
                        valueWeight={700}
                      />
                      {props.customerPhone && (
                        <BookingEmailDataRow
                          label="Phone"
                          value={props.customerPhone}
                          labelColor={color.textSecondary}
                          valueColor={color.textPrimary}
                        />
                      )}
                      {props.customerEmail && (
                        <BookingEmailDataRow
                          label="Email"
                          value={props.customerEmail}
                          labelColor={color.textSecondary}
                          valueColor={color.textPrimary}
                          last
                        />
                      )}
                    </tbody>
                  </table>
              </BookingEmailSummaryPanel>

              {props.actionUrl && (
                <BookingEmailCenteredActionButton
                  href={props.actionUrl}
                  label={
                    props.actionLabel ??
                    (isApproved ? "View Your Booking" : "View Booking")
                  }
                  backgroundColor={bookingEmailColors.brandAccent}
                  uppercase={!isApproved}
                />
              )}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
