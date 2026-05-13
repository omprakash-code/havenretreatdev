type WhatsAppBookingData = {
  phone: string;
  customerName: string;
  bookingRef: string;
  location: string;
  theatre: string;
  dateTime: string;
  guests: string;
  totalAmount: string;
  advancePaid: string;
  payAtTheatre: string;
  bookingUrl: string;
};

type WhatsAppApiError = {
  message?: string;
  type?: string;
  code?: number;
  error_subcode?: number;
  fbtrace_id?: string;
};

type WhatsAppApiErrorResponse = {
  error?: WhatsAppApiError;
};

const WHATSAPP_AUTH_EXPIRED_SUBCODE = 463;
const WHATSAPP_TEST_RECIPIENT_SUBCODE = 131030;
const AUTH_EXPIRED_LOG_SUPPRESSION_MS = 15 * 60 * 1000;

let lastWhatsAppAuthExpiredLogAt = 0;

function logMissingWhatsAppConfig() {
  if (!process.env.WHATSAPP_PHONE_NUMBER_ID) {
    console.error("[WHATSAPP] Missing phone number id.");
    return true;
  }

  if (!process.env.WHATSAPP_TOKEN) {
    console.error("[WHATSAPP] Missing access token.");
    return true;
  }

  if (!process.env.WHATSAPP_TEMPLATE_IMAGE_URL) {
    console.error("[WHATSAPP] Missing template header image URL.");
    return true;
  }

  return false;
}

function isAuthExpiredError(error: WhatsAppApiError | undefined) {
  return error?.code === 190 && error?.error_subcode === WHATSAPP_AUTH_EXPIRED_SUBCODE;
}

function isTestRecipientError(error: WhatsAppApiError | undefined) {
  return error?.code === WHATSAPP_TEST_RECIPIENT_SUBCODE;
}

function logAuthExpiredError(error: WhatsAppApiError) {
  const now = Date.now();
  if (now - lastWhatsAppAuthExpiredLogAt < AUTH_EXPIRED_LOG_SUPPRESSION_MS) {
    return;
  }

  lastWhatsAppAuthExpiredLogAt = now;
  console.error("[WHATSAPP] Access token expired.", {
    message: error.message ?? "Unknown auth error",
    code: error.code ?? null,
    errorSubcode: error.error_subcode ?? null,
    fbtraceId: error.fbtrace_id ?? null,
    action: "Refresh WHATSAPP_TOKEN in production environment.",
  });
}

function logWhatsAppApiError(error: WhatsAppApiError | undefined) {
  if (!error) {
    console.error("[WHATSAPP] Send failed with an unknown API error response.");
    return;
  }

  if (isAuthExpiredError(error)) {
    logAuthExpiredError(error);
    return;
  }

  if (isTestRecipientError(error)) {
    console.warn(
      "[WHATSAPP][TEST_MODE] Message NOT sent. " +
        "Reason: Recipient phone number is not whitelisted. " +
        "Action: Add this number as a test recipient in Meta Dashboard " +
        "or use a real business number for production."
    );
    return;
  }

  console.error("[WHATSAPP] Send failed", {
    message: error.message ?? "Unknown API error",
    type: error.type ?? null,
    code: error.code ?? null,
    errorSubcode: error.error_subcode ?? null,
    fbtraceId: error.fbtrace_id ?? null,
  });
}

export async function sendBookingConfirmationWhatsApp(data: WhatsAppBookingData) {
  if (!data.phone) return;
  if (logMissingWhatsAppConfig()) return;

  const isTestMode = process.env.WHATSAPP_TEST_MODE === "true";
  const url = `https://graph.facebook.com/v18.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;

  const payload = isTestMode
    ? {
        messaging_product: "whatsapp",
        to: data.phone,
        type: "template",
        template: {
          name: "hello_world",
          language: { code: "en_US" },
        },
      }
    : {
        messaging_product: "whatsapp",
        to: data.phone,
        type: "template",
        template: {
          name: "booking_confirmation",
          language: { code: "en" },
          components: [
            {
              type: "header",
              parameters: [
                {
                  type: "image",
                  image: {
                    link: process.env.WHATSAPP_TEMPLATE_IMAGE_URL!,
                  },
                },
              ],
            },
            {
              type: "body",
              parameters: [
                { type: "text", text: data.customerName },
                { type: "text", text: data.bookingRef },
                { type: "text", text: data.location },
                { type: "text", text: data.theatre },
                { type: "text", text: data.dateTime },
                { type: "text", text: data.guests },
                { type: "text", text: data.totalAmount },
                { type: "text", text: data.advancePaid },
                { type: "text", text: data.payAtTheatre },
              ],
            },
            {
              type: "button",
              sub_type: "url",
              index: "0",
              parameters: [{ type: "text", text: data.bookingRef }],
            },
          ],
        },
      };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (res.ok) {
      return;
    }

    const responseBody = (await res.json().catch(() => null)) as WhatsAppApiErrorResponse | null;
    logWhatsAppApiError(responseBody?.error);
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      console.error("[WHATSAPP] Request timed out after 8000ms.");
      return;
    }

    console.error("[WHATSAPP] Request failed", {
      message: error instanceof Error ? error.message : "Unknown network error",
    });
  } finally {
    clearTimeout(timeoutId);
  }
}
