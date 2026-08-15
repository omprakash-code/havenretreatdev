import { BOOKING_EMAIL_BRAND_LOGO_URL } from "@/emails/theme/booking-email-branding";
import BookingEmailFontStyles from "@/emails/components/BookingEmailFontStyles";
import { bookingEmailColors, bookingEmailFonts } from "@/emails/theme/booking-email-colors";

/** One size on every device — no breakpoint, so no client can get it wrong. */
const LOGO_WIDTH = 104;
const LOGO_HEIGHT = 59; // 168x95 kept in proportion

/** The header band is white in every template, so its ink is always dark. */
export const BOOKING_EMAIL_HEADER_TEXT = "#111827";

type BookingEmailHeaderProps = {
  title: string;
  eyebrow: string;
  backgroundColor: string;
  logoBorder: string;
  fallbackBackgroundColor?: string;
  fallbackTextColor?: string;
  /** Render the title as a monospace reference chip (for booking refs). */
  referenceTitle?: boolean;
};

/**
 * The header every booking email shares: logo centred on top, status beneath
 * it, reference beneath that.
 *
 * It is a single-column table of three stacked rows. Nothing is placed side by
 * side and there is no media query, no flexbox and no ordering trick, so every
 * client — Gmail mobile included — renders the same stack. Centring is declared
 * twice on each cell, once as the `align` attribute for clients that strip CSS
 * and once as `text-align` for those that do not.
 */
export default function BookingEmailHeader({
  title,
  eyebrow,
  backgroundColor,
  logoBorder,
  fallbackBackgroundColor = BOOKING_EMAIL_HEADER_TEXT,
  fallbackTextColor = bookingEmailColors.brandAccent,
  referenceTitle = false,
}: BookingEmailHeaderProps) {
  return (
    <tr>
      <td
        className="hr-email-header"
        align="center"
        style={{
          backgroundColor,
          padding: "20px 12px 18px",
          textAlign: "center",
        }}
      >
        <BookingEmailFontStyles />
        <table
          role="presentation"
          cellPadding={0}
          cellSpacing={0}
          width="100%"
          style={{ width: "100%" }}
        >
          <tbody>
            <tr>
              <td
                align="center"
                className="hr-email-logo-cell"
                style={{
                  textAlign: "center",
                  fontSize: 0,
                  lineHeight: 0,
                  paddingBottom: 12,
                }}
              >
                {BOOKING_EMAIL_BRAND_LOGO_URL ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={BOOKING_EMAIL_BRAND_LOGO_URL}
                    alt=""
                    width={LOGO_WIDTH}
                    height={LOGO_HEIGHT}
                    className="hr-email-logo"
                    style={{
                      width: LOGO_WIDTH,
                      height: LOGO_HEIGHT,
                      maxWidth: "100%",
                      margin: "0 auto",
                      display: "block",
                      border: 0,
                      objectFit: "contain",
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: 52,
                      height: 52,
                      borderRadius: 6,
                      border: logoBorder,
                      backgroundColor: fallbackBackgroundColor,
                      display: "inline-block",
                      fontSize: 16,
                      fontWeight: 800,
                      color: fallbackTextColor,
                      letterSpacing: "0.08em",
                      lineHeight: "52px",
                      textAlign: "center",
                    }}
                  >
                    DS
                  </div>
                )}
              </td>
            </tr>

            <tr>
              <td
                align="center"
                className="hr-email-title-cell"
                style={{ textAlign: "center" }}
              >
                <p
                  className="hr-email-header-text"
                  style={{
                    margin: 0,
                    fontSize: 10,
                    letterSpacing: "0.2em",
                    color: BOOKING_EMAIL_HEADER_TEXT,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    textAlign: "center",
                  }}
                >
                  {eyebrow}
                </p>
              </td>
            </tr>

            <tr>
              <td
                align="center"
                className="hr-email-title-cell"
                style={{ textAlign: "center" }}
              >
                {referenceTitle ? (
                  <h1
                    className="hr-email-header-text hr-email-header-title"
                    style={{
                      margin: "6px 0 0",
                      fontSize: 16,
                      fontWeight: 700,
                      letterSpacing: "0.08em",
                      lineHeight: 1.3,
                      color: BOOKING_EMAIL_HEADER_TEXT,
                      fontFamily: bookingEmailFonts.mono,
                      // Free to wrap: a reference must never clip on a narrow
                      // screen, and it is centred so wrapping still reads well.
                      wordBreak: "break-word",
                      textAlign: "center",
                    }}
                  >
                    {title}
                  </h1>
                ) : (
                  <h1
                    className="hr-email-header-text hr-email-header-title"
                    style={{
                      margin: "6px 0 0",
                      fontSize: 22,
                      fontWeight: 900,
                      color: BOOKING_EMAIL_HEADER_TEXT,
                      letterSpacing: "-0.02em",
                      lineHeight: 1.15,
                      fontFamily: bookingEmailFonts.heading,
                      wordBreak: "break-word",
                      textAlign: "center",
                    }}
                  >
                    {title}
                  </h1>
                )}
              </td>
            </tr>
          </tbody>
        </table>
      </td>
    </tr>
  );
}
