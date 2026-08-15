// Every booking email shares one header.
//
// Two confirmation templates used to duplicate the header markup inline, so a
// header change had to be made in three places and drifted. They now render
// BookingEmailHeader like the other seven, and these tests pin that plus the
// mobile/dark-mode hooks the shared stylesheet targets.

import { describe, expect, it } from "vitest";
import { render } from "@react-email/render";

import BookingConfirmationEmail from "@/emails/BookingConfirmationEmail";
import AdminBookingConfirmationEmail from "@/emails/AdminBookingConfirmationEmail";
import BookingReviewEmail from "@/emails/BookingReviewEmail";
import { renderBookingConfirmationEmail } from "@/emails/renderBookingConfirmationEmail";

const confirmationProps = {
  bookingRef: "HR-TEST-0001",
  customerName: "Header Customer",
  customerPhone: "9998887777",
  theatreName: "Starter Package",
  locationName: "Miami",
  date: "2030-01-01",
  timeSlot: "10:00 - 15:00",
  guestCount: 10,
  occasionDetails: [],
  totalAmount: 675,
  advancePaid: 150,
  remainingPayable: 525,
} as never;

const reviewProps = {
  variant: "SUBMITTED",
  bookingRef: "HR-TEST-0001",
  customerName: "Header Customer",
  theatreName: "Starter Package",
  date: "2030-01-01",
  timeSlot: "10:00 - 15:00",
  guestCount: 10,
  totalAmount: 675,
  agreementSigned: false,
} as never;

const templates: Array<[string, () => Promise<string>]> = [
  [
    "customer confirmation",
    () => render(renderBookingConfirmationEmail(confirmationProps)),
  ],
  [
    "customer confirmation dark preview",
    () => render(BookingConfirmationEmail(confirmationProps)),
  ],
  ["admin confirmation", () => render(AdminBookingConfirmationEmail(confirmationProps))],
  ["customer review", () => render(BookingReviewEmail(reviewProps))],
  [
    "admin review",
    () => render(BookingReviewEmail({ ...(reviewProps as object), variant: "ADMIN_SUBMITTED" } as never)),
  ],
];

/** Just the shared header band, so body markup cannot pollute the assertions. */
function headerOf(html: string) {
  const start = html.indexOf('class="hr-email-header"');
  if (start === -1) return "";
  const end = html.indexOf("</table>", html.indexOf("hr-email-header-title", start));
  return html.slice(start, end === -1 ? undefined : end);
}

function headerTextStyles(html: string) {
  const header = headerOf(html);
  return Array.from(header.matchAll(/class="[^"]*hr-email-header-text[^"]*" style="([^"]*)"/g))
    .map((match) => match[1])
    .join("\n");
}

describe.each(templates)("%s email header", (_name, renderEmail) => {
  it("renders the shared header hooks", async () => {
    const html = await renderEmail();

    expect(html).toContain('class="hr-email-header"');
    expect(html).toContain('class="hr-email-logo-cell"');
    expect(html).toContain('class="hr-email-logo"');
    expect(html).toContain('class="hr-email-title-cell"');
    expect(html).toContain('class="hr-email-header-text"');
    expect(html).toContain("hr-email-header-title");
  });

  it("uses one 104px logo on every device", async () => {
    const html = await renderEmail();

    expect(html).toContain('width="104"');
    expect(html).toContain('height="59"');
    expect(html).toContain("width:104px");
    // The old two-column desktop size must be gone entirely.
    expect(html).not.toContain('width="168"');
    expect(html).not.toContain("width:168px");
  });

  it("stacks logo, status and reference in that order", async () => {
    const html = await renderEmail();

    const logo = html.indexOf('class="hr-email-logo"');
    const eyebrow = html.indexOf('class="hr-email-header-text"');
    const title = html.indexOf("hr-email-header-title");

    expect(logo).toBeGreaterThan(-1);
    expect(eyebrow).toBeGreaterThan(logo);
    expect(title).toBeGreaterThan(eyebrow);
  });

  it("centres every header cell with both an attribute and a style", async () => {
    const html = await renderEmail();

    // align= survives clients that strip CSS; text-align covers the rest.
    expect(html).toContain('align="center"');
    expect(html).toContain("text-align:center");
    expect(html).toContain("margin:0 auto");
  });

  it("has no side-by-side columns left", async () => {
    const header = headerOf(await renderEmail());

    expect(header).not.toContain("width:60%");
    expect(header).not.toContain("width:40%");
    expect(header).not.toContain("table-layout:fixed");
    expect(header).not.toContain('align="right"');
  });

  it("uses no media query or flexbox for the header layout", async () => {
    const html = await renderEmail();

    // Layout must not depend on anything a mail client can drop.
    expect(html).not.toContain("max-width: 480px");
    expect(html).not.toContain("flex-direction");
    expect(html).not.toContain("order: -1");
  });

  it("lets the reference wrap so it never clips", async () => {
    const header = headerOf(await renderEmail());

    expect(header).toContain("word-break:break-word");
    expect(header).not.toContain("white-space:nowrap");
  });

  it("keeps the header white and the dark-mode rules intact", async () => {
    const html = await renderEmail();
    const header = headerOf(html);
    const textStyles = headerTextStyles(html);

    expect(header).toContain("background-color:#ffffff");
    expect(textStyles).toContain("color:#111827");
    expect(textStyles).not.toContain("color:#ffffff");
    expect(textStyles).not.toContain("color:#fff");
    expect(html).toContain("@media (prefers-color-scheme: dark)");
    expect(html).toContain("[data-ogsc]");
    expect(html).toContain("[data-ogsb]");
    expect(html).toContain("color-scheme: light");
    expect(html).toContain("background-color: #ffffff !important");
    expect(html).toContain("color: #111827 !important");
  });

  it("shows both the status text and the booking reference", async () => {
    const header = headerOf(await renderEmail());

    expect(header).toContain("HR-TEST-0001");
  });
});

describe("booking email theme defaults", () => {
  it("renders customer confirmations with the light production theme by default", async () => {
    const html = await render(renderBookingConfirmationEmail(confirmationProps));
    const header = headerOf(html);
    const textStyles = headerTextStyles(html);

    expect(html).toContain("background-color:#f3f4f6");
    expect(header).toContain("background-color:#ffffff");
    expect(textStyles).toContain("color:#111827");
    expect(textStyles).not.toContain("color:#ffffff");
  });

  it("still allows an explicit dark confirmation preview without changing the header ink", async () => {
    const html = await render(renderBookingConfirmationEmail(confirmationProps, "dark"));
    const header = headerOf(html);
    const textStyles = headerTextStyles(html);

    expect(html).toContain("background-color:#0d1117");
    expect(header).toContain("background-color:#ffffff");
    expect(textStyles).toContain("color:#111827");
    expect(textStyles).not.toContain("color:#ffffff");
  });
});

describe("header is defined in exactly one place", () => {
  it("every template emits the same stacked header structure", async () => {
    const rendered = await Promise.all(templates.map(([, r]) => r()));

    for (const html of rendered) {
      expect(html).toContain('class="hr-email-header"');
      expect(html).toContain('class="hr-email-logo-cell"');
      expect(html).toContain('class="hr-email-title-cell"');
      expect(html).toContain("width:104px");
      expect(headerOf(html)).not.toContain("width:60%");
    }
  });
});
