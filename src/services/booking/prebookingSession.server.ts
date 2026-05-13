import crypto from "crypto";

let sessionSecretCache: string | null = null;

function getSessionSecret() {
  if (sessionSecretCache) return sessionSecretCache;

  const secret = process.env.BOOKING_SESSION_SECRET;
  if (!secret) {
    throw new Error("BOOKING_SESSION_SECRET is not defined");
  }

  sessionSecretCache = secret;
  return secret;
}

function sign(value: string) {
  return crypto
    .createHmac("sha256", getSessionSecret())
    .update(value)
    .digest("hex");
}

type PrebookingPayload = {
  locationId: string;
  locationName: string;
  city?: string;
  date: string; // ISO string
};

export function createPrebookingToken(
  payload: PrebookingPayload
) {
  const raw = JSON.stringify(payload);
  const signature = sign(raw);
  return Buffer.from(`${raw}.${signature}`).toString("base64");
}

export function verifyPrebookingToken(token: string) {
  try {
    const decoded = Buffer.from(token, "base64").toString("utf8");
    const lastDot = decoded.lastIndexOf(".");
    if (lastDot === -1) return null;

    const raw = decoded.slice(0, lastDot);
    const signature = decoded.slice(lastDot + 1);

    const expected = sign(raw);
    if (expected !== signature) return null;

    return JSON.parse(raw) as PrebookingPayload;
  } catch {
    return null;
  }
}
