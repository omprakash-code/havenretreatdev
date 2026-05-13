import { Resend } from "resend";
import { render } from "@react-email/render";

let resendClientCache: Resend | null = null;

function getResendClient() {
  if (resendClientCache) return resendClientCache;

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not defined");
  }

  resendClientCache = new Resend(apiKey);
  return resendClientCache;
}

function getFromEmail() {
  const fromEmail = process.env.FROM_EMAIL;
  if (!fromEmail) {
    throw new Error("FROM_EMAIL is not defined");
  }

  return fromEmail;
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

export async function sendEmail({
  to,
  subject,
  react,
  attachments,
}: SendEmailParams) {
  const html = await render(react);

  await getResendClient().emails.send({
    from: getFromEmail(), // e.g. "Haven Retreat <onboarding@resend.dev>"
    to,
    subject,
    html,
    attachments: attachments && attachments.length > 0 ? attachments : undefined,
  });
}
