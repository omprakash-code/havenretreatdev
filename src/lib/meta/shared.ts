export const META_CONSENT_ACCEPTED = "accepted";
export const META_CONSENT_REJECTED = "rejected";
export const META_DEFAULT_COOKIE_MAX_AGE_DAYS = 90;

export type MetaConsentState =
  | typeof META_CONSENT_ACCEPTED
  | typeof META_CONSENT_REJECTED
  | null;

export type MetaAttributionSnapshot = {
  fbclid?: string;
  fbc?: string;
  fbp?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
  landingPath?: string;
  referrer?: string;
  capturedAt: string;
};

export function sanitizeMetaPayload(
  payload: Record<string, unknown> | undefined
) {
  if (!payload) return {};

  return Object.fromEntries(
    Object.entries(payload).filter(([, value]) => {
      if (value === undefined || value === null) return false;
      if (typeof value === "string") return value.trim().length > 0;
      return true;
    })
  );
}

export function buildMetaPurchaseEventId(input: {
  bookingRef: string;
  paymentReference?: string | null;
}) {
  const reference = input.paymentReference?.trim() || "payment";
  return `purchase:${input.bookingRef}:${reference}`;
}
