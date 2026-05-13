import { NextResponse } from "next/server";
import { render } from "@react-email/render";

import type { BookingConfirmationEmailProps } from "@/emails/BookingConfirmationEmail";
import {
  renderBookingConfirmationEmail,
  resolveBookingConfirmationEmailTheme,
} from "@/emails/renderBookingConfirmationEmail";

function buildSampleData(): BookingConfirmationEmailProps {
  return {
    bookingRef: "HR270220260043",
    customerName: "Om Prakash",
    customerPhone: "9876543210",
    customerEmail: "omprakash@example.com",
    theatreName: "Haven Retreat - Theatre 1",
    locationName: "Miami",
    date: "Fri, 27 Feb 2026",
    timeSlot: "07:00 PM - 10:00 PM",
    guestCount: 6,
    occasionLabel: "Birthday",
    occasionDetails: [
      { label: "name", value: "Aarav" },
      { label: "age", value: "8" },
    ],
    addonItems: [
      {
        name: "LED Number",
        variantLabel: "Premium",
        quantity: 1,
        totalPrice: 499,
        numberValue: "24",
      },
      {
        name: "Number Balloon Tower",
        variantLabel: "Standard",
        quantity: 1,
        totalPrice: 699,
        numberValue: "26",
      },
      {
        name: "Chocolate Cake",
        variantLabel: "1 Kg",
        quantity: 1,
        totalPrice: 1299,
      },
    ],
    paymentType: "ONLINE",
    paymentMethod: "RAZORPAY",
    paymentStatus: "PAID",
    paymentReference: "pay_Q1A2B3C4D5",
    baseAmount: 2999,
    extrasAmount: 1200,
    productsAmount: 2497,
    decorationAmount: 750,
    discountAmount: 500,
    totalAmount: 6946,
    advancePaid: 3000,
    remainingPayable: 3946,
    successUrl: "https://Havenretreat.buildom.in/booking/success?t=preview-token",
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
  const themeOverride = searchParams.get("theme");
  const resolvedTheme = resolveBookingConfirmationEmailTheme(
    themeOverride ?? process.env.BOOKING_EMAIL_THEME
  );

  const html = await render(
    renderBookingConfirmationEmail(buildSampleData(), resolvedTheme),
    {
      pretty: true,
    }
  );

  return new NextResponse(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Email-Theme": resolvedTheme,
    },
  });
}
