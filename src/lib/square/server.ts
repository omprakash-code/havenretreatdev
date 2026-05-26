import crypto from "crypto";
import { timingSafeEqualString } from "@/lib/security/timingSafeEqual";

const SQUARE_API_VERSION = "2026-05-20";

type SquareMoney = {
  amount: number;
  currency: string;
};

type CreateSquarePaymentLinkInput = {
  idempotencyKey: string;
  name: string;
  amount: number;
  currency: string;
  redirectUrl: string;
  bookingId: string;
  bookingRef: string;
};

type SquarePaymentLinkResponse = {
  payment_link?: {
    id?: string;
    url?: string;
    order_id?: string;
  };
  related_resources?: {
    orders?: Array<{ id?: string }>;
  };
  errors?: Array<{ code?: string; detail?: string; field?: string }>;
};

export type SquarePaymentLinkResult = {
  paymentLinkId: string;
  checkoutUrl: string;
  orderId: string;
};

export class SquareServerError extends Error {
  status: number;

  constructor(message: string, status = 500) {
    super(message);
    this.name = "SquareServerError";
    this.status = status;
  }
}

function getSquareEnvironment() {
  const configured = process.env.SQUARE_ENVIRONMENT?.trim().toLowerCase();
  return configured === "production" ? "production" : "sandbox";
}

function getSquareBaseUrl() {
  return getSquareEnvironment() === "production"
    ? "https://connect.squareup.com"
    : "https://connect.squareupsandbox.com";
}

function getSquareCredentials() {
  const accessToken =
    process.env.SQUARE_ACCESS_TOKEN?.trim() || process.env.ACCESS_TOKEN?.trim();
  const locationId = process.env.SQUARE_LOCATION_ID?.trim();

  if (!accessToken || !locationId) {
    throw new SquareServerError("Square payment gateway is not configured.");
  }

  return { accessToken, locationId };
}

export function getSquareCurrency() {
  return process.env.SQUARE_CURRENCY?.trim().toUpperCase() || "USD";
}

export async function createSquarePaymentLink(
  input: CreateSquarePaymentLinkInput
): Promise<SquarePaymentLinkResult> {
  const { accessToken, locationId } = getSquareCredentials();
  const res = await fetch(`${getSquareBaseUrl()}/v2/online-checkout/payment-links`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "Square-Version": SQUARE_API_VERSION,
    },
    body: JSON.stringify({
      idempotency_key: input.idempotencyKey,
      quick_pay: {
        name: input.name,
        price_money: {
          amount: input.amount,
          currency: input.currency,
        } satisfies SquareMoney,
        location_id: locationId,
      },
      checkout_options: {
        redirect_url: input.redirectUrl,
      },
      description: `Haven Retreat booking ${input.bookingRef}`,
      payment_note: `bookingId=${input.bookingId}; bookingRef=${input.bookingRef}`,
    }),
  });

  const json = (await res.json().catch(() => null)) as SquarePaymentLinkResponse | null;

  if (!res.ok || !json?.payment_link?.url || !json.payment_link.id) {
    const squareError = json?.errors?.[0];
    console.warn("SQUARE_PAYMENT_LINK_REJECTED", {
      status: res.status,
      code: squareError?.code,
      field: squareError?.field,
      detail: squareError?.detail,
    });

    throw new SquareServerError(
      squareError?.detail ||
        squareError?.code ||
        "Failed to create Square checkout link.",
      res.status
    );
  }

  const orderId =
    json.payment_link.order_id ||
    json.related_resources?.orders?.find((order) => order.id)?.id;

  if (!orderId) {
    throw new SquareServerError("Square checkout link did not include an order reference.");
  }

  return {
    paymentLinkId: json.payment_link.id,
    checkoutUrl: json.payment_link.url,
    orderId,
  };
}

export function verifySquareWebhookSignature(input: {
  rawBody: string;
  signature: string | null;
  notificationUrl: string;
}) {
  const signatureKey = process.env.SQUARE_WEBHOOK_SIGNATURE_KEY?.trim();
  if (!signatureKey) {
    throw new SquareServerError("Square webhook signature key is not configured.");
  }

  if (!input.signature) return false;

  const expected = crypto
    .createHmac("sha256", signatureKey)
    .update(input.notificationUrl + input.rawBody)
    .digest("base64");

  return timingSafeEqualString(expected, input.signature);
}
