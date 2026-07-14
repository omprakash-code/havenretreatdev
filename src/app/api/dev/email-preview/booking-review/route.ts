import { NextResponse } from "next/server";
import { render } from "@react-email/render";

import BookingReviewEmail, {
  type BookingReviewEmailProps,
  type BookingReviewEmailVariant,
} from "@/emails/BookingReviewEmail";

const VARIANTS: BookingReviewEmailVariant[] = [
  "SUBMITTED",
  "ADMIN_SUBMITTED",
  "APPROVED",
  "REJECTED",
];

function buildSampleData(
  variant: BookingReviewEmailVariant
): BookingReviewEmailProps {
  return {
    variant,
    bookingRef: "HR0714202600001",
    customerName: "Om Prakash",
    customerPhone: "9876543210",
    customerEmail: "omprakash@example.com",
    theatreName: "Premium Package",
    locationName: "Miami",
    date: "Tue, 14 Jul 2026",
    timeSlot: "09:00 AM - 01:00 PM",
    guestCount: 40,
    occasionLabel: "Birthday",
    decorationRequired: true,
    totalAmount: 1456,
    agreementSigned: true,
    rejectionReason:
      variant === "REJECTED"
        ? "The venue is unavailable for the requested date."
        : null,
    actionUrl: "https://example.com/booking/success?t=preview-token",
    actionLabel:
      variant === "REJECTED"
        ? "Contact Us"
        : variant === "APPROVED"
          ? "View Your Booking"
          : "View Booking",
  };
}

export async function GET(req: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { success: false, message: "Not available in production." },
      { status: 404 }
    );
  }

  const { searchParams } = new URL(req.url);
  const requested = (searchParams.get("variant") ?? "APPROVED").toUpperCase();
  const variant = VARIANTS.includes(requested as BookingReviewEmailVariant)
    ? (requested as BookingReviewEmailVariant)
    : "APPROVED";

  const html = await render(BookingReviewEmail(buildSampleData(variant)), {
    pretty: true,
  });

  return new NextResponse(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Email-Variant": variant,
    },
  });
}
