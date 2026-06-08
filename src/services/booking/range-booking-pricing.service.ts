import type { Prisma } from "@prisma/client";

import { PACKAGE_EXTRA_PERSON_PRICE } from "@/lib/package-guest-pricing";

type JsonObject = Record<string, Prisma.JsonValue>;

function asObject(value: Prisma.JsonValue | null): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonObject)
    : {};
}

function asMoney(value: Prisma.JsonValue | undefined) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? Math.max(0, Math.trunc(number)) : 0;
}

export function resolveRangePackageGuestLimit(
  packageSnapshot: Prisma.JsonValue | null
) {
  return Math.max(1, asMoney(asObject(packageSnapshot).guestLimit));
}

export function buildRangePricingSnapshot(input: {
  packageSnapshot: Prisma.JsonValue | null;
  pricingSnapshot: Prisma.JsonValue | null;
  guestCount: number;
  productsAmount: number;
  discountAmount: number;
}) {
  const previous = asObject(input.pricingSnapshot);
  const packageAmount = asMoney(previous.packageAmount);
  const extraDurationAmount = asMoney(previous.extraDurationAmount);
  const includedGuests = resolveRangePackageGuestLimit(input.packageSnapshot);
  const extraGuestCount = Math.max(
    Math.trunc(input.guestCount) - includedGuests,
    0
  );
  const extraGuestAmount = extraGuestCount * PACKAGE_EXTRA_PERSON_PRICE;
  const productsAmount = Math.max(0, Math.trunc(input.productsAmount));
  const grossAmount =
    packageAmount + extraDurationAmount + extraGuestAmount + productsAmount;
  const discountAmount = Math.min(
    Math.max(0, Math.trunc(input.discountAmount)),
    grossAmount
  );
  const totalAmount = grossAmount - discountAmount;
  const advancePaid = asMoney(previous.advancePaid);

  return {
    ...previous,
    packageAmount,
    extraDurationAmount,
    packageGuestLimit: includedGuests,
    extraGuestCount,
    extraGuestPrice: PACKAGE_EXTRA_PERSON_PRICE,
    extraGuestAmount,
    productsAmount,
    discountAmount,
    totalAmount,
    advancePaid,
    remainingPayable: Math.max(totalAmount - advancePaid, 0),
  };
}
