import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { bookingErrorResponse } from "@/lib/booking-api-response";
import { isValidPhone, normalizePhone } from "@/lib/phone";

type ContactSubmitPayload = {
  name?: string;
  mobile?: string;
  message?: string;
};

function normalizeText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as ContactSubmitPayload;

    const name = normalizeText(String(body.name ?? ""));
    const mobile = normalizePhone(String(body.mobile ?? ""));
    const message = normalizeText(String(body.message ?? ""));

    if (name.length < 2) {
      return bookingErrorResponse(400, "INVALID_REQUEST", "Enter a valid name.");
    }

    if (!isValidPhone(mobile)) {
      return bookingErrorResponse(
        400,
        "INVALID_REQUEST",
        "Enter a valid 10-digit mobile number."
      );
    }

    if (message.length < 5) {
      return bookingErrorResponse(
        400,
        "INVALID_REQUEST",
        "Message should be at least 5 characters long."
      );
    }

    if (message.length > 2000) {
      return bookingErrorResponse(
        400,
        "INVALID_REQUEST",
        "Message is too long. Please keep it under 2000 characters."
      );
    }

    await prisma.contactInquiry.create({
      data: {
        name,
        mobile,
        message,
        status: "NEW",
        isRead: false,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("POST /api/contact/submit error:", error);
    return bookingErrorResponse(
      500,
      "INTERNAL_ERROR",
      "Failed to submit contact inquiry."
    );
  }
}
