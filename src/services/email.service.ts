import { Resend } from "resend";
import { render } from "@react-email/render";

let resendClientCache: { apiKey: string; client: Resend } | null = null;
const RESEND_TIMEOUT_MS =
  process.env.NODE_ENV === "development" ? 3000 : 10000;

function getResendClient(apiKey: string) {
  if (resendClientCache?.apiKey === apiKey) return resendClientCache.client;

  const client = new Resend(apiKey);
  resendClientCache = { apiKey, client };
  return client;
}

export type EmailAttachment = {
  filename: string;
  content: string | Buffer;
  contentType?: string;
};

type SendEmailParams = {
  to: string;
  subject: string;
  react: React.ReactElement;
  attachments?: EmailAttachment[];
};

export function isEmailConfigured() {
  return Boolean(process.env.RESEND_API_KEY?.trim() && process.env.FROM_EMAIL?.trim());
}

export async function sendEmail({
  to,
  subject,
  react,
  attachments,
}: SendEmailParams): Promise<boolean> {
  if (!isEmailConfigured()) {
    return false;
  }

  const apiKey = process.env.RESEND_API_KEY!.trim();
  const fromEmail = process.env.FROM_EMAIL!.trim();
  const html = await render(react);
  const sendPromise = getResendClient(apiKey).emails.send({
    from: fromEmail, // e.g. "Haven Retreat <onboarding@resend.dev>"
    to,
    subject,
    html,
    attachments: attachments && attachments.length > 0 ? attachments : undefined,
  });

  // Resend's SDK reports API failures via the `error` field instead of
  // throwing, so an unchecked send can fail silently.
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const { error } = await Promise.race([
    sendPromise,
    new Promise<never>((_, reject) => {
      timeoutId = setTimeout(
        () =>
          reject(
            new Error(
              `Resend send timed out for "${subject}" after ${RESEND_TIMEOUT_MS}ms`
            )
          ),
        RESEND_TIMEOUT_MS
      );
    }),
  ]).finally(() => {
    if (timeoutId) clearTimeout(timeoutId);
  });

  if (error) {
    throw new Error(
      `Resend send failed for "${subject}": ${error.name}: ${error.message}`
    );
  }

  return true;
}
