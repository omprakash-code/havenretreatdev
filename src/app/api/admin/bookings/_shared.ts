import {
  AdvancePaymentConfigError,
  getRequiredAdvancePaymentAmount,
} from "@/lib/advance-payment";

type CoreField =
  | "locationId"
  | "date"
  | "theatreId"
  | "slotId"
  | "customer"
  | "payment";

type BookingMutationPayloadCore = {
  locationId?: string;
  date?: string;
  theatreId?: string;
  slotId?: string;
  customer?: unknown;
  payment?: unknown;
};

export const IST_TIMEZONE = "Asia/Kolkata";
export const OFFLINE_METHODS = ["CASH", "UPI", "BANK"] as const;
export const PAYMENT_TYPES = ["OFFLINE", "ONLINE"] as const;
export const PAYMENT_AMOUNT_MODES = ["ADVANCE", "FULL"] as const;

export type OfflineMethod = (typeof OFFLINE_METHODS)[number];
export type PaymentType = (typeof PAYMENT_TYPES)[number];
export type PaymentAmountMode = (typeof PAYMENT_AMOUNT_MODES)[number];

export class AdminBookingApiError extends Error {
  status: number;
  code: string;
  extra?: Record<string, unknown>;

  constructor(
    status: number,
    code: string,
    message: string,
    extra?: Record<string, unknown>
  ) {
    super(message);
    this.status = status;
    this.code = code;
    this.extra = extra;
  }
}

export function normalizeIndianPhone(input: string) {
  const digits = input.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length <= 10) return digits;
  if (digits.length === 11 && digits.startsWith("0")) {
    return digits.slice(1);
  }
  return digits.slice(-10);
}

export function isValidPhone(phone: string) {
  return /^\d{10}$/.test(phone);
}

export function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function ensureValidDateKey(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new AdminBookingApiError(
      400,
      "INVALID_REQUEST",
      "Date must be in YYYY-MM-DD format."
    );
  }
}

export function assertBookingMutationPayload<T extends BookingMutationPayloadCore>(
  payload: T
): asserts payload is T & Required<Pick<T, CoreField>> {
  if (
    !payload.locationId ||
    !payload.date ||
    !payload.theatreId ||
    !payload.slotId ||
    !payload.customer ||
    !payload.payment
  ) {
    throw new AdminBookingApiError(
      400,
      "INVALID_REQUEST",
      "Missing required booking fields."
    );
  }
}

export function normalizeOccasionData(raw: unknown) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {};
  }

  const normalized: Record<string, string> = {};
  Object.entries(raw).forEach(([key, value]) => {
    if (!key.trim()) return;
    const cleaned = String(value ?? "").trim();
    if (!cleaned) return;
    normalized[key] = cleaned;
  });

  return normalized;
}

export async function getRequiredAdminAdvanceAmount(db: {
  appSetting: {
    findUnique(args: {
      where: { key: string };
      select?: { value: true };
    }): Promise<{ value: string } | null>;
  };
}) {
  try {
    return await getRequiredAdvancePaymentAmount(db);
  } catch (error) {
    if (error instanceof AdvancePaymentConfigError) {
      throw new AdminBookingApiError(
        500,
        "CONFIG_MISSING",
        "Advance payment configuration is missing or invalid."
      );
    }

    throw error;
  }
}
