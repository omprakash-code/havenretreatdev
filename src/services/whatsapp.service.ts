import { appLogger } from "@/lib/app-logger";

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

type WhatsAppConfigState =
  | { state: "disabled"; reason: "flag_disabled" | "missing_config" }
  | {
      state: "configured";
      phoneNumberId: string;
      accessToken: string;
      templateImageUrl: string;
    };

function resolveWhatsAppConfig(isTestMode: boolean): WhatsAppConfigState {
  if (String(process.env.WHATSAPP_ENABLED ?? "").toLowerCase() === "false") {
    return { state: "disabled", reason: "flag_disabled" };
  }

  const phoneNumberId = (
    process.env.WHATSAPP_PHONE_NUMBER_ID ??
    process.env.PHONE_NUMBER_ID ??
    ""
  ).trim();
  const accessToken = (
    process.env.WHATSAPP_TOKEN ??
    process.env.WHATSAPP_ACCESS_TOKEN ??
    ""
  ).trim();
  const templateImageUrl = (process.env.WHATSAPP_TEMPLATE_IMAGE_URL ?? "").trim();

  if (!phoneNumberId || !accessToken) {
    return { state: "disabled", reason: "missing_config" };
  }
  if (!isTestMode && !templateImageUrl) {
    return { state: "disabled", reason: "missing_config" };
  }

  return { state: "configured", phoneNumberId, accessToken, templateImageUrl };
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
  appLogger.error("WHATSAPP_AUTH_FAILED", {
    message: error.message ?? "Unknown auth error",
    code: error.code ?? null,
    errorSubcode: error.error_subcode ?? null,
    fbtraceId: error.fbtrace_id ?? null,
    action: "Refresh WHATSAPP_TOKEN in production environment.",
  });
}

function logWhatsAppApiError(error: WhatsAppApiError | undefined) {
  if (!error) {
    appLogger.warn("WHATSAPP_SEND_FAILED", {
      message: "Unknown API error response",
    });
    return;
  }

  if (isAuthExpiredError(error)) {
    logAuthExpiredError(error);
    return;
  }

  if (isTestRecipientError(error)) {
    appLogger.warn("WHATSAPP_TEST_RECIPIENT_NOT_ALLOWED", {
      message: error.message ?? "Recipient phone number is not whitelisted.",
      code: error.code ?? null,
      errorSubcode: error.error_subcode ?? null,
      action:
        "Add this number as a test recipient in Meta Dashboard or use a real business number for production.",
    });
    return;
  }

  appLogger.warn("WHATSAPP_SEND_FAILED", {
    message: error.message ?? "Unknown API error",
    type: error.type ?? null,
    code: error.code ?? null,
    errorSubcode: error.error_subcode ?? null,
    fbtraceId: error.fbtrace_id ?? null,
  });
}

export async function sendBookingConfirmationWhatsApp(
  data: WhatsAppBookingData
): Promise<boolean> {
  if (!data.phone) return false;

  const isTestMode = process.env.WHATSAPP_TEST_MODE === "true";
  const config = resolveWhatsAppConfig(isTestMode);
  if (config.state === "disabled") return false;

  const url = `https://graph.facebook.com/v18.0/${config.phoneNumberId}/messages`;

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
                    link: config.templateImageUrl,
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

  const timeoutMs = process.env.NODE_ENV === "development" ? 2500 : 8000;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (res.ok) {
      return true;
    }

    const responseBody = (await res.json().catch(() => null)) as WhatsAppApiErrorResponse | null;
    logWhatsAppApiError(responseBody?.error);
    return false;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      appLogger.warn("WHATSAPP_REQUEST_TIMEOUT", { timeoutMs });
      return false;
    }

    appLogger.warn("WHATSAPP_REQUEST_FAILED", {
      message: error instanceof Error ? error.message : "Unknown network error",
    });
    return false;
  } finally {
    clearTimeout(timeoutId);
  }
}
