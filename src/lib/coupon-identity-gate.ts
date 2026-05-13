export type CouponIdentityMode = "PHONE" | "EMAIL" | "USER";

type CouponIdentityInput = {
  phone?: string | null;
  email?: string | null;
  userId?: string | null;
};

type CouponIdentityGate = {
  locked: boolean;
  mode: CouponIdentityMode;
  message: string;
};

function resolveConfiguredMode(): CouponIdentityMode {
  const configured = String(process.env.NEXT_PUBLIC_COUPON_IDENTITY_MODE ?? "")
    .trim()
    .toUpperCase();

  if (configured === "EMAIL") return "EMAIL";
  if (configured === "USER") return "USER";
  return "PHONE";
}

function hasValidPhone(phone: string | null | undefined) {
  const digits = String(phone ?? "").replace(/\D/g, "");
  return /^\d{10}$/.test(digits);
}

function hasValidEmail(email: string | null | undefined) {
  const value = String(email ?? "").trim();
  if (!value) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function hasValidUser(userId: string | null | undefined) {
  return String(userId ?? "").trim().length > 0;
}

export function resolveCouponIdentityGate(
  identity: CouponIdentityInput,
  mode: CouponIdentityMode = resolveConfiguredMode()
): CouponIdentityGate {
  if (mode === "EMAIL") {
    const locked = !hasValidEmail(identity.email);
    return {
      locked,
      mode,
      message: "Please fill the required field (email address) before applying a coupon.",
    };
  }

  if (mode === "USER") {
    const locked = !hasValidUser(identity.userId);
    return {
      locked,
      mode,
      message: "Please sign in before applying a coupon.",
    };
  }

  const locked = !hasValidPhone(identity.phone);
  return {
    locked,
    mode: "PHONE",
    message: "Please fill the required field (phone number) before applying a coupon.",
  };
}

