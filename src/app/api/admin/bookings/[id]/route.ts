import { NextResponse } from "next/server";
import { Prisma, PaymentStatus, BookingStatus } from "@prisma/client";

import { prisma } from "@/lib/db";
import {
  derivePaymentLifecycle,
  getBookingStatusLabel,
  getPaymentStatusLabel,
  isReviewWorkflowBookingStatus,
} from "@/lib/booking-status";
import { getCouponDisplayCode } from "@/lib/coupon-display";
import { presentReportingSchedule } from "@/lib/admin/reporting-schedule-presenter";
import { bookingErrorResponse } from "@/lib/booking-api-response";
import { calculateBookingPricing } from "@/lib/booking-pricing";
import {
  centsToMoney,
  hasMoreThanTwoDecimals,
  multiplyMoney,
  toCents,
  toMoney,
  toNonNegativeMoney,
} from "@/lib/money";
import { resolveLocationDisplayName } from "@/lib/location-display";
import {
  PACKAGE_EXTRA_PERSON_PRICE,
  maxGuestsForIncluded,
} from "@/lib/package-guest-pricing";
import { calculateDurationHours } from "@/lib/booking-time-range";
import { getAuthenticatedAdminIdFromCookies } from "@/services/auth/adminAuth.server";
import {
  AdminBookingApiError as AdminBookingEditError,
  OFFLINE_METHODS,
  PAYMENT_AMOUNT_MODES,
  PAYMENT_TYPES,
  assertBookingMutationPayload,
  ensureValidDateKey,
  isValidEmail,
  isValidPhone,
  getRequiredAdminAdvanceAmount,
  normalizeIndianPhone,
  normalizeOccasionData,
  type OfflineMethod,
  type PaymentAmountMode,
  type PaymentType,
} from "@/app/api/admin/bookings/_shared";
import {
  evaluateAdminCoupons,
  persistAdminBookingCoupons,
} from "@/app/api/admin/bookings/_coupon";
import { isNumberDecorationProduct } from "@/lib/product-numbering";
import { getPackageIncludedProductTotalPrice } from "@/lib/package-included-products";
import {
  getDurationAdjustedUnitPrice,
  rebaseDurationAdjustedUnitPrice,
} from "@/lib/product-duration-pricing";
import { notifyAbandonedBookingsByIds } from "@/services/booking/booking-abandonment-email.service";
import { createSuccessToken } from "@/services/booking/successToken.server";
import {
  AdminRangeBookingError,
  validateAdminRangeBooking,
} from "@/services/booking/admin-range-booking.service";
import {
  createSquarePaymentLink,
  getSquareCurrency,
  SquareServerError,
} from "@/lib/square/server";
import { sendBookingPaymentLinkEmail } from "@/services/booking/booking-payment-link-email.service";
import {
  BookingOverlapError,
} from "@/services/booking/booking-safety.service";
import {
  ADMIN_SOFT_DELETE_REASON,
  BOOKING_BUFFER_MINUTES,
  BOOKING_BUSINESS_CLOSE_TIME,
  BOOKING_BUSINESS_OPEN_TIME,
  BOOKING_TIME_ZONE,
  DEFAULT_MINIMUM_BOOKING_MINUTES,
} from "@/lib/booking-policy";

// PENDING_REVIEW and APPROVED bookings stay admin-editable (with conflict
// validation); a rejected request is a closed decision, and a completed
// event is history.
const NON_EDITABLE_BOOKING_STATUSES: BookingStatus[] = [
  BookingStatus.CANCELLED,
  BookingStatus.ABANDONED,
  BookingStatus.PAID_EXPIRED,
  BookingStatus.REJECTED,
  BookingStatus.COMPLETED,
];

function resolveDisplayPaymentStatus(
  paymentStatus: PaymentStatus | null | undefined,
  paymentOrderId: string | null | undefined
): PaymentStatus {
  if (!paymentStatus) {
    return PaymentStatus.INITIALIZED;
  }

  // Legacy safety: `AWAITING_PAYMENT` should only exist after order creation.
  if (
    paymentStatus === PaymentStatus.AWAITING_PAYMENT &&
    !paymentOrderId
  ) {
    return PaymentStatus.INITIALIZED;
  }

  return paymentStatus;
}

type UpdateBookingItemPayload = {
  productId?: string;
  variantId?: string;
  quantity?: number;
  ledNumber?: string;
};

type UpdateBookingPayload = {
  locationId?: string;
  venueId?: string;
  date?: string;
  startTime?: string;
  endTime?: string;
  customer?: {
    name?: string;
    phone?: string;
    email?: string;
    userId?: string;
  };
  guestCount?: number;
  decorationRequired?: boolean;
  specialInstructions?: string;
  occasionKey?: string;
  occasionData?: Record<string, unknown>;
  couponCode?: string;
  couponCodes?: string[];
  items?: UpdateBookingItemPayload[];
  additionalChargeAmount?: number;
  additionalChargeReason?: string;
  payment?: {
    type?: PaymentType;
    amountMode?: PaymentAmountMode;
    advanceAmount?: number;
    offlineMethod?: OfflineMethod;
    offlineReference?: string;
    paymentStatus?: PaymentStatus;
  };
  allowLockedSlotOverride?: boolean;
};

async function getAuthenticatedAdminId() {
  return getAuthenticatedAdminIdFromCookies();
}

function extractLedNumbers(value: unknown): string[] {
  if (typeof value === "string") {
    const clean = value.trim();
    return clean ? [clean] : [];
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return [String(value)];
  }

  if (Array.isArray(value)) {
    return value
      .map((entry) => String(entry ?? "").trim())
      .filter((entry) => entry.length > 0);
  }

  return [];
}

function extractLedNumbersFromOccasionData(
  data: Record<string, unknown> | null | undefined
) {
  if (!data) return [];

  const directKeys = [
    "ledNumber",
    "led_number",
    "ledNo",
    "ledno",
    "led",
  ];

  const values: unknown[] = [];
  directKeys.forEach((key) => {
    if (key in data) {
      values.push(data[key]);
    }
  });

  if (values.length === 0) {
    Object.entries(data).forEach(([key, value]) => {
      const normalized = key.trim().toLowerCase();
      if (normalized.includes("led") && normalized.includes("number")) {
        values.push(value);
      }
    });
  }

  const extracted = values.flatMap((value) => extractLedNumbers(value));
  return Array.from(new Set(extracted));
}

function normalizeAdditionalChargeAmount(value: unknown) {
  if (value == null || String(value).trim() === "") return 0;
  const parsed = Number(value);
  if (hasMoreThanTwoDecimals(value)) {
    throw new AdminBookingEditError(
      400,
      "INVALID_REQUEST",
      "Additional charge amount can have up to 2 decimal places."
    );
  }
  const amount = toNonNegativeMoney(value);
  if (!Number.isFinite(parsed) || !Number.isFinite(amount) || parsed < 0) {
    throw new AdminBookingEditError(
      400,
      "INVALID_REQUEST",
      "Additional charge amount must be zero or a positive number."
    );
  }
  return amount;
}

export async function GET(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const adminId = await getAuthenticatedAdminId();
    if (!adminId) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const { id } = await context.params;
    const { searchParams } = new URL(req.url);
    const view = searchParams.get("view");

    const booking = await prisma.booking.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
        venue: {
          select: {
            id: true,
            name: true,
            city: true,
            images: true,
          },
        },
        eventPackage: {
          select: {
            id: true,
            name: true,
            locationId: true,
          },
        },
        items: {
          select: {
            id: true,
            productId: true,
            variantId: true,
            productName: true,
            variantLabel: true,
            quantity: true,
            unitPrice: true,
            totalPrice: true,
            category: true,
            product: {
              select: {
                slug: true,
                image: true,
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
            amount: true,
            status: true,
            createdAt: true,
            recordedByAdminId: true,
          },
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
            ipAddress: true,
            userAgent: true,
            agreementVersion: true,
            agreementHtmlSnapshot: true,
            acknowledgedClauses: true,
            confirmationAccepted: true,
            paymentReference: true,
            pdfGeneratedAt: true,
            pdfFileName: true,
            pdfSha256: true,
            createdAt: true,
          },
        },
        couponUsages: {
          where: {
            status: {
              in: ["RESERVED", "CONFIRMED"],
            },
          },
          include: {
            coupon: {
              select: {
                id: true,
                code: true,
              },
            },
          },
          orderBy: {
            reservedAt: "desc",
          },
        },
      },
    });

    if (!booking) {
      return bookingErrorResponse(404, "BOOKING_NOT_FOUND", "Booking not found.");
    }

    if (booking.cancelledReason === ADMIN_SOFT_DELETE_REASON) {
      return bookingErrorResponse(404, "BOOKING_NOT_FOUND", "Booking not found.");
    }

    const latestPayment = booking.payment[0] ?? null;
    const latestSignedAgreement = booking.signedAgreements[0] ?? null;
    const paymentType: PaymentType =
      latestPayment?.provider === "OFFLINE" ? "OFFLINE" : "ONLINE";
    const paymentAmountMode: PaymentAmountMode =
      toMoney(booking.advancePaid) >= toMoney(booking.totalAmount)
        ? "FULL"
        : "ADVANCE";

    const occasionData = (booking.occasionData as Record<string, unknown> | null) ?? {};
    const ledNumberQueue = extractLedNumbersFromOccasionData(occasionData);
    let ledIndex = 0;
    const appliedCoupons = booking.couponUsages.map((usage) => ({
      couponId: usage.coupon.id,
      code: getCouponDisplayCode(usage.coupon.code),
      discountAmount: toMoney(usage.discountAmount ?? 0),
      status: usage.status,
      reservedAt: usage.reservedAt,
      confirmedAt: usage.confirmedAt,
      releasedAt: usage.releasedAt,
    }));
    const couponCodes = appliedCoupons.map((coupon) => coupon.code);

    const paymentStatusForDisplay = resolveDisplayPaymentStatus(
      booking.paymentStatus,
      booking.paymentOrderId
    );
    const displaySpace = {
      id: booking.venue?.id ?? "",
      name: booking.venue?.name ?? (booking.packageSnapshot as { name?: string } | null)?.name ?? "Haven Retreat",
      image: booking.venue?.images?.[0] ?? null,
      locationName: resolveLocationDisplayName(null, booking.venue?.city),
    };
    const packageSnapshot =
      booking.packageSnapshot &&
      typeof booking.packageSnapshot === "object" &&
      !Array.isArray(booking.packageSnapshot)
        ? (booking.packageSnapshot as Record<string, unknown>)
        : null;
    const snapshotPackageName =
      packageSnapshot && typeof packageSnapshot.name === "string"
        ? packageSnapshot.name
        : null;
    const resolvedPackageName =
      booking.eventPackage?.name ??
      snapshotPackageName ??
      booking.venue?.name ??
      "Package unavailable";
    const schedule = presentReportingSchedule({
      eventDate: booking.eventDate,
      eventStartTime: booking.eventStartTime,
      eventEndTime: booking.eventEndTime,
      startsAtUtc: booking.startsAtUtc,
      endsAtUtc: booking.endsAtUtc,
      timezone: booking.timezone,
    });

    const pricingSnap =
      booking.pricingSnapshot &&
      typeof booking.pricingSnapshot === "object" &&
      !Array.isArray(booking.pricingSnapshot)
        ? (booking.pricingSnapshot as Record<string, unknown>)
        : null;
    const rangePackageAmount = pricingSnap ? Math.max(0, Number(pricingSnap.packageAmount ?? 0)) : 0;
    const rangeExtraDurationAmount = pricingSnap ? Math.max(0, Number(pricingSnap.extraDurationAmount ?? 0)) : 0;
    const rangeExtraDurationHours = pricingSnap ? Math.max(0, Number(pricingSnap.extraDurationHours ?? 0)) : 0;
    const snapshotPackageAmount = Math.max(
      0,
      Number(packageSnapshot?.subtotalAmount ?? packageSnapshot?.finalAmount ?? 0)
    );
    const snapshotIncludedDurationHours = Math.max(
      0,
      Number(packageSnapshot?.eventDurationHours ?? 0)
    );
    const scheduleDurationHours =
      calculateDurationHours(schedule.startTime, schedule.endTime) ?? 0;
    const derivedExtraDurationHours = Math.max(
      scheduleDurationHours - snapshotIncludedDurationHours,
      0
    );
    const effectivePackageAmount =
      rangePackageAmount > 0
        ? rangePackageAmount
        : snapshotPackageAmount > 0
          ? snapshotPackageAmount
          : null;
    const derivedExtraDurationAmount =
      effectivePackageAmount != null
        ? Math.max(toMoney(booking.baseAmount) - effectivePackageAmount, 0)
        : 0;
    const effectiveExtraDurationAmount =
      rangeExtraDurationAmount > 0
        ? rangeExtraDurationAmount
        : derivedExtraDurationAmount > 0
          ? derivedExtraDurationAmount
          : null;
    const effectiveExtraDurationHours =
      rangeExtraDurationHours > 0
        ? rangeExtraDurationHours
        : derivedExtraDurationHours > 0
          ? derivedExtraDurationHours
          : null;

    const customerConfirmationUrl = isReviewWorkflowBookingStatus(
      booking.bookingStatus
    )
      ? `/booking/success?t=${encodeURIComponent(
          createSuccessToken(booking.id, booking.bookingRef)
        )}&admin=true`
      : null;

    if (view === "drawer") {
      return NextResponse.json({
        success: true,
        data: {
          id: booking.id,
          bookingRef: booking.bookingRef,
          customer: {
            name: booking.contactName ?? booking.user?.name ?? "Guest",
            phone: booking.contactPhone ?? booking.user?.phone ?? "",
            email: booking.contactEmail ?? booking.user?.email ?? null,
          },
          theatre: {
            id: displaySpace.id,
            name: displaySpace.name,
            timezone: booking.timezone ?? null,
            locationName: displaySpace.locationName,
          },
          package: {
            id: booking.eventPackage?.id ?? null,
            name: resolvedPackageName,
          },
          locationName: displaySpace.locationName,
          theatreImage: displaySpace.image,
          eventDate: booking.eventDate?.toISOString().slice(0, 10) ?? null,
          eventStartTime: booking.eventStartTime,
          eventEndTime: booking.eventEndTime,
          startsAtUtc: booking.startsAtUtc?.toISOString() ?? null,
          endsAtUtc: booking.endsAtUtc?.toISOString() ?? null,
          timezone: booking.timezone,
          schedule,
          slot: {
            id: null,
            date: schedule.date,
            startTime: schedule.startTime,
            endTime: schedule.endTime,
            status: booking.bookingStatus,
            basePrice: null,
            finalPrice: null,
            decorationMandatory: false,
          },
          guestCount: booking.guestCount,
          decorationRequired: booking.decorationRequired,
          pricing: {
            base: toMoney(booking.baseAmount),
            extras: toMoney(booking.extrasAmount),
            products: toMoney(booking.productsAmount),
            additionalChargeAmount: toMoney(booking.additionalChargeAmount),
            additionalChargeReason: booking.additionalChargeReason,
            decoration: toMoney(booking.decorationAmount),
            discount: toMoney(booking.discountAmount),
            total: toMoney(booking.totalAmount),
            advancePaid: toMoney(booking.advancePaid),
            remainingPayable: toMoney(booking.remainingPayable),
            packageAmount: effectivePackageAmount,
            extraDurationAmount: effectiveExtraDurationAmount,
            extraDurationHours: effectiveExtraDurationHours,
          },
          items: booking.items.map((item) => {
            const isLedItem = isNumberDecorationProduct({
              slug: item.product?.slug,
              name: item.productName,
            });
            const ledNumber =
              isLedItem && ledNumberQueue.length > 0
                ? ledNumberQueue[Math.min(ledIndex++, ledNumberQueue.length - 1)]
                : null;

            return {
              id: item.id,
              productName: item.productName,
              variantLabel: item.variantLabel,
              productImage: item.product?.image ?? null,
              quantity: item.quantity,
              unitPrice: toMoney(item.unitPrice),
              totalPrice: toMoney(item.totalPrice),
              image: item.product?.image ?? null,
              category: item.category,
              ledNumber,
            };
          }),
          occasionLabel: booking.occasionLabel ?? null,
          occasionKey: booking.occasionKey ?? null,
          occasionData,
          specialInstructions: booking.specialInstructions ?? null,
          confirmationEmailSent: booking.confirmationEmailSent,
          abandonmentCustomerEmailSentAt:
            booking.abandonmentCustomerEmailSentAt?.toISOString() ?? null,
          abandonmentAdminEmailSentAt:
            booking.abandonmentAdminEmailSentAt?.toISOString() ?? null,
          termsAcceptedAt: booking.termsAcceptedAt?.toISOString() ?? null,
          signedAgreement: latestSignedAgreement
            ? {
                id: latestSignedAgreement.agreementRef,
                signerName: latestSignedAgreement.signerName,
                signerEmail: latestSignedAgreement.signerEmail,
                signedAt: latestSignedAgreement.signedAt.toISOString(),
                signatureImage: latestSignedAgreement.signatureImage,
                ipAddress: latestSignedAgreement.ipAddress,
                userAgent: latestSignedAgreement.userAgent,
                agreementVersion: latestSignedAgreement.agreementVersion,
                agreementHtmlSnapshot:
                  latestSignedAgreement.agreementHtmlSnapshot,
                acknowledgedClauses: Array.isArray(
                  latestSignedAgreement.acknowledgedClauses
                )
                  ? latestSignedAgreement.acknowledgedClauses.filter(
                      (entry): entry is number =>
                        typeof entry === "number" && Number.isInteger(entry)
                    )
                  : [],
                confirmationAccepted: latestSignedAgreement.confirmationAccepted,
                paymentReference: latestSignedAgreement.paymentReference,
                pdfGeneratedAt: latestSignedAgreement.pdfGeneratedAt?.toISOString() ?? null,
                pdfFileName: latestSignedAgreement.pdfFileName,
                pdfSha256: latestSignedAgreement.pdfSha256,
                createdAt: latestSignedAgreement.createdAt.toISOString(),
              }
            : null,
          paymentOrderId: booking.paymentOrderId ?? null,
          paymentTransactionId: booking.paymentTransactionId ?? null,
          paymentSignature: booking.paymentSignature ?? null,
          paymentDetails: latestPayment
            ? {
                provider: latestPayment.provider,
                method: latestPayment.method,
                transactionId: latestPayment.transactionId,
                amount: toMoney(latestPayment.amount),
                status: latestPayment.status,
                createdAt: latestPayment.createdAt.toISOString(),
                recordedByAdminId: latestPayment.recordedByAdminId,
              }
            : null,
          createdByRole: booking.createdByRole ?? null,
          createdByAdminId: booking.createdByAdminId ?? null,
          paymentStatus: paymentStatusForDisplay,
          bookingStatus: booking.bookingStatus,
          bookingStatusLabel: getBookingStatusLabel(booking.bookingStatus),
          customerConfirmationUrl,
          // Payment is shown independently of the approval decision.
          paymentLifecycle: derivePaymentLifecycle({
            paymentStatus: paymentStatusForDisplay,
            advancePaid: toMoney(booking.advancePaid),
            remainingPayable: toMoney(booking.remainingPayable),
          }),
          paymentStatusLabel: getPaymentStatusLabel({
            paymentStatus: paymentStatusForDisplay,
            advancePaid: toMoney(booking.advancePaid),
            remainingPayable: toMoney(booking.remainingPayable),
          }),
          reviewSubmittedAt: booking.reviewSubmittedAt?.toISOString() ?? null,
          reviewedAt: booking.reviewedAt?.toISOString() ?? null,
          reviewedByAdminId: booking.reviewedByAdminId ?? null,
          rejectionReason: booking.rejectionReason ?? null,
          approvalNotes: booking.approvalNotes ?? null,
          internalNotes: booking.internalNotes ?? null,
          agreementSigned: Boolean(latestSignedAgreement),
          cancelledReason: booking.cancelledReason ?? null,
          appliedCouponCode: couponCodes[0] ?? null,
          appliedCoupons,
          createdAt: booking.createdAt.toISOString(),
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        id: booking.id,
        bookingRef: booking.bookingRef,
        bookingStatus: booking.bookingStatus,
        paymentStatus: paymentStatusForDisplay,
        customer: {
          userId: booking.user?.id ?? null,
          name: booking.contactName ?? booking.user?.name ?? "",
          phone: booking.contactPhone ?? booking.user?.phone ?? "",
          email: booking.contactEmail ?? booking.user?.email ?? "",
        },
        locationId: booking.eventPackage?.locationId ?? "",
        date: schedule.date,
        eventStartTime: booking.eventStartTime ?? "",
        eventEndTime: booking.eventEndTime ?? "",
        packageId: booking.packageId,
        guestCount: booking.guestCount,
        decorationRequired: booking.decorationRequired,
        specialInstructions: booking.specialInstructions ?? "",
        occasionKey: booking.occasionKey ?? "",
        occasionData,
        couponCode: couponCodes[0] ?? "",
        couponCodes,
        appliedCoupons,
        items: booking.items.map((item) => {
          const isLedItem = isNumberDecorationProduct({
            slug: item.product?.slug,
            name: item.productName,
          });
          const ledNumber =
            isLedItem && ledNumberQueue.length > 0
              ? ledNumberQueue[Math.min(ledIndex++, ledNumberQueue.length - 1)]
              : null;

          return {
            id: item.id,
            productId: item.productId,
            variantId: item.variantId,
            productName: item.productName,
            variantLabel: item.variantLabel,
            quantity: item.quantity,
            unitPrice: toMoney(item.unitPrice),
            totalPrice: toMoney(item.totalPrice),
            category: item.category,
            ledNumber,
          };
        }),
        payment: {
          type: paymentType,
          amountMode: paymentAmountMode,
          advanceAmount: toMoney(booking.advancePaid),
          offlineMethod:
            latestPayment?.provider === "OFFLINE" && latestPayment.method
              ? latestPayment.method
              : "CASH",
          offlineReference:
            latestPayment?.provider === "OFFLINE"
              ? latestPayment.transactionId ?? ""
              : "",
          status: paymentStatusForDisplay,
        },
        pricing: {
          baseAmount: toMoney(booking.baseAmount),
          extrasAmount: toMoney(booking.extrasAmount),
          productsAmount: toMoney(booking.productsAmount),
          additionalChargeAmount: toMoney(booking.additionalChargeAmount),
          additionalChargeReason: booking.additionalChargeReason,
          decorationAmount: toMoney(booking.decorationAmount),
          discountAmount: toMoney(booking.discountAmount),
          totalAmount: toMoney(booking.totalAmount),
          advancePaid: toMoney(booking.advancePaid),
          remainingPayable: toMoney(booking.remainingPayable),
        },
      },
    });
  } catch (error) {
    console.error("ADMIN_BOOKING_DETAIL_ERROR", error);
    return bookingErrorResponse(
      500,
      "INTERNAL_ERROR",
      "Failed to fetch booking details."
    );
  }
}

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const adminId = await getAuthenticatedAdminId();
    if (!adminId) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const { id } = await context.params;
    const body = (await req.json().catch(() => null)) as UpdateBookingPayload | null;

    if (!body) {
      return bookingErrorResponse(400, "INVALID_REQUEST", "Invalid request payload.");
    }

    assertBookingMutationPayload(body, { requireSlot: false });
    ensureValidDateKey(body.date);

    const customerName = String(body.customer.name ?? "").trim();
    const phone = normalizeIndianPhone(String(body.customer.phone ?? ""));
    const emailRaw = String(body.customer.email ?? "").trim();
    const email = emailRaw.length > 0 ? emailRaw : null;
    const guestCount = Number(body.guestCount ?? 0);
    const decorationRequired = Boolean(body.decorationRequired);
    const specialInstructions =
      String(body.specialInstructions ?? "").trim() || null;
    const additionalChargeAmount = normalizeAdditionalChargeAmount(
      body.additionalChargeAmount
    );
    const additionalChargeReason =
      additionalChargeAmount > 0
        ? String(body.additionalChargeReason ?? "").trim() || null
        : null;

    if (!customerName) {
      throw new AdminBookingEditError(
        400,
        "INVALID_REQUEST",
        "Customer name is required."
      );
    }
    if (!isValidPhone(phone)) {
      throw new AdminBookingEditError(
        400,
        "INVALID_PHONE",
        "Enter a valid 10-digit phone number."
      );
    }
    if (email && !isValidEmail(email)) {
      throw new AdminBookingEditError(400, "INVALID_EMAIL", "Enter a valid email address.");
    }
    if (!Number.isInteger(guestCount) || guestCount < 1) {
      throw new AdminBookingEditError(
        400,
        "INVALID_GUEST_COUNT",
        "Guest count must be at least 1."
      );
    }

    // Online collection has been removed from admin bookings, so edits always
    // settle offline. Coercing here keeps the gateway out of the edit path
    // (avoids "Payment gateway is not configured") regardless of the payload.
    const paymentType = "OFFLINE" as PaymentType;
    const paymentAmountMode = body.payment.amountMode;
    if (hasMoreThanTwoDecimals(body.payment.advanceAmount ?? 0)) {
      throw new AdminBookingEditError(
        400,
        "INVALID_REQUEST",
        "Advance amount can have up to 2 decimal places."
      );
    }
    const customAdvanceAmount = toNonNegativeMoney(
      body.payment.advanceAmount ?? 0
    );
    if (!Number.isFinite(Number(body.payment.advanceAmount ?? 0))) {
      throw new AdminBookingEditError(
        400,
        "INVALID_REQUEST",
        "Advance amount must be zero or a positive number."
      );
    }
    // Admin collection is always offline; default the method so a partial payload
    // can't fail validation.
    const offlineMethod = body.payment.offlineMethod ?? "CASH";
    const offlineReference = body.payment.offlineReference?.trim() ?? "";
    const requestedPaymentStatus = body.payment.paymentStatus;
    if (!PAYMENT_TYPES.includes(paymentType as PaymentType)) {
      throw new AdminBookingEditError(
        400,
        "INVALID_REQUEST",
        "Invalid payment type selected."
      );
    }

    if (!PAYMENT_AMOUNT_MODES.includes(paymentAmountMode as PaymentAmountMode)) {
      throw new AdminBookingEditError(
        400,
        "INVALID_REQUEST",
        "Invalid payment amount mode."
      );
    }

    if (paymentType === "OFFLINE") {
      if (!OFFLINE_METHODS.includes(offlineMethod as OfflineMethod)) {
        throw new AdminBookingEditError(
          400,
          "INVALID_REQUEST",
          "Offline payment method is required."
        );
      }

      if (offlineMethod === "BANK" && !offlineReference) {
        throw new AdminBookingEditError(
          400,
          "OFFLINE_REFERENCE_REQUIRED",
          "Reference ID is required for Bank payments."
        );
      }
    }

    if (paymentAmountMode === "ADVANCE") {
      // Zero is a valid edit: an approved booking awaiting payment can be
      // updated without collecting anything.
      if (!Number.isFinite(customAdvanceAmount) || customAdvanceAmount < 0) {
        throw new AdminBookingEditError(
          400,
          "INVALID_REQUEST",
          "Advance amount must be zero or a positive number."
        );
      }
    }

    if (
      requestedPaymentStatus &&
      !Object.values(PaymentStatus).includes(requestedPaymentStatus)
    ) {
      throw new AdminBookingEditError(
        400,
        "INVALID_REQUEST",
        "Invalid payment status selected."
      );
    }

    let result = await prisma.$transaction(async (tx) => {
      const abandonedBookingIds = new Set<string>();
      const booking = await tx.booking.findUnique({
        where: { id },
        include: {
          eventPackage: {
            select: {
              name: true,
              eventDurationHours: true,
              hourlyRate: true,
              guestLimit: true,
              venueId: true,
              venue: {
                select: {
                  maxGuests: true,
                },
              },
            },
          },
          items: {
            select: {
              productId: true,
              variantId: true,
              productName: true,
              variantLabel: true,
              category: true,
              unitPrice: true,
              quantity: true,
            },
          },
        },
      });

      if (!booking) {
        throw new AdminBookingEditError(404, "BOOKING_NOT_FOUND", "Booking not found.");
      }

      if (booking.cancelledReason === ADMIN_SOFT_DELETE_REASON) {
        throw new AdminBookingEditError(404, "BOOKING_NOT_FOUND", "Booking not found.");
      }

      if (NON_EDITABLE_BOOKING_STATUSES.includes(booking.bookingStatus)) {
        throw new AdminBookingEditError(
          409,
          "BOOKING_FINALIZED",
          "This booking cannot be edited in its current status."
        );
      }

      const wasFullyPaid =
        booking.paymentStatus === PaymentStatus.PAID &&
        toMoney(booking.remainingPayable) <= 0;
      const nextPaymentStatus =
        requestedPaymentStatus ??
        booking.paymentStatus ??
        PaymentStatus.INITIALIZED;
      let onlineCollectionOrder: { amount: number } | null = null;

      if (wasFullyPaid && nextPaymentStatus !== PaymentStatus.PAID) {
        throw new AdminBookingEditError(
          409,
          "PAYMENT_DOWNGRADE_BLOCKED",
          "A fully paid booking cannot be downgraded."
        );
      }

      const rangeStartTime = body.startTime?.trim() || "";
      const rangeEndTime = body.endTime?.trim() || "";
      const rangeContext = await validateAdminRangeBooking(tx, {
        venueId: booking.venueId ?? booking.eventPackage?.venueId,
        date: body.date,
        startTime: rangeStartTime,
        endTime: rangeEndTime,
        guestCount,
        settings: {
          businessOpenTime: BOOKING_BUSINESS_OPEN_TIME,
          businessCloseTime: BOOKING_BUSINESS_CLOSE_TIME,
          minimumDurationMinutes:
            (booking.eventPackage?.eventDurationHours ?? 0) * 60 ||
            DEFAULT_MINIMUM_BOOKING_MINUTES,
          bufferMinutes: BOOKING_BUFFER_MINUTES,
          maximumGuests:
            booking.eventPackage?.guestLimit != null
              ? maxGuestsForIncluded(booking.eventPackage.guestLimit)
              : booking.eventPackage?.venue.maxGuests ?? 9999,
        },
        timezone: BOOKING_TIME_ZONE,
        excludeBookingId: booking.id,
      });

      const normalizedItemsMap = new Map<
        string,
        {
          productId: string;
          variantId: string;
          quantity: number;
          ledNumber?: string;
        }
      >();

      (body.items ?? []).forEach((item) => {
        const productId = String(item.productId ?? "").trim();
        const variantId = String(item.variantId ?? "").trim();
        const quantity = Number(item.quantity ?? 0);
        const ledNumber = String(item.ledNumber ?? "")
          .replace(/\D/g, "")
          .slice(0, 3);

        if (!productId || !variantId) {
          throw new AdminBookingEditError(
            400,
            "INVALID_REQUEST",
            "Each selected product must include productId and variantId."
          );
        }

        if (!Number.isInteger(quantity) || quantity < 0) {
          throw new AdminBookingEditError(
            400,
            "INVALID_REQUEST",
            "Product quantity must be a non-negative integer."
          );
        }

        if (quantity === 0) return;

        const key = `${productId}:${variantId}`;
        const existing = normalizedItemsMap.get(key);
        normalizedItemsMap.set(key, {
          productId,
          variantId,
          quantity: (existing?.quantity ?? 0) + quantity,
          ledNumber: ledNumber || existing?.ledNumber,
        });
      });

      const normalizedItems = Array.from(normalizedItemsMap.values());
      const variantIds = [...new Set(normalizedItems.map((item) => item.variantId))];
      const existingVariantIds = [...new Set(booking.items.map((item) => item.variantId))];

      const variants =
        variantIds.length > 0
          ? await tx.productVariant.findMany({
              where: {
                id: { in: variantIds },
                product: {
                  OR: [
                    { locationId: body.locationId },
                    { locationId: null },
                  ],
                },
                OR: [
                  {
                    isActive: true,
                    product: {
                      isActive: true,
                      OR: [
                        { locationId: body.locationId },
                        { locationId: null },
                      ],
                    },
                  },
                  {
                    id: { in: existingVariantIds },
                  },
                ],
              },
              include: {
                product: true,
              },
            })
          : [];

      const variantMap = new Map(variants.map((variant) => [variant.id, variant]));
      const existingBookingItemByKey = new Map(
        booking.items.map((item) => [
          `${item.productId}:${item.variantId}`,
          item,
        ])
      );

      const hasInvalidVariant = normalizedItems.some((item) => {
        if (variantMap.has(item.variantId)) return false;
        return !existingBookingItemByKey.has(`${item.productId}:${item.variantId}`);
      });

      if (hasInvalidVariant) {
        throw new AdminBookingEditError(
          400,
          "INVALID_PRODUCT_SELECTION",
          "One or more selected product variants are invalid for this location."
        );
      }

      const bookingItemsToCreate: Prisma.BookingItemCreateManyInput[] = [];
      // The tables and chairs a package includes are already paid for inside the
      // package price, so they must stay free on an edit exactly as they are on
      // create. Re-pricing them here silently inflated the customer's total.
      const includedProductSource = booking.eventPackage
        ? {
            name: booking.eventPackage.name,
            baseGuests: booking.eventPackage.guestLimit,
          }
        : null;
      const bookingDurationHours =
        calculateDurationHours(rangeStartTime, rangeEndTime) ?? 0;
      // Existing item snapshots were priced for the booking's previous times.
      const previousDurationHours = calculateDurationHours(
        booking.eventStartTime,
        booking.eventEndTime
      );
      let productsAmount = 0;
      const ledNumbers: string[] = [];
      const bodyOccasionData =
        body.occasionData && typeof body.occasionData === "object" && !Array.isArray(body.occasionData)
          ? (body.occasionData as Record<string, unknown>)
          : {};
      const incomingLedNumbers = extractLedNumbers(bodyOccasionData.ledNumber);
      const existingOccasionData =
        booking.occasionData &&
        typeof booking.occasionData === "object" &&
        !Array.isArray(booking.occasionData)
          ? (booking.occasionData as Record<string, unknown>)
          : {};
      const existingLedNumbers = extractLedNumbers(existingOccasionData.ledNumber);
      const incomingLedNumbersFallback = extractLedNumbersFromOccasionData(bodyOccasionData);
      const existingLedNumbersFallback = extractLedNumbersFromOccasionData(existingOccasionData);

      normalizedItems.forEach((item) => {
        const variant = variantMap.get(item.variantId);
        if (variant && variant.productId === item.productId) {
          const unitPrice = getDurationAdjustedUnitPrice({
            product: {
              slug: variant.product.slug,
              name: variant.product.name,
            },
            baseUnitPrice: toMoney(variant.salePrice ?? variant.regularPrice),
            durationHours: bookingDurationHours,
          });
          const totalPrice = getPackageIncludedProductTotalPrice({
            source: variant.isDefault ? includedProductSource : null,
            product: {
              slug: variant.product.slug,
              name: variant.product.name,
            },
            quantity: item.quantity,
            unitPrice,
          });
          productsAmount = centsToMoney(
            toCents(productsAmount) + toCents(totalPrice)
          );

          if (
            isNumberDecorationProduct({
              slug: variant.product.slug,
              name: variant.product.name,
            }) &&
            item.ledNumber &&
            item.ledNumber.trim().length > 0
          ) {
            ledNumbers.push(item.ledNumber.trim());
          }

          bookingItemsToCreate.push({
            bookingId: booking.id,
            productId: variant.productId,
            variantId: variant.id,
            productName: variant.product.name,
            variantLabel: variant.label,
            category: variant.product.category,
            unitPrice,
            quantity: item.quantity,
            totalPrice,
          });
          return;
        }

        const fallback = existingBookingItemByKey.get(`${item.productId}:${item.variantId}`);
        if (!fallback) {
          throw new AdminBookingEditError(
            400,
            "INVALID_PRODUCT_SELECTION",
            "Selected product and variant mapping is invalid."
          );
        }

        // The variant is gone, so the snapshot price is all we have. For
        // duration-priced products, move its overage from the previously
        // booked hours to the new ones.
        const unitPrice = rebaseDurationAdjustedUnitPrice({
          product: { name: fallback.productName },
          unitPrice: toMoney(fallback.unitPrice),
          fromDurationHours: previousDurationHours,
          toDurationHours: bookingDurationHours,
        });
        const totalPrice = multiplyMoney(unitPrice, item.quantity);
        productsAmount = centsToMoney(
          toCents(productsAmount) + toCents(totalPrice)
        );

        if (
          isNumberDecorationProduct({
            slug: undefined,
            name: fallback.productName,
          }) &&
          item.ledNumber &&
          item.ledNumber.trim().length > 0
        ) {
          ledNumbers.push(item.ledNumber.trim());
        }

        bookingItemsToCreate.push({
          bookingId: booking.id,
          productId: fallback.productId,
          variantId: fallback.variantId,
          productName: fallback.productName,
          variantLabel: fallback.variantLabel,
          category: fallback.category,
          unitPrice,
          quantity: item.quantity,
          totalPrice,
        });
      });

      let occasionKey: string | null = null;
      let occasionLabel: string | null = null;
      const occasionPayloadData: Record<string, string | string[]> = {};

      const incomingOccasionKey = String(body.occasionKey ?? "").trim();
      if (incomingOccasionKey) {
        const occasion = await tx.occasion.findFirst({
          where: {
            key: incomingOccasionKey,
            isActive: true,
          },
          include: {
            fields: {
              orderBy: { sortOrder: "asc" },
            },
          },
        });

        if (!occasion) {
          throw new AdminBookingEditError(
            400,
            "INVALID_OCCASION",
            "Selected occasion is invalid."
          );
        }

        const rawOccasionData = normalizeOccasionData(body.occasionData);
        const validatedOccasionData: Record<string, string> = {};

        occasion.fields.forEach((field) => {
          const value = String(rawOccasionData[field.fieldKey] ?? "").trim();
          if (field.isRequired && !value) {
            throw new AdminBookingEditError(
              400,
              "OCCASION_FIELD_REQUIRED",
              `${field.label} is required.`
            );
          }
          if (value) {
            validatedOccasionData[field.fieldKey] = value;
          }
        });

        occasionKey = occasion.key;
        occasionLabel = occasion.label;
        Object.assign(occasionPayloadData, validatedOccasionData);
      }

      if (ledNumbers.length === 1) {
        occasionPayloadData.ledNumber = ledNumbers[0];
      } else if (ledNumbers.length > 1) {
        occasionPayloadData.ledNumber = ledNumbers;
      } else {
        const hasLedItem = bookingItemsToCreate.some((item) =>
          isNumberDecorationProduct({
            slug: undefined,
            name: item.productName,
          })
        );
        if (hasLedItem) {
          const fallbackLedNumbers =
            incomingLedNumbers.length > 0
              ? incomingLedNumbers
              : existingLedNumbers.length > 0
              ? existingLedNumbers
              : incomingLedNumbersFallback.length > 0
              ? incomingLedNumbersFallback
              : existingLedNumbersFallback;
          if (fallbackLedNumbers.length === 1) {
            occasionPayloadData.ledNumber = fallbackLedNumbers[0];
          } else if (fallbackLedNumbers.length > 1) {
            occasionPayloadData.ledNumber = fallbackLedNumbers;
          }
        }
      }

      const occasionJson: Prisma.InputJsonValue | typeof Prisma.JsonNull =
        Object.keys(occasionPayloadData).length > 0
          ? (occasionPayloadData as Prisma.InputJsonValue)
          : Prisma.JsonNull;

      let linkedUserId: string | null = null;
      if (body.customer.userId) {
        const explicitUser = await tx.user.findUnique({
          where: { id: body.customer.userId },
        });

        if (!explicitUser) {
          throw new AdminBookingEditError(404, "USER_NOT_FOUND", "Selected user not found.");
        }

        if (explicitUser.phone !== phone) {
          throw new AdminBookingEditError(
            400,
            "USER_PHONE_MISMATCH",
            "Selected user does not match the entered phone number."
          );
        }

        linkedUserId = explicitUser.id;
      } else {
        const existingUser = await tx.user.findUnique({
          where: { phone },
          select: { id: true },
        });
        linkedUserId = existingUser?.id ?? null;
      }

      const minAdvanceAmount = await getRequiredAdminAdvanceAmount(tx);

      const packageSnap = booking.packageSnapshot as {
        decorationAddonPrice?: number;
        guestLimit?: number;
        subtotalAmount?: number;
        extraPersonPrice?: number;
        eventDurationHours?: number;
      } | null;
      const previousPricingSnapshot =
        booking.pricingSnapshot &&
        typeof booking.pricingSnapshot === "object" &&
        !Array.isArray(booking.pricingSnapshot)
          ? (booking.pricingSnapshot as Record<string, Prisma.JsonValue>)
          : {};
      const effectiveDecorationRequired = decorationRequired;

      // Extra-hour inputs follow the create flows: the live package record is
      // the source of truth, with the booking's own snapshot as the fallback
      // for packages that were unlinked or had their hourly rate cleared after
      // the booking was priced. bookingDurationHours is already derived from
      // the requested range above.
      const includedDurationHours =
        booking.eventPackage?.eventDurationHours ??
        packageSnap?.eventDurationHours ??
        toMoney(previousPricingSnapshot.includedDurationHours as number | null);
      const extraHourlyRate =
        booking.eventPackage?.hourlyRate ||
        toNonNegativeMoney(previousPricingSnapshot.extraHourlyRate as number | null);
      const packageGuestLimit =
        booking.eventPackage?.guestLimit ??
        packageSnap?.guestLimit ??
        toMoney(previousPricingSnapshot.packageGuestLimit as number | null);

      const pricingBase = calculateBookingPricing({
        slotBasePrice: packageSnap?.subtotalAmount ?? 0,
        slotFinalPrice: packageSnap?.subtotalAmount ?? null,
        guestCount,
        theatreBaseGuests: packageSnap?.guestLimit ?? 2,
        theatreExtraPersonPrice: PACKAGE_EXTRA_PERSON_PRICE,
        productsAmount,
        additionalChargeAmount,
        discountAmount: 0,
        advancePaid: 0,
        durationHours: bookingDurationHours,
        includedDurationHours,
        extraHourlyRate,
      });

      const couponResult = await evaluateAdminCoupons(tx, {
        couponCodes:
          body.couponCodes && body.couponCodes.length > 0
            ? body.couponCodes
            : body.couponCode
            ? [body.couponCode]
            : [],
        bookingSchedule: {
          eventDate: rangeContext.range.eventDate,
          eventStartTime: rangeStartTime,
          eventEndTime: rangeEndTime,
          startsAtUtc: rangeContext.range.startsAtUtc,
          endsAtUtc: rangeContext.range.endsAtUtc,
        },
        venueId: booking.venueId ?? "",
        locationId: body.locationId,
        userId: linkedUserId,
        userPhone: phone,
        decorationRequired: effectiveDecorationRequired,
        items: bookingItemsToCreate.map((item) => ({
          itemKey: item.variantId,
          productId: item.productId,
          category: item.category,
          totalPrice: toMoney(item.totalPrice),
        })),
        bookingSubtotal: pricingBase.totalAmount,
        slotAmount: pricingBase.baseAmount,
        nonSlotAmount: centsToMoney(
          toCents(pricingBase.extrasAmount) +
            toCents(pricingBase.decorationAmount) +
            toCents(pricingBase.productsAmount) +
            toCents(pricingBase.additionalChargeAmount)
        ),
        productsTotal: pricingBase.productsAmount,
        extrasTotal: pricingBase.extrasAmount,
        advanceFloor: minAdvanceAmount,
      });
      const couponDiscount = couponResult.totalDiscount;
      const totalAfterDiscount = Math.max(
        pricingBase.totalAmount - couponDiscount,
        0
      );

      // No fallback to the minimum here: zero means "collect nothing with this
      // edit", which must persist as zero.
      const desiredAdvance =
        paymentAmountMode === "FULL"
          ? totalAfterDiscount
          : toNonNegativeMoney(customAdvanceAmount);

      if (paymentAmountMode === "ADVANCE" && nextPaymentStatus !== PaymentStatus.PAID) {
        if (desiredAdvance > 0 && desiredAdvance < minAdvanceAmount) {
          throw new AdminBookingEditError(
            400,
            "ADVANCE_AMOUNT_TOO_LOW",
            `Advance amount must be at least Rs ${minAdvanceAmount}.`
          );
        }

        if (desiredAdvance > pricingBase.totalAmount) {
          throw new AdminBookingEditError(
            400,
            "INVALID_REQUEST",
            "Advance amount cannot exceed total booking amount."
          );
        }

        if (desiredAdvance > totalAfterDiscount) {
          throw new AdminBookingEditError(
            400,
            "INVALID_REQUEST",
            "Advance amount cannot exceed final total after discount."
          );
        }
      }

      const pricing = calculateBookingPricing({
        slotBasePrice: packageSnap?.subtotalAmount ?? 0,
        slotFinalPrice: packageSnap?.subtotalAmount ?? null,
        guestCount,
        theatreBaseGuests: packageSnap?.guestLimit ?? 2,
        theatreExtraPersonPrice: PACKAGE_EXTRA_PERSON_PRICE,
        productsAmount,
        additionalChargeAmount,
        discountAmount: couponDiscount,
        advancePaid: desiredAdvance,
        durationHours: bookingDurationHours,
        includedDurationHours,
        extraHourlyRate,
      });

      const currentAdvancePaid = Math.min(
        Math.max(Number(booking.advancePaid ?? 0), 0),
        pricing.totalAmount
      );
      const additionalAmountToCollect = Math.max(pricing.advancePaid - currentAdvancePaid, 0);
      const shouldCollectOnlineNow =
        paymentType === "ONLINE" &&
        additionalAmountToCollect > 0 &&
        booking.bookingStatus === BookingStatus.APPROVED &&
        (booking.paymentStatus ?? PaymentStatus.INITIALIZED) === PaymentStatus.PAID;
      // Offline money is in the admin's hand the moment they record it, exactly
      // as it is for an offline booking created by an admin. Without this the
      // booking keeps its old status, and the payment row below is never written.
      const collectsOfflineNow =
        paymentType === "OFFLINE" && additionalAmountToCollect > 0;
      const effectivePaymentStatus =
        shouldCollectOnlineNow || collectsOfflineNow
          ? PaymentStatus.PAID
          : nextPaymentStatus;
      const persistedAdvancePaid = shouldCollectOnlineNow
        ? currentAdvancePaid
        : pricing.advancePaid;
      const persistedRemainingPayable = Math.max(
        pricing.totalAmount - persistedAdvancePaid,
        0
      );

      if (shouldCollectOnlineNow) {
        onlineCollectionOrder = {
          amount: additionalAmountToCollect,
        };
      }

      // Recording payment never changes a review-workflow booking's status.
      // Legacy payment-first bookings (AWAITING_PAYMENT etc.) still normalize
      // to APPROVED when fully settled by an admin.
      const nextBookingStatus =
        effectivePaymentStatus === PaymentStatus.PAID &&
        !isReviewWorkflowBookingStatus(booking.bookingStatus)
          ? BookingStatus.APPROVED
          : booking.bookingStatus;

      // APPROVED bookings hold their stock from the moment of approval
      // (approveBooking and the admin create both decrement it), independent
      // of payment. Getting this wrong double-decrements when a payment is
      // recorded on an approved booking.
      const wasStockDeducted =
        booking.bookingStatus === BookingStatus.APPROVED;

      const oldQtyByVariant = new Map<string, number>();
      if (wasStockDeducted) {
        booking.items.forEach((item) => {
          oldQtyByVariant.set(
            item.variantId,
            (oldQtyByVariant.get(item.variantId) ?? 0) + item.quantity
          );
        });
      }

      const newQtyByVariant = new Map<string, number>();
      bookingItemsToCreate.forEach((item) => {
        newQtyByVariant.set(
          item.variantId,
          (newQtyByVariant.get(item.variantId) ?? 0) + item.quantity
        );
      });

      // An approved booking keeps holding stock even when no payment is
      // collected with this edit, so item changes still reconcile inventory.
      //
      // TODO(stock): recording a payment on a PENDING_REVIEW booking deducts
      // stock here (effectivePaymentStatus === PAID with wasStockDeducted
      // false), and approveBooking() deducts the same items again on approval.
      // Unreachable in the supported workflows (admins approve before
      // collecting payment), but any new pay-before-approval flow must
      // reconcile with approveBooking's decrement first.
      const willHoldStock =
        effectivePaymentStatus === PaymentStatus.PAID ||
        nextBookingStatus === BookingStatus.APPROVED;

      if (willHoldStock) {
        const variantIdsForStock = [
          ...new Set([
            ...Array.from(oldQtyByVariant.keys()),
            ...Array.from(newQtyByVariant.keys()),
          ]),
        ];
        const stockVariants =
          variantIdsForStock.length > 0
            ? await tx.productVariant.findMany({
                where: { id: { in: variantIdsForStock } },
                select: {
                  id: true,
                  stock: true,
                  product: {
                    select: {
                      name: true,
                    },
                  },
                },
              })
            : [];
        const stockVariantMap = new Map(
          stockVariants.map((variant) => [variant.id, variant])
        );

        for (const [variantId, newQty] of newQtyByVariant.entries()) {
          const variant = stockVariantMap.get(variantId);
          const oldQty = oldQtyByVariant.get(variantId) ?? 0;
          if (!variant) {
            if (newQty > oldQty) {
              const fallbackName =
                bookingItemsToCreate.find((item) => item.variantId === variantId)?.productName ??
                "Selected product";
              throw new AdminBookingEditError(
                409,
                "PRODUCT_UNAVAILABLE",
                `${fallbackName} is no longer available.`
              );
            }
            continue;
          }

        }

        for (const [variantId, oldQty] of oldQtyByVariant.entries()) {
          const newQty = newQtyByVariant.get(variantId) ?? 0;
          const delta = newQty - oldQty;
          if (delta >= 0) continue;

          await tx.productVariant.updateMany({
            where: { id: variantId },
            data: {
              stock: {
                increment: Math.abs(delta),
              },
            },
          });
        }

        for (const [variantId, newQty] of newQtyByVariant.entries()) {
          const oldQty = oldQtyByVariant.get(variantId) ?? 0;
          const delta = newQty - oldQty;
          if (delta <= 0) continue;

          const variant = stockVariantMap.get(variantId);
          const variantName =
            variant?.product.name ??
            bookingItemsToCreate.find((item) => item.variantId === variantId)?.productName ??
            "Selected product";
          if (!variant) {
            throw new AdminBookingEditError(
              409,
              "PRODUCT_UNAVAILABLE",
              `${variantName} is no longer available.`
            );
          }

          // stock === null means unlimited / untracked → never decrement.
          if (variant.stock === null) {
            continue;
          }

          const updatedStock = await tx.productVariant.updateMany({
            where: {
              id: variantId,
              stock: {
                gte: delta,
              },
            },
            data: {
              stock: {
                decrement: delta,
              },
            },
          });

          if (updatedStock.count === 0) {
            throw new AdminBookingEditError(
              409,
              "PRODUCT_OUT_OF_STOCK",
              `${variantName} is out of stock.`
            );
          }
        }
      } else if (wasStockDeducted) {
        for (const [variantId, oldQty] of oldQtyByVariant.entries()) {
          if (oldQty <= 0) continue;
          await tx.productVariant.updateMany({
            where: { id: variantId },
            data: {
              stock: {
                increment: oldQty,
              },
            },
          });
        }
      }

      const updated = await tx.booking.update({
        where: { id: booking.id },
        data: {
          userId: linkedUserId,
          contactName: customerName,
          contactPhone: phone,
          contactEmail: email,
          venueId: booking.venueId,
          eventDate: rangeContext.range.eventDate,
          eventStartTime: rangeStartTime,
          eventEndTime: rangeEndTime,
          startsAtUtc: rangeContext.range.startsAtUtc,
          endsAtUtc: rangeContext.range.endsAtUtc,
          occupiedUntilUtc: rangeContext.range.occupiedUntilUtc,
          bufferMinutes: BOOKING_BUFFER_MINUTES,
          timezone: booking.timezone ?? BOOKING_TIME_ZONE,
          occasionKey,
          occasionLabel,
          occasionData: occasionJson,
          guestCount,
          decorationRequired: effectiveDecorationRequired,
          specialInstructions,
          // Written in full from the freshly calculated pricing: merging over
          // the previous snapshot left extra-hour fields describing a charge
          // the recalculated total no longer carried.
          pricingSnapshot: {
            packageAmount: pricing.packageBaseAmount,
            packageGuestLimit,
            includedDurationHours,
            bookedDurationHours: bookingDurationHours,
            extraDurationHours: pricing.extraDurationHours,
            extraHourlyRate: pricing.extraHourlyRate,
            extraDurationAmount: pricing.extraHoursAmount,
            extraGuestPrice: PACKAGE_EXTRA_PERSON_PRICE,
            extraGuestAmount: pricing.extrasAmount,
            productsAmount: pricing.productsAmount,
            additionalChargeAmount: pricing.additionalChargeAmount,
            additionalChargeReason,
            decorationAmount: pricing.decorationAmount,
            discountAmount: pricing.discountAmount,
            totalAmount: pricing.totalAmount,
            advancePaid: persistedAdvancePaid,
            remainingPayable: persistedRemainingPayable,
          },
          baseAmount: pricing.baseAmount,
          extrasAmount: pricing.extrasAmount,
          productsAmount: pricing.productsAmount,
          additionalChargeAmount: pricing.additionalChargeAmount,
          additionalChargeReason,
          discountAmount: pricing.discountAmount,
          totalAmount: pricing.totalAmount,
          decorationAmount: pricing.decorationAmount,
          advancePaid: persistedAdvancePaid,
          remainingPayable: persistedRemainingPayable,
          paymentStatus: effectivePaymentStatus,
          bookingStatus: nextBookingStatus,
          createdByRole: booking.createdByRole ?? "ADMIN",
          createdByAdminId: booking.createdByAdminId ?? adminId,
        },
        select: {
          id: true,
          bookingRef: true,
        },
      });

      await tx.bookingItem.deleteMany({
        where: { bookingId: booking.id },
      });

      if (bookingItemsToCreate.length > 0) {
        await tx.bookingItem.createMany({
          data: bookingItemsToCreate,
        });
      }

      const couponSyncAt = new Date();
      await persistAdminBookingCoupons({
        tx,
        bookingId: booking.id,
        userId: linkedUserId ?? null,
        coupons: couponResult.coupons,
        // Approval confirms coupon usage in the review workflow, so an edit of
        // an approved-but-unpaid booking must not downgrade it to RESERVED.
        status:
          effectivePaymentStatus === PaymentStatus.PAID ||
          nextBookingStatus === BookingStatus.APPROVED
            ? "CONFIRMED"
            : "RESERVED",
        now: couponSyncAt,
        mode: "replace",
      });

      if (effectivePaymentStatus === PaymentStatus.PAID && paymentType === "OFFLINE") {
        const additionalPaid = Math.max(persistedAdvancePaid - currentAdvancePaid, 0);
        if (additionalPaid > 0) {
          await tx.payment.create({
            data: {
              bookingId: booking.id,
              provider: "OFFLINE",
              method: offlineMethod,
              transactionId: offlineReference || null,
              amount: additionalPaid,
              status: PaymentStatus.PAID,
              recordedByAdminId: adminId,
            },
          });
        }
      }

      return {
        ...updated,
        paymentType,
        onlineCollectionRequired: shouldCollectOnlineNow,
        amount: onlineCollectionOrder?.amount ?? null,
        paymentLinkUrl: null as string | null,
        paymentLinkId: null as string | null,
        abandonedBookingIds: Array.from(abandonedBookingIds),
        slotReassigned: false,
        slotReassignedSummary: null,
        adminNotification: null,
      };
    });

    if (result.onlineCollectionRequired) {
      const additionalAmount = Math.max(Number(result.amount ?? 0), 0);
      if (!Number.isFinite(additionalAmount) || additionalAmount <= 0) {
        throw new AdminBookingEditError(
          500,
          "ONLINE_PAYMENT_INIT_FAILED",
          "Unable to initialize online payment amount."
        );
      }

      const currency = getSquareCurrency();
      const baseUrl = (process.env.NEXT_PUBLIC_APP_URL?.trim() || "").replace(
        /\/+$/,
        ""
      );
      const createdLink = await createSquarePaymentLink({
        idempotencyKey: `topup:${result.id}:${Date.now()}`,
        name: `Haven Retreat ${result.bookingRef} (balance)`,
        amount: additionalAmount * 100,
        currency,
        redirectUrl: `${baseUrl}/booking/payment/square/return?bookingId=${encodeURIComponent(
          result.id
        )}`,
        bookingId: result.id,
        bookingRef: result.bookingRef,
      });

      await prisma.$transaction(async (tx) => {
        await tx.$queryRaw<{ id: string }[]>(Prisma.sql`
          SELECT id
          FROM "Booking"
          WHERE id = ${result.id}
          FOR UPDATE
        `);

        // Cancel any prior outstanding payment-link attempts for this booking
        // so only the latest link can settle the balance.
        await tx.payment.updateMany({
          where: {
            bookingId: result.id,
            provider: "SQUARE",
            bookingLockVersion: null,
            status: {
              in: [PaymentStatus.INITIALIZED, PaymentStatus.AWAITING_PAYMENT],
            },
            method: { startsWith: "PAYMENT_LINK:" },
          },
          data: {
            status: PaymentStatus.CANCELLED,
          },
        });

        await tx.payment.create({
          data: {
            bookingId: result.id,
            provider: "SQUARE",
            method: `PAYMENT_LINK:${createdLink.paymentLinkId}`,
            transactionId: createdLink.orderId,
            providerOrderId: createdLink.orderId,
            providerPayload: {
              source: "admin_edit_payment_link",
              checkoutUrl: createdLink.checkoutUrl,
              paymentLinkId: createdLink.paymentLinkId,
              orderId: createdLink.orderId,
            },
            amount: additionalAmount,
            status: PaymentStatus.AWAITING_PAYMENT,
            recordedByAdminId: adminId,
          },
        });
      });

      result = {
        ...result,
        amount: additionalAmount,
        paymentLinkUrl: createdLink.checkoutUrl,
        paymentLinkId: createdLink.paymentLinkId,
      };

      // Auto-email the link to the customer; the admin UI also surfaces it as a
      // fallback, so email failures should not block the response.
      const bookingContact = await prisma.booking.findUnique({
        where: { id: result.id },
        select: { contactEmail: true, contactName: true, bookingRef: true },
      });
      if (bookingContact?.contactEmail) {
        try {
          await sendBookingPaymentLinkEmail({
            to: bookingContact.contactEmail,
            bookingRef: bookingContact.bookingRef,
            customerName: bookingContact.contactName,
            amountDue: additionalAmount,
            currency,
            paymentLinkUrl: createdLink.checkoutUrl,
          });
        } catch (paymentLinkEmailError) {
          console.error(
            "ADMIN_EDIT_PAYMENT_LINK_EMAIL_FAILED",
            paymentLinkEmailError
          );
        }
      }
    }

    if (result.abandonedBookingIds.length > 0) {
      try {
        await notifyAbandonedBookingsByIds(result.abandonedBookingIds);
      } catch (notifyError) {
        console.error("ADMIN_UPDATE_BOOKING_ABANDONMENT_NOTIFY_FAILED", notifyError);
      }
    }

    return NextResponse.json({
      success: true,
      data: result,
      message: "Booking updated successfully.",
    });
  } catch (error) {
    if (error instanceof AdminRangeBookingError) {
      return bookingErrorResponse(409, error.code, error.message);
    }

    if (error instanceof BookingOverlapError) {
      return bookingErrorResponse(
        409,
        "RANGE_ALREADY_RESERVED",
        "Selected time range is already reserved."
      );
    }

    if (error instanceof SquareServerError) {
      return bookingErrorResponse(
        error.status === 500 ? 500 : 502,
        error.status === 500
          ? "PAYMENT_GATEWAY_NOT_CONFIGURED"
          : "PAYMENT_ORDER_FAILED",
        error.message
      );
    }

    if (error instanceof AdminBookingEditError) {
      return bookingErrorResponse(
        error.status,
        error.code,
        error.message,
        error.extra
      );
    }

    console.error("ADMIN_UPDATE_BOOKING_ERROR", error);
    return bookingErrorResponse(
      500,
      "INTERNAL_ERROR",
      "Failed to update booking."
    );
  }
}

export async function DELETE(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const adminId = await getAuthenticatedAdminId();
    if (!adminId) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const { id } = await context.params;
    if (!id) {
      return bookingErrorResponse(400, "BOOKING_ID_REQUIRED", "Booking id is required.");
    }

    const now = new Date();
    const result = await prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({
        where: { id },
      });

      if (!booking) {
        return null;
      }

      if (booking.cancelledReason === ADMIN_SOFT_DELETE_REASON) {
        return {
          id: booking.id,
          bookingRef: booking.bookingRef,
          alreadyDeleted: true,
        };
      }

      await tx.booking.update({
        where: { id: booking.id },
        data: {
          cancelledReason: ADMIN_SOFT_DELETE_REASON,
          cancelledAt: now,
        },
      });

      await tx.couponUsage.updateMany({
        where: {
          bookingId: booking.id,
          status: "RESERVED",
        },
        data: {
          status: "RELEASED",
          discountAmount: 0,
          releasedAt: now,
          confirmedAt: null,
        },
      });

      return {
        id: booking.id,
        bookingRef: booking.bookingRef,
        alreadyDeleted: false,
      };
    });

    if (!result) {
      return bookingErrorResponse(404, "BOOKING_NOT_FOUND", "Booking not found.");
    }

    return NextResponse.json({
      success: true,
      message: result.alreadyDeleted
        ? "Booking already deleted."
        : "Booking deleted successfully.",
      data: result,
    });
  } catch (error) {
    console.error("ADMIN_DELETE_BOOKING_ERROR", error);
    return bookingErrorResponse(
      500,
      "INTERNAL_ERROR",
      "Failed to delete booking."
    );
  }
}
