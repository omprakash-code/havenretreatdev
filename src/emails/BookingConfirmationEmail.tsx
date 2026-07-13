import BookingEmailFontStyles from "@/emails/components/BookingEmailFontStyles";
import { bookingEmailColors, bookingEmailFonts } from "@/emails/theme/booking-email-colors";
import {
  BOOKING_PAYMENT_APPLIED_MESSAGE,
  BOOKING_CONFIRMED_MESSAGE,
  BOOKING_CONFIRMED_TITLE,
} from "@/constants/booking-status-copy";
export type BookingConfirmationAddonItem = {
  name: string;
  variantLabel?: string;
  quantity: number;
  totalPrice: number;
  numberValue?: string;
  image?: string | null;
};

export type BookingConfirmationDetail = {
  label: string;
  value: string;
};

export type BookingConfirmationSignedAgreement = {
  id: string;
  signerName: string;
  signerEmail: string;
  signedAt: string;
  signatureImage: string;
  agreementVersion?: string | null;
  agreementHtmlSnapshot?: string | null;
  acknowledgedClauses: number[];
  confirmationAccepted: boolean;
};

export type BookingConfirmationEmailProps = {
  bookingRef: string;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  theatreName: string;
  locationName?: string;
  date: string;
  timeSlot: string;
  durationHours?: number | null;
  includedDurationHours?: number | null;
  extraDurationHours?: number | null;
  extraDurationAmount?: number | null;
  guestCount: number;
  occasionLabel?: string;
  occasionDetails?: BookingConfirmationDetail[];
  addonItems?: BookingConfirmationAddonItem[];
  signedAgreement?: BookingConfirmationSignedAgreement | null;
  paymentType?: string;
  paymentMethod?: string;
  paymentStatus?: string;
  paymentReference?: string;
  baseAmount?: number;
  extrasAmount?: number;
  productsAmount?: number;
  decorationAmount?: number;
  discountAmount?: number;
  totalAmount: number;
  advancePaid: number;
  remainingPayable: number;
  successUrl: string;
};

const moneyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const color = bookingEmailColors.dark;

const resolvedBaseUrl = (() => {
  const nextPublic = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (nextPublic) return nextPublic.replace(/\/+$/, "");

  const appUrl = process.env.APP_URL?.trim();
  if (appUrl) return appUrl.replace(/\/+$/, "");

  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) return `https://${vercel.replace(/\/+$/, "")}`;

  return "";
})();

const BRAND_LOGO_PATH = "/assets/email-ds-logo.png";
const BRAND_LOGO_URL =
  process.env.NODE_ENV === "production"
    ? resolvedBaseUrl
      ? `${resolvedBaseUrl}${BRAND_LOGO_PATH}`
      : BRAND_LOGO_PATH
    : BRAND_LOGO_PATH;

function formatMoney(value: number) {
  return moneyFormatter.format(Math.max(0, Math.trunc(value || 0)));
}

function normalizeLabel(key: string) {
  return key
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (ch) => ch.toUpperCase());
}

function normalizeValue(value: string) {
  if (!value) return "-";
  return value;
}

function isOccasionNumberFieldLabel(label: string) {
  const normalized = label.trim().toLowerCase().replace(/[_\-\s]+/g, "");
  return (
    normalized === "lednumber" ||
    normalized === "ledno" ||
    normalized === "led"
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <tr>
      <td colSpan={2} style={{ paddingTop: 16, paddingBottom: 8 }}>
        <table role="presentation" cellPadding={0} cellSpacing={0} style={{ width: "100%" }}>
          <tbody>
            <tr>
              <td style={{ width: 10, verticalAlign: "middle" }}>
                <div
                  style={{
                    width: 3,
                    height: 14,
                    backgroundColor: bookingEmailColors.brandAccent,
                    display: "inline-block",
                    borderRadius: 2,
                  }}
                />
              </td>
              <td style={{ verticalAlign: "middle" }}>
                <span
                  style={{
                    fontSize: 10,
                    letterSpacing: "0.18em",
                    fontWeight: 700,
                    color: color.textMuted,
                    textTransform: "uppercase" as const,
                    fontFamily: bookingEmailFonts.body,
                  }}
                >
                  {children}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
        <div style={{ borderTop: color.borderLine, marginTop: 8 }} />
      </td>
    </tr>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <tr>
      <td
        style={{
          padding: "6px 0",
          color: color.textSecondary,
          width: "42%",
          fontSize: 13,
          fontFamily: bookingEmailFonts.body,
          letterSpacing: "0.02em",
        }}
      >
        {label}
      </td>
      <td
        style={{
          padding: "6px 0",
          color: color.textPrimary,
          fontWeight: 600,
          fontSize: 13,
          fontFamily: bookingEmailFonts.body,
          textAlign: "right",
        }}
      >
        {value}
      </td>
    </tr>
  );
}

function Perforation() {
  return (
    <tr>
      <td style={{ padding: 0 }}>
        <div
          style={{
            borderTop: color.perforation,
            margin: 0,
          }}
        />
      </td>
    </tr>
  );
}

export default function BookingConfirmationEmail({
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
  paymentType,
  paymentMethod,
  paymentStatus,
  paymentReference,
  baseAmount = 0,
  extrasAmount = 0,
  productsAmount = 0,
  decorationAmount = 0,
  discountAmount = 0,
  totalAmount,
  advancePaid,
  remainingPayable,
}: BookingConfirmationEmailProps) {
  const showBalanceAtVenue = remainingPayable > 0;
  const sanitizedDetails = occasionDetails
    .filter(
      (detail) =>
        detail.label &&
        detail.value &&
        !isOccasionNumberFieldLabel(detail.label)
    )
    .map((detail) => ({
      label: normalizeLabel(detail.label),
      value: normalizeValue(detail.value),
    }));

  return (
    <div
      style={{
        margin: 0,
        padding: "5px",
        backgroundColor: color.pageBg,
        fontFamily: bookingEmailFonts.body,
      }}
    >
      <BookingEmailFontStyles />
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
          <tr>
            <td style={{ backgroundColor: bookingEmailColors.brandAccent, padding: "14px 12px 12px" }}>
              <table
                role="presentation"
                cellPadding={0}
                cellSpacing={0}
                width="100%"
                style={{ width: "100%", tableLayout: "fixed" }}
              >
                <tbody>
                  <tr>
                    <td style={{ verticalAlign: "bottom", width: "60%", paddingRight: 8 }}>
                      <p
                        style={{
                          margin: 0,
                          fontSize: 10,
                          letterSpacing: "0.2em",
                          color: color.cardBg,
                          fontWeight: 700,
                          textTransform: "uppercase" as const,
                        }}
                      >
                        Haven Retreat
                      </p>
                      <h1
                        style={{
                          margin: "6px 0 0",
                          fontSize: 22,
                          fontWeight: 900,
                          color: color.cardBg,
                          letterSpacing: "-0.02em",
                          lineHeight: 1.05,
                          fontFamily: bookingEmailFonts.heading,
                          wordBreak: "break-word",
                        }}
                      >
                        Booking Received
                      </h1>
                    </td>
                    <td
                      align="right"
                      style={{
                        width: "40%",
                        minWidth: 56,
                        verticalAlign: "bottom",
                        textAlign: "right",
                        fontSize: 0,
                        lineHeight: 0,
                      }}
                    >
                      <table
                        role="presentation"
                        align="right"
                        cellPadding={0}
                        cellSpacing={0}
                        style={{ marginLeft: "auto" }}
                      >
                        <tbody>
                          <tr>
                            <td align="right" style={{ textAlign: "right" }}>
                              {BRAND_LOGO_URL ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={BRAND_LOGO_URL}
                                  alt=""
                                  width={72}
                                  height={72}
                                  style={{
                                    width: 72,
                                    height: 72,
                                    display: "block",
                                    borderRadius: 100,
                                    border: color.logoBorder,
                                    objectFit: "contain",
                                    padding: 3,
                                    boxSizing: "border-box",
                                  }}
                                />
                              ) : (
                                <div
                                  style={{
                                    width: 52,
                                    height: 52,
                                    borderRadius: 6,
                                    backgroundColor: color.cardBg,
                                    display: "inline-flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    fontSize: 16,
                                    fontWeight: 800,
                                    color: bookingEmailColors.brandAccent,
                                    letterSpacing: "0.08em",
                                    lineHeight: "52px",
                                  }}
                                >
                                  DS
                                </div>
                              )}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </td>
                  </tr>
                </tbody>
              </table>
            </td>
          </tr>

          <tr>
            <td
              style={{
                backgroundColor: color.referenceBg,
                padding: "8px 12px",
                borderBottom: color.borderLine,
              }}
            >
              <table role="presentation" cellPadding={0} cellSpacing={0} style={{ width: "100%", tableLayout: "fixed" }}>
                <tbody>
                  <tr>
                    <td style={{ width: "42%" }}>
                      <span
                        style={{
                          fontSize: 9,
                          color: color.textSecondary,
                          letterSpacing: "0.14em",
                          textTransform: "uppercase" as const,
                        }}
                      >
                        Reference No.
                      </span>
                    </td>
                    <td align="right" style={{ width: "58%", textAlign: "right" }}>
                      <span
                        style={{
                          display: "inline-block",
                          fontSize: 13,
                          fontWeight: 800,
                          color: bookingEmailColors.brandAccent,
                          letterSpacing: "0.08em",
                          whiteSpace: "nowrap" as const,
                        }}
                      >
                        {bookingRef}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </td>
          </tr>

          <tr>
            <td style={{ padding: "10px 8px 0" }}>
              <table
                role="presentation"
                cellPadding={0}
                cellSpacing={0}
                style={{
                  width: "100%",
                  backgroundColor: "#f2f8f6",
                  border: "1px solid #b9d8d3",
                  borderRadius: 4,
                }}
              >
                <tbody>
                  <tr>
                    <td style={{ padding: "10px 12px" }}>
                      <p style={{ margin: 0, fontSize: 11, fontWeight: 800, color: "#245e5b", fontFamily: bookingEmailFonts.body }}>
                        {BOOKING_CONFIRMED_TITLE}
                      </p>
                      <p style={{ margin: "4px 0 0", fontSize: 11, color: "#2b6a67", lineHeight: 1.5, fontFamily: bookingEmailFonts.body }}>
                        {BOOKING_CONFIRMED_MESSAGE}
                      </p>
                      <p style={{ margin: "6px 0 0", fontSize: 10, color: "#2b6a67", fontFamily: bookingEmailFonts.body }}>
                        {BOOKING_PAYMENT_APPLIED_MESSAGE}
                      </p>
                    </td>
                  </tr>
                </tbody>
              </table>
            </td>
          </tr>

          <tr>
            <td style={{ padding: "10px 8px 0" }}>
              <table
                role="presentation"
                cellPadding={0}
                cellSpacing={0}
                style={{
                  width: "100%",
                  backgroundColor: color.pageBg,
                  border: color.borderLine,
                  borderRadius: 6,
                  overflow: "hidden",
                }}
              >
                <tbody>
                  <tr>
                    <td style={{ padding: "8px" }}>
                      <p
                        style={{
                          margin: 0,
                          fontSize: 9,
                          letterSpacing: "0.16em",
                          color: color.textSecondary,
                          textTransform: "uppercase" as const,
                        }}
                      >
                        {locationName ?? ""}
                      </p>
                      <p
                        style={{
                          margin: "4px 0 0",
                          fontSize: 14,
                          fontWeight: 800,
                          color: color.textPrimary,
                          fontFamily: bookingEmailFonts.heading,
                          letterSpacing: "-0.01em",
                        }}
                      >
                        {theatreName}
                      </p>
                    </td>
                    <td
                      align="right"
                      style={{
                        padding: "8px",
                        borderLeft: color.borderDashed,
                        whiteSpace: "nowrap" as const,
                        textAlign: "right",
                      }}
                    >
                      <p
                        style={{
                          margin: 0,
                          fontSize: 9,
                          letterSpacing: "0.16em",
                          color: color.textSecondary,
                          textTransform: "uppercase" as const,
                        }}
                      >
                        Date &amp; Time
                      </p>
                      <p
                        style={{
                          margin: "4px 0 0",
                          fontSize: 14,
                          fontWeight: 800,
                          color: bookingEmailColors.brandAccent,
                          letterSpacing: "0.02em",
                        }}
                      >
                        {date}
                      </p>
                      <p
                        style={{
                          margin: "2px 0 0",
                          fontSize: 12,
                          color: color.textSubtle,
                          fontWeight: 600,
                        }}
                      >
                        {timeSlot}
                      </p>
                    </td>
                  </tr>
                  <tr>
                    <td colSpan={2} style={{ borderTop: color.borderLine, padding: "8px 8px", backgroundColor: color.panelBg }}>
                      <table role="presentation" cellPadding={0} cellSpacing={0} style={{ width: "100%", tableLayout: "fixed" }}>
                        <tbody>
                          <tr>
                            <td style={{ width: "45%", textAlign: "left" }}>
                              <span style={{ fontSize: 11, color: color.textSecondary, marginRight: 6 }}>GUESTS</span>
                              <span style={{ fontSize: 13, color: color.textPrimary, fontWeight: 700 }}>{guestCount}</span>
                            </td>
                            {occasionLabel ? (
                              <td align="right" style={{ width: "55%", textAlign: "right", whiteSpace: "nowrap" }}>
                                <span style={{ fontSize: 11, color: color.textSecondary, marginRight: 6 }}>OCCASION</span>
                                <span style={{ fontSize: 13, color: color.textPrimary, fontWeight: 700 }}>{occasionLabel}</span>
                              </td>
                            ) : (
                              <td style={{ width: "55%" }} />
                            )}
                          </tr>
                        </tbody>
                      </table>
                    </td>
                  </tr>
                </tbody>
              </table>
            </td>
          </tr>

          <tr>
            <td style={{ padding: "2px 8px 14px" }}>
              <table role="presentation" cellPadding={0} cellSpacing={0} style={{ width: "100%", tableLayout: "fixed" }}>
                <tbody>
                  <SectionLabel>Customer</SectionLabel>
                  <DetailRow label="Name" value={customerName?.trim() || "-"} />
                  <DetailRow label="Phone" value={customerPhone?.trim() || "-"} />
                  {customerEmail ? <DetailRow label="Email" value={customerEmail} /> : null}

                  {sanitizedDetails.length > 0 ? (
                    <>
                      <SectionLabel>Occasion Inputs</SectionLabel>
                      {sanitizedDetails.map((detail) => (
                        <DetailRow key={`${detail.label}:${detail.value}`} label={detail.label} value={detail.value} />
                      ))}
                    </>
                  ) : null}

                  {addonItems.length > 0 ? (
                    <>
                      <SectionLabel>Add-ons</SectionLabel>
                      <tr>
                        <td colSpan={2} style={{ paddingBottom: 2 }}>
                          <table role="presentation" cellPadding={0} cellSpacing={0} style={{ width: "100%", borderCollapse: "collapse" }}>
                            <thead>
                              <tr>
                                <th
                                  align="left"
                                  style={{
                                    fontSize: 10,
                                    color: color.tableHeader,
                                    fontWeight: 700,
                                    letterSpacing: "0.12em",
                                    textTransform: "uppercase" as const,
                                    paddingBottom: 8,
                                    fontFamily: bookingEmailFonts.body,
                                  }}
                                >
                                  Item
                                </th>
                                <th
                                  align="center"
                                  style={{
                                    fontSize: 10,
                                    color: color.tableHeader,
                                    fontWeight: 700,
                                    letterSpacing: "0.12em",
                                    textTransform: "uppercase" as const,
                                    paddingBottom: 8,
                                    fontFamily: bookingEmailFonts.body,
                                  }}
                                >
                                  Qty
                                </th>
                                <th
                                  align="right"
                                  style={{
                                    fontSize: 10,
                                    color: color.tableHeader,
                                    fontWeight: 700,
                                    letterSpacing: "0.12em",
                                    textTransform: "uppercase" as const,
                                    paddingBottom: 8,
                                    fontFamily: bookingEmailFonts.body,
                                  }}
                                >
                                  Amount
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {addonItems.map((item) => (
                                <tr key={`${item.name}:${item.variantLabel ?? "-"}:${item.quantity}`}>
                                  <td
                                    style={{
                                      fontSize: 13,
                                      color: color.textSubtle,
                                      padding: "8px 0",
                                      borderTop: color.borderLine,
                                      fontFamily: bookingEmailFonts.body,
                                    }}
                                  >
                                    {item.name}
                                    {item.variantLabel ? ` (${item.variantLabel})` : ""}
                                    {item.numberValue ? ` — #${item.numberValue}` : ""}
                                  </td>
                                  <td
                                    align="center"
                                    style={{
                                      fontSize: 13,
                                      color: color.textSubtle,
                                      padding: "8px 0",
                                      borderTop: color.borderLine,
                                      fontFamily: bookingEmailFonts.body,
                                    }}
                                  >
                                    {item.quantity}
                                  </td>
                                  <td
                                    align="right"
                                    style={{
                                      fontSize: 13,
                                      color: color.textSubtle,
                                      padding: "8px 0",
                                      borderTop: color.borderLine,
                                      fontFamily: bookingEmailFonts.body,
                                    }}
                                  >
                                    {item.totalPrice === 0 ? "Included" : formatMoney(item.totalPrice)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    </>
                  ) : null}

                </tbody>
              </table>
            </td>
          </tr>

          <Perforation />

          <tr>
            <td style={{ padding: "14px 8px" }}>
              <table role="presentation" cellPadding={0} cellSpacing={0} style={{ width: "100%" }}>
                <tbody>
                  <tr>
                    <td>
                      <p
                        style={{
                          margin: 0,
                          fontSize: 9,
                          letterSpacing: "0.2em",
                          color: color.textSecondary,
                          textTransform: "uppercase" as const,
                          fontFamily: bookingEmailFonts.body,
                        }}
                      >
                        Payment Summary
                      </p>
                    </td>
                  </tr>
                  <tr>
                    <td style={{ paddingTop: 10 }}>
                      <table role="presentation" cellPadding={0} cellSpacing={0} style={{ width: "100%" }}>
                        <tbody>
                          {baseAmount > 0 ? (
                            <tr>
                              <td style={{ fontSize: 12, color: color.textSecondary, padding: "4px 0" }}>Base Amount</td>
                              <td align="right" style={{ fontSize: 12, color: color.textMuted, padding: "4px 0" }}>
                                {formatMoney(baseAmount)}
                              </td>
                            </tr>
                          ) : null}
                          {extrasAmount > 0 ? (
                            <tr>
                              <td style={{ fontSize: 12, color: color.textSecondary, padding: "4px 0" }}>Extra Guests</td>
                              <td align="right" style={{ fontSize: 12, color: color.textMuted, padding: "4px 0" }}>
                                {formatMoney(extrasAmount)}
                              </td>
                            </tr>
                          ) : null}
                          {decorationAmount > 0 ? (
                            <tr>
                              <td style={{ fontSize: 12, color: color.textSecondary, padding: "4px 0" }}>Decoration</td>
                              <td align="right" style={{ fontSize: 12, color: color.textMuted, padding: "4px 0" }}>
                                {formatMoney(decorationAmount)}
                              </td>
                            </tr>
                          ) : null}
                          {productsAmount > 0 ? (
                            <tr>
                              <td style={{ fontSize: 12, color: color.textSecondary, padding: "4px 0" }}>Add-ons</td>
                              <td align="right" style={{ fontSize: 12, color: color.textMuted, padding: "4px 0" }}>
                                {formatMoney(productsAmount)}
                              </td>
                            </tr>
                          ) : null}
                          {discountAmount > 0 ? (
                            <tr>
                              <td style={{ fontSize: 12, color: bookingEmailColors.success, padding: "4px 0" }}>Discount</td>
                              <td align="right" style={{ fontSize: 12, color: bookingEmailColors.success, padding: "4px 0" }}>
                                -{formatMoney(discountAmount)}
                              </td>
                            </tr>
                          ) : null}
                          <tr>
                            <td colSpan={2} style={{ padding: "8px 0 0" }}>
                              <div style={{ borderTop: color.borderStrongLine }} />
                            </td>
                          </tr>
                          <tr>
                            <td style={{ fontSize: 14, fontWeight: 800, color: color.textPrimary, padding: "8px 0 0" }}>TOTAL</td>
                            <td align="right" style={{ fontSize: 18, fontWeight: 900, color: bookingEmailColors.brandAccent, padding: "8px 0 0" }}>
                              {formatMoney(totalAmount)}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </td>
                  </tr>

                  <tr>
                    <td style={{ paddingTop: 10 }}>
                      <table
                        role="presentation"
                        cellPadding={0}
                        cellSpacing={0}
                        style={{ width: "100%", border: color.borderLine, backgroundColor: color.panelBg }}
                      >
                        <tbody>
                          <tr>
                            <td
                              align="left"
                              style={{
                                padding: "10px 12px",
                                fontSize: 11,
                                letterSpacing: "0.1em",
                                color: color.textSecondary,
                                textTransform: "uppercase" as const,
                              }}
                            >
                              Amount Paid
                            </td>
                            <td
                              align="right"
                              style={{
                                padding: "10px 12px",
                                fontSize: 14,
                                fontWeight: 800,
                                color: color.textPrimary,
                                textAlign: "right",
                                whiteSpace: "nowrap" as const,
                              }}
                            >
                              {formatMoney(advancePaid)}
                            </td>
                          </tr>
                          {showBalanceAtVenue ? (
                            <tr>
                              <td
                                align="left"
                                style={{
                                  borderTop: color.borderLine,
                                  padding: "10px 12px",
                                  fontSize: 11,
                                  letterSpacing: "0.1em",
                                  color: color.textSubtle,
                                  textTransform: "uppercase" as const,
                                }}
                              >
                                Balance at Venue
                              </td>
                              <td
                                align="right"
                                style={{
                                  borderTop: color.borderLine,
                                  padding: "10px 12px",
                                  fontSize: 14,
                                  fontWeight: 900,
                                  color: bookingEmailColors.brandAccent,
                                  textAlign: "right",
                                  whiteSpace: "nowrap" as const,
                                }}
                              >
                                {formatMoney(remainingPayable)}
                              </td>
                            </tr>
                          ) : null}
                        </tbody>
                      </table>
                    </td>
                  </tr>
                </tbody>
              </table>
            </td>
          </tr>

          <tr>
            <td
              style={{
                padding: "12px 8px",
                backgroundColor: color.panelBg,
                borderTop: color.borderLine,
                color: color.textMuted,
                fontSize: 10,
                letterSpacing: "0.06em",
                fontFamily: bookingEmailFonts.body,
                textAlign: "center",
              }}
            >
              Booking request received &nbsp;·&nbsp; Contact our booking team for support
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
