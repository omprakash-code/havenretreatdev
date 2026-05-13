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
  lockOwner: string
) {
  const payload = `${bookingId}.${lockOwner}`;
  const signature = sign(payload);
  return Buffer.from(`${payload}.${signature}`).toString("base64");
}

export function verifyBookingSessionToken(token: string) {
  try {
    const decoded = Buffer.from(token, "base64").toString("utf8");
    const [bookingId, lockOwner, signature] = decoded.split(".");

    if (!bookingId || !lockOwner || !signature) return null;

    const expectedSignature = sign(`${bookingId}.${lockOwner}`);

    if (!timingSafeEqualString(expectedSignature, signature)) return null;

    return { bookingId, lockOwner };
  } catch {
    return null;
  }
}
