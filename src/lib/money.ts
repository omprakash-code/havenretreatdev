const CENTS_PER_UNIT = 100;

export type MoneyInput = unknown;

export function toCents(value: MoneyInput): number {
  if (value == null) return 0;
  const raw = String(value).trim();
  if (!raw) return 0;

  const normalized = raw.replace(/,/g, "");
  const sign = normalized.startsWith("-") ? -1 : 1;
  const unsigned = sign === -1 ? normalized.slice(1) : normalized;
  if (!/^\d+(\.\d+)?$/.test(unsigned)) return 0;

  const [wholeRaw, fractionRaw = ""] = unsigned.split(".");
  const whole = Number.parseInt(wholeRaw || "0", 10);
  if (!Number.isFinite(whole)) return 0;

  const fractionPadded = fractionRaw.padEnd(3, "0");
  const cents = Number.parseInt(fractionPadded.slice(0, 2) || "0", 10);
  const roundDigit = Number.parseInt(fractionPadded[2] || "0", 10);
  const roundedCents = cents + (roundDigit >= 5 ? 1 : 0);

  return sign * (whole * CENTS_PER_UNIT + roundedCents);
}

export function toMoney(value: MoneyInput): number {
  return toCents(value) / CENTS_PER_UNIT;
}

export function toNonNegativeMoney(value: MoneyInput): number {
  return Math.max(toMoney(value), 0);
}

export function centsToMoney(cents: number): number {
  if (!Number.isFinite(cents)) return 0;
  return Math.round(cents) / CENTS_PER_UNIT;
}

export function multiplyMoney(value: MoneyInput, multiplier: number): number {
  if (!Number.isFinite(multiplier)) return 0;
  return centsToMoney(toCents(value) * multiplier);
}

export function percentOfMoney(value: MoneyInput, percent: MoneyInput): number {
  const valueCents = toCents(value);
  const percentBasisPoints = Math.round(toMoney(percent) * 100);
  return centsToMoney(Math.floor((valueCents * percentBasisPoints) / 10000));
}

export function formatMoney(value: MoneyInput, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Math.max(toMoney(value), 0));
}

export function hasMoreThanTwoDecimals(value: unknown) {
  const raw = String(value ?? "").trim();
  if (!raw) return false;
  return /^\d+\.\d{3,}$/.test(raw.replace(/,/g, ""));
}
