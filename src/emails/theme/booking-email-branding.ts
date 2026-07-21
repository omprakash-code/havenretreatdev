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
const EMAIL_ASSET_BASE_URL = "https://book.havenretreatmiami.com";

function canEmailClientLoadBaseUrl(baseUrl: string) {
  try {
    const hostname = new URL(baseUrl).hostname.toLowerCase();
    return !["localhost", "127.0.0.1", "0.0.0.0", "::1"].includes(hostname);
  } catch {
    return false;
  }
}

const emailAssetBaseUrl =
  resolvedBaseUrl && canEmailClientLoadBaseUrl(resolvedBaseUrl)
    ? resolvedBaseUrl
    : EMAIL_ASSET_BASE_URL;

export const BOOKING_EMAIL_BRAND_LOGO_URL =
  `${emailAssetBaseUrl}${BRAND_LOGO_PATH}`;
