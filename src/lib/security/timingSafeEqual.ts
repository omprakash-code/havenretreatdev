import crypto from "crypto";

export function timingSafeEqualString(a: string, b: string) {
  const left = String(a ?? "");
  const right = String(b ?? "");

  if (!left || !right) return false;

  const leftBuffer = Buffer.from(left, "utf8");
  const rightBuffer = Buffer.from(right, "utf8");
  if (leftBuffer.length !== rightBuffer.length) return false;

  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}
