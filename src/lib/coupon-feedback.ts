type CouponFeedbackInput = {
  reason?: string | null;
  message?: string | null;
  severity?: "error" | "info" | "warning" | null;
};

const INFO_REASONS = new Set([
  "MINIMUM_AMOUNT_NOT_MET",
  "MINIMUM_PAYABLE_VIOLATION",
]);

export function isCouponConditionMessage(input: CouponFeedbackInput) {
  if (input.severity === "info" || input.severity === "warning") {
    return true;
  }

  const reason = String(input.reason ?? "").trim().toUpperCase();
  if (INFO_REASONS.has(reason)) return true;

  const rawMessage = String(input.message ?? "").trim().toLowerCase();
  if (!rawMessage) return false;

  const message = rawMessage.replace(/^[a-z0-9_-]+\s*:\s*/i, "");

  if (
    message.startsWith("add at least ") ||
    message.startsWith("add products ") ||
    message.startsWith("select location") ||
    message.startsWith("select date") ||
    message.startsWith("select theatre") ||
    message.startsWith("choose a slot") ||
    message.startsWith("select a slot") ||
    message.startsWith("this coupon is available only when") ||
    message.startsWith("this coupon is available only if") ||
    message.startsWith("this coupon is not valid for the selected ") ||
    message.includes("minimum amount condition") ||
    message.includes("minimum payable requirement") ||
    message.includes("not applicable to your current selection") ||
    message.includes("your cart includes")
  ) {
    return true;
  }

  return false;
}
