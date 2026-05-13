import crypto from "crypto";

type SuccessTokenPayload = {
  bookingId: string;
  bookingRef: string;
  issuedAt: number;
};

function sign(value: string) {
  const secret = process.env.SUCCESS_PAGE_SECRET;
  if (!secret) {
    throw new Error("SUCCESS_PAGE_SECRET is not defined");
  }

  return crypto
    .createHmac("sha256", secret)
    .update(value)
    .digest("hex");
}

function safeEqual(a: string, b: string) {
  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);

  if (aBuffer.length !== bBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(aBuffer, bBuffer);
}

export function createSuccessToken(
  bookingId: string,
  bookingRef: string,
  issuedAt = Date.now()
) {
  const payload = `${bookingId}.${bookingRef}.${issuedAt}`;
  const signature = sign(payload);
  return Buffer.from(`${payload}.${signature}`).toString("base64");
}

export function verifySuccessToken(token: string): {
  valid: boolean;
  code?: "INVALID_TOKEN";
  payload?: SuccessTokenPayload;
} {
  try {
    const decoded = Buffer.from(token, "base64").toString("utf8");
    const parts = decoded.split(".");

    if (parts.length < 4) {
      return { valid: false, code: "INVALID_TOKEN" };
    }

    const bookingId = parts.shift();
    const signature = parts.pop();
    const issuedAtRaw = parts.pop();
    const bookingRef = parts.join(".");

    if (!bookingId || !bookingRef || !signature || !issuedAtRaw) {
      return { valid: false, code: "INVALID_TOKEN" };
    }

    const issuedAt = Number(issuedAtRaw);
    if (!Number.isFinite(issuedAt)) {
      return { valid: false, code: "INVALID_TOKEN" };
    }

    const payload = `${bookingId}.${bookingRef}.${issuedAt}`;
    const expectedSignature = sign(payload);
    if (!safeEqual(expectedSignature, signature)) {
      return { valid: false, code: "INVALID_TOKEN" };
    }

    const now = Date.now();
    if (issuedAt > now + 5 * 60 * 1000) {
      return { valid: false, code: "INVALID_TOKEN" };
    }

    return {
      valid: true,
      payload: {
        bookingId,
        bookingRef,
        issuedAt,
      },
    };
  } catch {
    return { valid: false, code: "INVALID_TOKEN" };
  }
}
