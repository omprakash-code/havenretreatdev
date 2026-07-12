import BookingEmailHeader from "@/emails/components/BookingEmailHeader";
import {
  BookingEmailCenteredActionButton,
  BookingEmailDataRow,
  BookingEmailSectionLabel,
  BookingEmailSummaryPanel,
} from "@/emails/components/BookingEmailContent";
import { bookingEmailColors } from "@/emails/theme/booking-email-colors";
import {
  BOOKING_APPROVED_MESSAGE,
  BOOKING_NO_PAYMENT_DUE_MESSAGE,
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
  totalAmount: number;
  agreementSigned: boolean;
  rejectionReason?: string | null;
  actionUrl?: string | null;
  actionLabel?: string;
};

const color = bookingEmailColors.dark;

const moneyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

function formatMoney(value: number) {
  return moneyFormatter.format(Math.max(0, Math.trunc(value || 0)));
}

function resolveVariantCopy(props: BookingReviewEmailProps) {
  switch (props.variant) {
    case "APPROVED":
      return {
        eyebrow: "Booking Approved",
        title: "Your event is approved",
        message: BOOKING_APPROVED_MESSAGE,
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
        note: BOOKING_NO_PAYMENT_DUE_MESSAGE,
      };
  }
}

export default function BookingReviewEmail(props: BookingReviewEmailProps) {
  const copy = resolveVariantCopy(props);
  const isAdmin = props.variant === "ADMIN_SUBMITTED";
  const amountLabel = isAdmin ? "Total Estimate" : "Estimated Total";
  const rejectionReason =
    props.variant === "REJECTED" ? props.rejectionReason?.trim() : null;

  return (
    <div
      style={{
        margin: 0,
        padding: "5px",
        backgroundColor: color.pageBg,
        fontFamily: "'Courier New', Courier, monospace",
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
            eyebrow={copy.eyebrow}
            backgroundColor={bookingEmailColors.brandAccent}
            textColor={color.textPrimary}
            logoBorder={color.logoBorder}
          />

          <tr>
            <td style={{ padding: "16px 12px" }}>
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
                {isAdmin ? copy.message : `Hi ${props.customerName}, ${copy.message}`}
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
                      label="Agreement"
                      value={props.agreementSigned ? "Signed" : "Not signed"}
                      labelColor={color.textSecondary}
                      valueColor={
                        props.agreementSigned
                          ? bookingEmailColors.success
                          : color.textPrimary
                      }
                      valueWeight={700}
                    />
                    <BookingEmailDataRow
                      label={amountLabel}
                      value={formatMoney(props.totalAmount)}
                      labelColor={color.textSecondary}
                      valueColor={color.textPrimary}
                      valueWeight={700}
                    />
                    {/* Approval and payment are separate lifecycles: nothing is
                        owed until Haven Retreat records a payment. */}
                    <BookingEmailDataRow
                      label="Payment"
                      value={BOOKING_PAYMENT_NOT_REQUIRED_VALUE}
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
                  label={props.actionLabel ?? "View Booking"}
                  backgroundColor={bookingEmailColors.brandAccent}
                  textColor={color.textPrimary}
                />
              )}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
