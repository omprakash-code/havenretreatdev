import crypto from "crypto";
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { timingSafeEqualString } from "@/lib/security/timingSafeEqual";

import { POST as verifyPaymentPost } from "../verify/route";

type RazorpayPaymentEntity = {
  id?: string;
  order_id?: string;
  status?: string;
  amount?: number;
  method?: string;
  notes?: Record<string, unknown>;
  error_code?: string;
  error_description?: string;
};

type RazorpayWebhookPayload = {
  event?: string;
  payload?: {
    payment?: {
      entity?: RazorpayPaymentEntity;
    };
  };
};

function getWebhookSecret() {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error("RAZORPAY_WEBHOOK_SECRET is not configured");
  }
  return secret;
}

function getRazorpayKeySecret() {
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret) {
    throw new Error("RAZORPAY_KEY_SECRET is not configured");
  }
  return secret;
}

function normalizeMethod(method: string | undefined) {
  const cleaned = (method ?? "UNKNOWN")
    .toUpperCase()
    .replace(/[^A-Z0-9_]/g, "_")
    .slice(0, 32);

  return cleaned.length > 0 ? cleaned : "UNKNOWN";
}

function normalizeErrorCode(errorCode: string | undefined) {
  const cleaned = (errorCode ?? "UNKNOWN")
    .toUpperCase()
    .replace(/[^A-Z0-9_]/g, "_")
    .slice(0, 48);

  return cleaned.length > 0 ? cleaned : "UNKNOWN";
}

async function resolveBookingByPaymentEntity(payment: RazorpayPaymentEntity) {
  const orderId = payment.order_id?.trim();
  if (orderId) {
    const booking = await prisma.booking.findFirst({
      where: { razorpayOrderId: orderId },
      select: {
        id: true,
        bookingStatus: true,
        paymentStatus: true,
        razorpayPaymentId: true,
      },
    });
    if (booking) return booking;
  }

  const bookingIdFromNotes =
    typeof payment.notes?.bookingId === "string"
      ? payment.notes.bookingId.trim()
      : "";
  if (!bookingIdFromNotes) return null;

  return prisma.booking.findUnique({
    where: { id: bookingIdFromNotes },
    select: {
      id: true,
      bookingStatus: true,
      paymentStatus: true,
      razorpayPaymentId: true,
    },
  });
}

function buildSyntheticCheckoutSignature(orderId: string, paymentId: string) {
  return crypto
    .createHmac("sha256", getRazorpayKeySecret())
    .update(`${orderId}|${paymentId}`)
    .digest("hex");
}

async function handlePaymentCaptured(payment: RazorpayPaymentEntity) {
  const paymentId = payment.id?.trim() ?? "";
  const orderId = payment.order_id?.trim() ?? "";

  if (!paymentId || !orderId) {
    return {
      handled: false,
      reason: "MISSING_PAYMENT_IDENTIFIERS",
    } as const;
  }

  const booking = await resolveBookingByPaymentEntity(payment);
  if (!booking) {
    return {
      handled: false,
      reason: "BOOKING_NOT_FOUND",
    } as const;
  }

  if (
    booking.bookingStatus === "CONFIRMED" &&
    booking.paymentStatus === "PAID" &&
    booking.razorpayPaymentId === paymentId
  ) {
    return {
      handled: true,
      reason: "ALREADY_CONFIRMED",
    } as const;
  }

  const verifyRequest = new Request("http://localhost/api/payments/razorpay/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      bookingId: booking.id,
      razorpay_order_id: orderId,
      razorpay_payment_id: paymentId,
      razorpay_signature: buildSyntheticCheckoutSignature(orderId, paymentId),
    }),
  });

  const verifyResponse = await verifyPaymentPost(verifyRequest);
  const verifyJson = (await verifyResponse.json().catch(() => null)) as
    | {
        success?: boolean;
        code?: string;
        message?: string;
      }
    | null;

  if (!verifyResponse.ok && verifyResponse.status >= 500) {
    return {
      handled: false,
      reason: "VERIFY_FAILED_RETRYABLE",
      status: verifyResponse.status,
      code: verifyJson?.code,
      message: verifyJson?.message,
    } as const;
  }

  return {
    handled: true,
    reason: verifyResponse.ok ? "VERIFIED" : "VERIFY_REJECTED",
    status: verifyResponse.status,
    code: verifyJson?.code,
    message: verifyJson?.message,
  } as const;
}

async function handlePaymentFailed(payment: RazorpayPaymentEntity) {
  const paymentId = payment.id?.trim() ?? "";
  const booking = await resolveBookingByPaymentEntity(payment);
  if (!booking) {
    return {
      handled: false,
      reason: "BOOKING_NOT_FOUND",
    } as const;
  }

  const amountInRupees = Number.isFinite(Number(payment.amount))
    ? Math.max(Math.round(Number(payment.amount) / 100), 0)
    : 0;
  const methodTag = normalizeMethod(payment.method);
  const errorCodeTag = normalizeErrorCode(payment.error_code);
  const reasonTag = payment.error_description
    ? payment.error_description
        .toUpperCase()
        .replace(/[^A-Z0-9_]/g, "_")
        .slice(0, 90)
    : "UNSPECIFIED";
  const taggedMethod = `RAZORPAY_FAIL|M:${methodTag}|E:${errorCodeTag}|R:${reasonTag}`;

  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw<{ id: string }[]>(Prisma.sql`
      SELECT id
      FROM "Booking"
      WHERE id = ${booking.id}
      FOR UPDATE
    `);

    const fresh = await tx.booking.findUnique({
      where: { id: booking.id },
      select: {
        id: true,
        bookingStatus: true,
        paymentStatus: true,
      },
    });

    if (!fresh) return;

    const bookingIsPaid =
      fresh.bookingStatus === "CONFIRMED" &&
      fresh.paymentStatus === "PAID";
    if (bookingIsPaid) return;

    await tx.booking.update({
      where: { id: fresh.id },
      data: {
        bookingStatus: "AWAITING_PAYMENT",
        paymentStatus: "FAILED",
      },
    });

    if (paymentId) {
      const existingAttempt = await tx.payment.findFirst({
        where: {
          bookingId: fresh.id,
          provider: "RAZORPAY",
          transactionId: paymentId,
        },
        orderBy: { createdAt: "desc" },
        select: { id: true },
      });

      if (existingAttempt) {
        await tx.payment.update({
          where: { id: existingAttempt.id },
          data: {
            status: "FAILED",
            method: taggedMethod,
          },
        });
      } else {
        await tx.payment.create({
          data: {
            bookingId: fresh.id,
            provider: "RAZORPAY",
            method: taggedMethod,
            transactionId: paymentId,
            amount: amountInRupees,
            status: "FAILED",
          },
        });
      }
    }
  });

  return {
    handled: true,
    reason: "FAILED_STATE_RECORDED",
  } as const;
}

function verifyWebhookSignature(rawBody: string, providedSignature: string) {
  const expected = crypto
    .createHmac("sha256", getWebhookSecret())
    .update(rawBody)
    .digest("hex");

  return timingSafeEqualString(expected, providedSignature);
}

export async function POST(req: Request) {
  try {
    const signature = req.headers.get("x-razorpay-signature") ?? "";
    if (!signature) {
      return NextResponse.json(
        { success: false, code: "MISSING_SIGNATURE" },
        { status: 401 }
      );
    }

    const rawBody = await req.text();
    if (!verifyWebhookSignature(rawBody, signature)) {
      return NextResponse.json(
        { success: false, code: "INVALID_SIGNATURE" },
        { status: 401 }
      );
    }

    const payload = JSON.parse(rawBody) as RazorpayWebhookPayload;
    const event = payload.event ?? "";
    const payment = payload.payload?.payment?.entity;

    if (!payment) {
      return NextResponse.json({
        success: true,
        handled: false,
        reason: "NO_PAYMENT_ENTITY",
      });
    }

    if (event === "payment.captured") {
      const result = await handlePaymentCaptured(payment);
      if (!result.handled && result.reason === "VERIFY_FAILED_RETRYABLE") {
        return NextResponse.json(
          { success: false, ...result },
          { status: 500 }
        );
      }

      return NextResponse.json({ success: true, ...result });
    }

    if (event === "payment.failed") {
      const result = await handlePaymentFailed(payment);
      return NextResponse.json({ success: true, ...result });
    }

    return NextResponse.json({
      success: true,
      handled: false,
      reason: "EVENT_IGNORED",
      event,
    });
  } catch (error) {
    console.error("RAZORPAY_WEBHOOK_ERROR", error);
    return NextResponse.json(
      { success: false, code: "WEBHOOK_PROCESSING_FAILED" },
      { status: 500 }
    );
  }
}
