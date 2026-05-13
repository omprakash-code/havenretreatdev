const resolvedBaseUrl = (() => {
  const nextPublic = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (nextPublic) return nextPublic.replace(/\/+$/, "");

  const appUrl = process.env.APP_URL?.trim();
  if (appUrl) return appUrl.replace(/\/+$/, "");

  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) return `https://${vercel.replace(/\/+$/, "")}`;

  return "";
})();

const BRAND_LOGO_PATH = "/assets/email-ds-logo.png";

export const BOOKING_EMAIL_BRAND_LOGO_URL =
  process.env.NODE_ENV === "production"
    ? resolvedBaseUrl
      ? `${resolvedBaseUrl}${BRAND_LOGO_PATH}`
      : BRAND_LOGO_PATH
    : BRAND_LOGO_PATH;
