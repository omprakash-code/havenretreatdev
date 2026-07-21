import type { Prisma } from "@prisma/client";

import { centsToMoney, toCents, toNonNegativeMoney } from "@/lib/money";
import { PACKAGE_EXTRA_PERSON_PRICE } from "@/lib/package-guest-pricing";

type JsonObject = Record<string, Prisma.JsonValue>;

function asObject(value: Prisma.JsonValue | null): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonObject)
    : {};
}

function asMoney(value: Prisma.JsonValue | undefined) {
  return toNonNegativeMoney(value ?? 0);
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
  const extraGuestAmount = centsToMoney(
    extraGuestCount * toCents(PACKAGE_EXTRA_PERSON_PRICE)
  );
  const productsAmount = toNonNegativeMoney(input.productsAmount);
  const grossAmount = centsToMoney(
    toCents(packageAmount) +
      toCents(extraDurationAmount) +
      toCents(extraGuestAmount) +
      toCents(productsAmount)
  );
  const discountAmount = centsToMoney(
    Math.min(toCents(toNonNegativeMoney(input.discountAmount)), toCents(grossAmount))
  );
  const totalAmount = centsToMoney(toCents(grossAmount) - toCents(discountAmount));
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
    remainingPayable: centsToMoney(
      Math.max(toCents(totalAmount) - toCents(advancePaid), 0)
    ),
  };
}
