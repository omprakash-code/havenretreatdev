import { bookingEmailColors } from "@/emails/theme/booking-email-colors";

type BookingEmailPalette = {
  textSecondary: string;
  textPrimary?: string;
  textSubtle?: string;
  borderLine: string;
  borderDashed?: string;
  cardBg: string;
};

type SectionLabelProps = {
  children: React.ReactNode;
  textColor: string;
};

export function BookingEmailSectionLabel({
  children,
  textColor,
}: SectionLabelProps) {
  return (
    <tr>
      <td colSpan={2} style={{ paddingTop: 16, paddingBottom: 8 }}>
        <table
          role="presentation"
          cellPadding={0}
          cellSpacing={0}
          style={{ width: "100%" }}
        >
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
                    letterSpacing: "0.12em",
                    color: textColor,
                    textTransform: "uppercase",
                    fontWeight: 700,
                  }}
                >
                  {children}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </td>
    </tr>
  );
}

type DataRowProps = {
  label: string;
  value: React.ReactNode;
  labelColor: string;
  valueColor?: string;
  valueWeight?: number;
  last?: boolean;
};

export function BookingEmailDataRow({
  label,
  value,
  labelColor,
  valueColor,
  valueWeight,
  last = false,
}: DataRowProps) {
  return (
    <tr>
      <td
        style={{
          paddingBottom: last ? 0 : 8,
          color: labelColor,
          fontSize: 12,
          verticalAlign: "top",
        }}
      >
        {label}
      </td>
      <td
        align="right"
        style={{
          paddingBottom: last ? 0 : 8,
          color: valueColor,
          fontSize: 12,
          fontWeight: valueWeight,
          verticalAlign: "top",
        }}
      >
        {value}
      </td>
    </tr>
  );
}

type SummaryPanelProps = {
  palette: BookingEmailPalette;
  children: React.ReactNode;
};

export function BookingEmailSummaryPanel({
  palette,
  children,
}: SummaryPanelProps) {
  return (
    <table
      role="presentation"
      cellPadding={0}
      cellSpacing={0}
      style={{
        width: "100%",
        marginBottom: 14,
        backgroundColor: palette.cardBg,
        border: palette.borderLine,
        borderRadius: 6,
      }}
    >
      <tbody>
        <tr>
          <td style={{ padding: "12px" }}>{children}</td>
        </tr>
      </tbody>
    </table>
  );
}

type ActionButtonProps = {
  href: string;
  label: string;
  backgroundColor: string;
  textColor: string;
};

export function BookingEmailCenteredActionButton({
  href,
  label,
  backgroundColor,
  textColor,
}: ActionButtonProps) {
  return (
    <table
      role="presentation"
      cellPadding={0}
      cellSpacing={0}
      style={{ width: "100%" }}
    >
      <tbody>
        <tr>
          <td align="center">
            <table
              role="presentation"
              align="center"
              cellPadding={0}
              cellSpacing={0}
            >
              <tbody>
                <tr>
                  <td
                    style={{
                      backgroundColor,
                      borderRadius: 4,
                    }}
                  >
                    <a
                      href={href}
                      style={{
                        display: "inline-block",
                        padding: "10px 14px",
                        color: textColor,
                        textDecoration: "none",
                        fontSize: 12,
                        fontWeight: 800,
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                      }}
                    >
                      {label}
                    </a>
                  </td>
                </tr>
              </tbody>
            </table>
          </td>
        </tr>
      </tbody>
    </table>
  );
}
