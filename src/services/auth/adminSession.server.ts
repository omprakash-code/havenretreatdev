import crypto from "crypto";

let adminSecretCache: string | null = null;

function getAdminSecret(): string {
  if (adminSecretCache) return adminSecretCache;

  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) {
    throw new Error("ADMIN_SESSION_SECRET missing in environment variables");
  }

  adminSecretCache = secret;
  return secret;
}

const MAX_AGE_MS = 1000 * 60 * 60 * 8; // 8 hours
const FUTURE_SKEW_TOLERANCE_MS = 1000 * 60 * 5; // 5 minutes

function sign(val: string): string {
  return crypto
    .createHmac("sha256", getAdminSecret())
    .update(val)
    .digest("hex");
}

function isTimingSafeEqualHex(a: string, b: string) {
  if (!a || !b || a.length !== b.length) return false;

  const aBuffer = Buffer.from(a, "hex");
  const bBuffer = Buffer.from(b, "hex");

  if (aBuffer.length === 0 || bBuffer.length === 0) return false;
  if (aBuffer.length !== bBuffer.length) return false;

  return crypto.timingSafeEqual(aBuffer, bBuffer);
}

export type VerifiedAdminSession = {
  userId: string;
  role: string;
  sessionVersion: number | null;
  issuedAtMs: number;
};

export function createAdminSessionToken(
  userId: string,
  role: string,
  sessionVersion: number
) {
  const normalizedSessionVersion = Number.isFinite(sessionVersion)
    ? Math.max(Math.trunc(sessionVersion), 1)
    : 1;

  const payload = `${userId}.${role}.${normalizedSessionVersion}.${Date.now()}`;
  const signature = sign(payload);
  return Buffer.from(`${payload}.${signature}`).toString("base64");
}

export function verifyAdminSessionToken(token: string) {
  try {
    const decoded = Buffer.from(token, "base64").toString("utf8");
    const parts = decoded.split(".");

    let userId = "";
    let role = "";
    let sessionVersion: number | null = null;
    let timestampRaw = "";
    let signature = "";
    let payload = "";

    if (parts.length === 5) {
      [userId, role, , timestampRaw, signature] = parts;
      payload = `${parts[0]}.${parts[1]}.${parts[2]}.${parts[3]}`;
      const parsedSessionVersion = Number(parts[2]);
      if (!Number.isFinite(parsedSessionVersion)) return null;
      sessionVersion = Math.trunc(parsedSessionVersion);
    } else if (parts.length === 4) {
      // Legacy token format (without session version).
      [userId, role, timestampRaw, signature] = parts;
      payload = `${userId}.${role}.${timestampRaw}`;
      sessionVersion = null;
    } else {
      return null;
    }

    if (!userId || !role || !timestampRaw || !signature) return null;

    const expected = sign(payload);
    if (!isTimingSafeEqualHex(expected, signature)) return null;

    const issuedAtMs = Number(timestampRaw);
    if (!Number.isFinite(issuedAtMs)) return null;

    const tokenAge = Date.now() - issuedAtMs;
    if (tokenAge > MAX_AGE_MS || tokenAge < -FUTURE_SKEW_TOLERANCE_MS) {
      return null;
    }

    const result: VerifiedAdminSession = {
      userId,
      role,
      sessionVersion,
      issuedAtMs,
    };

    return result;
  } catch {
    return null;
  }
}
