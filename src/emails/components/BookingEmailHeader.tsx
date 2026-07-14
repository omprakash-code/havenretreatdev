import { BOOKING_EMAIL_BRAND_LOGO_URL } from "@/emails/theme/booking-email-branding";
import BookingEmailFontStyles from "@/emails/components/BookingEmailFontStyles";
import { bookingEmailColors, bookingEmailFonts } from "@/emails/theme/booking-email-colors";

type BookingEmailHeaderProps = {
  title: string;
  eyebrow: string;
  backgroundColor: string;
  textColor: string;
  logoBorder: string;
  fallbackBackgroundColor?: string;
  fallbackTextColor?: string;
  /** Render the title as a monospace reference chip (for booking refs). */
  referenceTitle?: boolean;
};

export default function BookingEmailHeader({
  title,
  eyebrow,
  backgroundColor,
  textColor,
  logoBorder,
  fallbackBackgroundColor = textColor,
  fallbackTextColor = bookingEmailColors.brandAccent,
  referenceTitle = false,
}: BookingEmailHeaderProps) {
  return (
    <tr>
      <td style={{ backgroundColor, padding: "14px 12px 12px" }}>
        <BookingEmailFontStyles />
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
                    color: textColor,
                    fontWeight: 700,
                    textTransform: "uppercase",
                  }}
                >
                  {eyebrow}
                </p>
                {referenceTitle ? (
                  <h1
                    style={{
                      margin: "8px 0 0",
                      fontSize: 16,
                      fontWeight: 700,
                      letterSpacing: "0.08em",
                      lineHeight: 1.2,
                      color: textColor,
                      fontFamily: bookingEmailFonts.mono,
                      whiteSpace: "nowrap" as const,
                    }}
                  >
                    {title}
                  </h1>
                ) : (
                  <h1
                    style={{
                      margin: "6px 0 0",
                      fontSize: 22,
                      fontWeight: 900,
                      color: textColor,
                      letterSpacing: "-0.02em",
                      lineHeight: 1.05,
                      fontFamily: bookingEmailFonts.heading,
                      wordBreak: "break-word",
                    }}
                  >
                    {title}
                  </h1>
                )}
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
                        {BOOKING_EMAIL_BRAND_LOGO_URL ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={BOOKING_EMAIL_BRAND_LOGO_URL}
                            alt=""
                            width={144}
                            height={144}
                            style={{
                              width: 144,
                              height: 144,
                              margin: "-36px 0",
                              display: "block",
                              borderRadius: 100,
                              border: logoBorder,
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
                              backgroundColor: fallbackBackgroundColor,
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: 16,
                              fontWeight: 800,
                              color: fallbackTextColor,
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
  );
}
