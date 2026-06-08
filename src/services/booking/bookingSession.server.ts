// src/services/booking/bookingSession.server.ts

import crypto from "crypto";
import { timingSafeEqualString } from "@/lib/security/timingSafeEqual";

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

export function createBookingSessionToken(
  bookingId: string,
  lockOwner: string,
  lockVersion?: number
) {
  const payload =
    lockVersion === undefined
      ? `${bookingId}.${lockOwner}`
      : `${bookingId}.${lockOwner}.${lockVersion}`;
  const signature = sign(payload);
  return Buffer.from(`${payload}.${signature}`).toString("base64");
}

export function verifyBookingSessionToken(token: string) {
  try {
    const decoded = Buffer.from(token, "base64").toString("utf8");
    const parts = decoded.split(".");
    if (parts.length !== 3 && parts.length !== 4) return null;

    const [bookingId, lockOwner] = parts;
    const versionPart = parts.length === 4 ? parts[2] : null;
    const signature = parts.at(-1);

    if (!bookingId || !lockOwner || !signature) return null;

    let lockVersion: number | null = null;
    if (versionPart !== null) {
      const parsedLockVersion = Number.parseInt(versionPart, 10);
      if (!Number.isSafeInteger(parsedLockVersion) || parsedLockVersion < 1) {
        return null;
      }
      lockVersion = parsedLockVersion;
    }

    const payload =
      lockVersion === null
        ? `${bookingId}.${lockOwner}`
        : `${bookingId}.${lockOwner}.${lockVersion}`;
    const expectedSignature = sign(payload);

    if (!timingSafeEqualString(expectedSignature, signature)) return null;

    return { bookingId, lockOwner, lockVersion };
  } catch {
    return null;
  }
}
