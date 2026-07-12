import type { Prisma } from "@prisma/client";

import type { BookingSuccessData } from "@/components/booking/success/types";
import {
  assignNumberDecorationDetails,
  buildOccasionDetails,
} from "@/lib/booking-celebration";
import { prisma } from "@/lib/db";
import { getCouponDisplayCode } from "@/lib/coupon-display";
import {
  derivePaymentLifecycle,
  getBookingStatusLabel,
  getPaymentLifecycleLabel,
} from "@/lib/booking-status";
import { resolveBookingDurationPricingConfig } from "@/lib/booking-duration-pricing";
import { PACKAGE_EXTRA_PERSON_PRICE } from "@/lib/package-guest-pricing";
import { resolveRangePackageGuestLimit } from "@/services/booking/range-booking-pricing.service";
import {
  getPackageIncludedProductExtraQuantity,
  getPackageIncludedProductQuantity,
} from "@/lib/package-included-products";
import { resolvePresentedBookingSchedule } from "@/lib/booking-schedule-presenter";

/**
 * The single description of a booking as the customer sees it after submitting:
 * the success page reads it over the API, and the emailed PDF is drawn from it.
 * Both must show the same booking, so neither derives it for itself.
 */

const DEFAULT_ADVANCE = 750;

export const bookingSuccessInclude = {
  items: {
    orderBy: { createdAt: "asc" },
    include: {
      product: {
        select: {
          slug: true,
        },
      },
    },
  },
  payment: {
    orderBy: { createdAt: "desc" },
    take: 1,
    select: {
      provider: true,
      method: true,
      transactionId: true,
      status: true,
      amount: true,
      createdAt: true,
    },
  },
  couponUsages: {
    // A submitted booking still holds its coupons as RESERVED (they are
    // confirmed on approval), so both states must be listed or the summary
    // would show a discount with no coupon behind it.
    where: { status: { in: ["RESERVED", "CONFIRMED"] } },
    include: {
      coupon: {
        select: {
          id: true,
          code: true,
        },
      },
    },
    orderBy: { reservedAt: "asc" },
  },
  signedAgreements: {
    orderBy: { signedAt: "desc" },
    take: 1,
    select: {
      id: true,
      agreementRef: true,
      signerName: true,
      signerEmail: true,
      signedAt: true,
      signatureImage: true,
      agreementVersion: true,
      agreementHtmlSnapshot: true,
      acknowledgedClauses: true,
      confirmationAccepted: true,
    },
  },
  venue: true,
} satisfies Prisma.BookingInclude;

export type BookingWithSuccessRelations = Prisma.BookingGetPayload<{
  include: typeof bookingSuccessInclude;
}>;

export function loadBookingWithSuccessRelations(bookingId: string) {
  return prisma.booking.findUnique({
    where: { id: bookingId },
    include: bookingSuccessInclude,
  });
}

export type BuiltBookingSuccessData = {
  data: BookingSuccessData;
  successTokenExpiresAt: Date | null;
};

export async function buildBookingSuccessData(
  booking: BookingWithSuccessRelations
): Promise<BuiltBookingSuccessData | null> {
  const schedule = resolvePresentedBookingSchedule(
    {
      eventDate: booking.eventDate,
      eventStartTime: booking.eventStartTime,
      eventEndTime: booking.eventEndTime,
      startsAtUtc: booking.startsAtUtc,
      endsAtUtc: booking.endsAtUtc,
      timezone: booking.timezone,
    },
    "dd MMM yyyy"
  );

  if (!schedule) return null;

  const venue = booking.venue;

  const productIds = [...new Set(booking.items.map((row) => row.productId))];
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, image: true },
  });
  const productImageMap = new Map(products.map((row) => [row.id, row.image]));

  const advance =
    booking.advancePaid !== null ? booking.advancePaid : DEFAULT_ADVANCE;
  const latestPayment = booking.payment[0] ?? null;
  const signedAgreement = booking.signedAgreements[0] ?? null;
  const durationConfig = await resolveBookingDurationPricingConfig(prisma);
  const packageSnapshot =
    booking.packageSnapshot &&
    typeof booking.packageSnapshot === "object" &&
    !Array.isArray(booking.packageSnapshot)
      ? (booking.packageSnapshot as Record<string, unknown>)
      : null;
  const pricingSnapshot =
    booking.pricingSnapshot &&
    typeof booking.pricingSnapshot === "object" &&
    !Array.isArray(booking.pricingSnapshot)
      ? (booking.pricingSnapshot as Record<string, unknown>)
      : null;
  const durationHours = schedule.durationHours;
  const includedDurationHours = Math.max(
    0,
    Number(
      pricingSnapshot?.includedDurationHours ??
        packageSnapshot?.eventDurationHours ??
        durationConfig.includedDurationHours
    )
  );
  const extraDurationHours =
    durationHours !== null
      ? Math.max(durationHours - includedDurationHours, 0)
      : null;
  const packageGuestLimit = resolveRangePackageGuestLimit(
    booking.packageSnapshot
  );
  const includedProductSource = { capacity: packageGuestLimit };
  const includedGuestCount = packageGuestLimit;
  const extraGuestCount = Math.max(booking.guestCount - includedGuestCount, 0);
  const packageAmount = Number(
    pricingSnapshot?.packageAmount ??
      packageSnapshot?.subtotalAmount ??
      packageSnapshot?.finalAmount ??
      0
  );
  const snapshotExtraDurationAmount = Number(
    pricingSnapshot?.extraDurationAmount ?? 0
  );
  const extraDurationAmount =
    snapshotExtraDurationAmount > 0
      ? snapshotExtraDurationAmount
      : Math.max(Number(booking.baseAmount ?? 0) - packageAmount, 0);

  const items = assignNumberDecorationDetails(
    booking.items.map((item) => ({
      id: item.id,
      productName: item.productName,
      productSlug: item.product?.slug ?? null,
      variantLabel: item.variantLabel,
      category: item.category,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      totalPrice: item.totalPrice,
      includedQuantity: getPackageIncludedProductQuantity(
        includedProductSource,
        {
          slug: item.product?.slug,
          name: item.productName,
        }
      ),
      extraQuantity: getPackageIncludedProductExtraQuantity(
        includedProductSource,
        {
          slug: item.product?.slug,
          name: item.productName,
        },
        item.quantity
      ),
      image: productImageMap.get(item.productId) ?? null,
    })),
    (booking.occasionData as Record<string, unknown> | null) ?? null
  );

  const paymentLifecycle = derivePaymentLifecycle({
    paymentStatus: booking.paymentStatus,
    advancePaid: booking.advancePaid,
    remainingPayable: booking.remainingPayable,
  });

  const data: BookingSuccessData = {
    bookingRef: booking.bookingRef,
    bookingStatus: booking.bookingStatus,
    bookingStatusLabel: getBookingStatusLabel(booking.bookingStatus),
    paymentStatus: booking.paymentStatus,
    paymentLifecycle,
    paymentStatusLabel: getPaymentLifecycleLabel(paymentLifecycle),
    reviewSubmittedAt: booking.reviewSubmittedAt?.toISOString() ?? null,
    reviewedAt: booking.reviewedAt?.toISOString() ?? null,
    rejectionReason: booking.rejectionReason,
    createdByRole: booking.createdByRole,
    contact: {
      // Nullable in the schema, but a booking only becomes viewable after the
      // contact step. Emitted as-is so the API keeps returning what it always
      // has rather than gaining a placeholder name.
      name: booking.contactName as string,
      phone: booking.contactPhone as string,
      email: booking.contactEmail ?? undefined,
    },
    theatreName:
      (booking.packageSnapshot as { name?: string } | null)?.name ??
      venue?.name ??
      "Haven Retreat",
    theatreImage: null,
    date: schedule.date,
    timeSlot: schedule.timeSlot,
    durationHours,
    includedDurationHours,
    extraDurationHours,
    locationName: "Miami",
    dateTime: schedule.dateTime,
    occasionLabel: booking.occasionLabel ?? undefined,
    occasionDetails: buildOccasionDetails(
      (booking.occasionData as Record<string, unknown> | null) ?? null
    ),
    guestCount: booking.guestCount,
    includedGuestCount,
    extraGuestCount,
    extraPersonPrice: PACKAGE_EXTRA_PERSON_PRICE,
    decorationRequired: booking.decorationRequired,
    packageAmount,
    extraDurationAmount:
      extraDurationAmount > 0 ? extraDurationAmount : undefined,
    extrasAmount: booking.extrasAmount,
    decorationAmount: booking.decorationAmount,
    totalAmount: booking.totalAmount,
    discountAmount: booking.discountAmount,
    advancePaid: advance,
    remainingPayable: booking.remainingPayable ?? booking.totalAmount - advance,
    payment:
      latestPayment != null
        ? {
            provider: latestPayment.provider,
            method: latestPayment.method,
            transactionId: latestPayment.transactionId,
            status: latestPayment.status,
            amount: latestPayment.amount,
            createdAt: latestPayment.createdAt.toISOString(),
          }
        : null,
    appliedCoupons: booking.couponUsages.map((usage) => ({
      id: usage.coupon.id,
      code: getCouponDisplayCode(usage.coupon.code),
      discountAmount: usage.discountAmount ?? 0,
    })),
    signedAgreement: signedAgreement
      ? {
          id: signedAgreement.agreementRef,
          signerName: signedAgreement.signerName,
          signerEmail: signedAgreement.signerEmail,
          signedAt: signedAgreement.signedAt.toISOString(),
          signatureImage: signedAgreement.signatureImage,
          agreementVersion: signedAgreement.agreementVersion,
          agreementHtmlSnapshot: signedAgreement.agreementHtmlSnapshot,
          acknowledgedClauses: Array.isArray(signedAgreement.acknowledgedClauses)
            ? signedAgreement.acknowledgedClauses.filter(
                (entry): entry is number =>
                  typeof entry === "number" && Number.isInteger(entry)
              )
            : [],
          confirmationAccepted: signedAgreement.confirmationAccepted,
        }
      : null,
    items,
  };

  return {
    data,
    successTokenExpiresAt: schedule.successTokenExpiresAt ?? null,
  };
}
