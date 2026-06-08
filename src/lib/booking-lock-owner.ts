import crypto from "crypto";

export function hashBookingLockOwner(lockOwner: string) {
  return crypto.createHash("sha256").update(lockOwner).digest("hex");
}
