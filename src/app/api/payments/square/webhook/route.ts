import { bookingErrorResponse } from "@/lib/booking-api-response";
import {
  SquareServerError,
  verifySquareWebhookSignature,
} from "@/lib/square/server";
import { finalizeSquarePayment } from "@/services/booking/square-payment-finalizer.service";
import { sendRangeBookingConfirmationEmails } from "@/services/booking/range-booking-confirmation-email.service";

type SquareWebhookPayload = {
  type?: string;
  data?: {
    object?: {
      payment?: {
        id?: string;
        order_id?: string;
        status?: string;
        amount_money?: {
          amount?: number;
        };
      };
    };
  };
};

function resolveNotificationUrl(req: Request) {
  const configured = process.env.SQUARE_WEBHOOK_URL?.trim();
  if (configured) return configured;

  const url = new URL(req.url);
  return `${url.origin}${url.pathname}`;
}

export async function POST(req: Request) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-square-hmacsha256-signature");

  try {
    const validSignature = verifySquareWebhookSignature({
      rawBody,
      signature,
      notificationUrl: resolveNotificationUrl(req),
    });

    if (!validSignature) {
      return bookingErrorResponse(403, "UNAUTHORIZED", "Invalid Square webhook signature.");
    }

    const payload = JSON.parse(rawBody) as SquareWebhookPayload;
    const payment = payload.data?.object?.payment;

    if (
      payload.type !== "payment.created" &&
      payload.type !== "payment.updated"
    ) {
      return Response.json({ success: true, ignored: true });
    }

    if (!payment?.id || !payment.order_id) {
      console.warn("SQUARE_WEBHOOK_PAYMENT_REFERENCE_MISSING", {
        eventType: payload.type,
      });
      return Response.json({ success: true, ignored: true });
    }

    if (payment.status !== "COMPLETED") {
      console.info("SQUARE_WEBHOOK_PAYMENT_NOT_COMPLETED", {
        eventType: payload.type,
        paymentId: payment.id,
        orderId: payment.order_id,
        status: payment.status,
      });
      return Response.json({ success: true, ignored: true });
    }

    const result = await finalizeSquarePayment({
      orderId: payment.order_id,
      paymentId: payment.id,
      amount: Math.round(Number(payment.amount_money?.amount ?? 0) / 100),
      providerPayload: payload as never,
    });

    if (
      (result.status === "CONFIRMED" || result.status === "ALREADY_CONFIRMED") &&
      result.bookingId &&
      result.successToken
    ) {
      void sendRangeBookingConfirmationEmails({
        bookingId: result.bookingId,
        successToken: result.successToken,
        confirmationSource: "SQUARE_WEBHOOK",
      }).catch((err) => {
        console.error("SQUARE_WEBHOOK_EMAIL_FAILED", err);
      });
    }

    return Response.json({ success: true, result });
  } catch (error) {
    console.error("SQUARE_WEBHOOK_ERROR", error);

    if (error instanceof SquareServerError) {
      return bookingErrorResponse(500, "SQUARE_WEBHOOK_CONFIG_ERROR", error.message);
    }

    return bookingErrorResponse(500, "SQUARE_WEBHOOK_FAILED", "Failed to process Square webhook.");
  }
}
