import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { Prisma, PaymentStatus, BookingStatus } from "@prisma/client";
import { formatInTimeZone } from "date-fns-tz";

import { prisma } from "@/lib/db";
import { getCouponDisplayCode } from "@/lib/coupon-display";
import { bookingErrorResponse } from "@/lib/booking-api-response";
import { calculateBookingPricing } from "@/lib/booking-pricing";
import { isSlotExpiredInIST } from "@/lib/slot-time";
import { formatSlotTime } from "@/lib/formatters";
import { getAuthenticatedAdminIdFromCookies } from "@/services/auth/adminAuth.server";
import {
  AdminBookingApiError as AdminBookingEditError,
  IST_TIMEZONE,
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
import { overrideLockedSlotForAdmin } from "@/services/booking/admin-slot-override.service";
import { resolveSlotExpiryConfig } from "@/services/booking/slot-expiry-config.service";
import { isNumberDecorationProduct } from "@/lib/product-numbering";
import { notifyAbandonedBookingsByIds } from "@/services/booking/booking-abandonment-email.service";
import {
  createRazorpayOrder,
  RazorpayServerError,
} from "@/lib/razorpay/server";
import {
  BookingOverlapError,
  BookingSlotLockError,
  lockSlotRowForUpdate,
  validateNoOverlappingActiveBooking,
} from "@/services/booking/booking-safety.service";

const NON_EDITABLE_BOOKING_STATUSES: BookingStatus[] = [
  BookingStatus.CANCELLED,
  BookingStatus.ABANDONED,
  BookingStatus.PAID_EXPIRED,
];
const ADMIN_SOFT_DELETE_REASON = "ADMIN_SOFT_DELETED";

function resolveDisplayPaymentStatus(
  paymentStatus: PaymentStatus | null | undefined,
  razorpayOrderId: string | null | undefined
): PaymentStatus {
  if (!paymentStatus) {
    return PaymentStatus.INITIALIZED;
  }

  // Legacy safety: `AWAITING_PAYMENT` should only exist after order creation.
  if (
    paymentStatus === PaymentStatus.AWAITING_PAYMENT &&
    !razorpayOrderId
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
  date?: string;
  theatreId?: string;
  slotId?: string;
  customer?: {
    name?: string;
    phone?: string;
    email?: string;
    userId?: string;
  };
  guestCount?: number;
  decorationRequired?: boolean;
  occasionKey?: string;
  occasionData?: Record<string, unknown>;
  couponCode?: string;
  couponCodes?: string[];
  items?: UpdateBookingItemPayload[];
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

type AdminSlotAvailabilityNotification = {
  type: "PREMIUM_SLOT_RELEASED";
  title: string;
  message: string;
  details: {
    bookingRef: string;
    slotId: string;
    theatreName: string;
    date: string;
    startTime: string;
    endTime: string;
    finalPrice: number;
    status: "AVAILABLE";
  };
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
        theatre: {
          select: {
            id: true,
            name: true,
            locationId: true,
            images: true,
            baseGuests: true,
            capacity: true,
            extraPersonPrice: true,
            decorationPrice: true,
            location: {
              select: {
                name: true,
              },
            },
          },
        },
        venue: {
          select: {
            id: true,
            name: true,
            images: true,
          },
        },
        slot: {
          select: {
            id: true,
            date: true,
            startTime: true,
            endTime: true,
            status: true,
            basePrice: true,
            finalPrice: true,
            decorationMandatory: true,
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
            signerName: true,
            signerEmail: true,
            signedAt: true,
            signatureImage: true,
            ipAddress: true,
            userAgent: true,
            agreementVersion: true,
            confirmationAccepted: true,
            paymentReference: true,
            pdfGeneratedAt: true,
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
      booking.advancePaid >= booking.totalAmount ? "FULL" : "ADVANCE";

    const occasionData = (booking.occasionData as Record<string, unknown> | null) ?? {};
    const ledNumberQueue = extractLedNumbersFromOccasionData(occasionData);
    let ledIndex = 0;
    const appliedCoupons = booking.couponUsages.map((usage) => ({
      couponId: usage.coupon.id,
      code: getCouponDisplayCode(usage.coupon.code),
      discountAmount: usage.discountAmount ?? 0,
      status: usage.status,
      reservedAt: usage.reservedAt,
      confirmedAt: usage.confirmedAt,
      releasedAt: usage.releasedAt,
    }));
    const couponCodes = appliedCoupons.map((coupon) => coupon.code);

    const paymentStatusForDisplay = resolveDisplayPaymentStatus(
      booking.paymentStatus,
      booking.razorpayOrderId
    );
    const displaySpace = {
      id: booking.theatre?.id ?? booking.venue?.id ?? "",
      name: booking.theatre?.name ?? booking.venue?.name ?? "Haven Retreat",
      image: booking.theatre?.images?.[0] ?? booking.venue?.images?.[0] ?? null,
      locationName: booking.theatre?.location?.name ?? booking.venue?.name ?? "—",
    };
    const scheduleDate = booking.slot?.date ?? booking.eventDate;
    const scheduleStartTime = booking.slot?.startTime ?? booking.eventStartTime ?? "";
    const scheduleEndTime = booking.slot?.endTime ?? booking.eventEndTime ?? "";
    const scheduleDateKey = scheduleDate
      ? formatInTimeZone(scheduleDate, IST_TIMEZONE, "yyyy-MM-dd")
      : "";

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
            locationName: displaySpace.locationName,
          },
          locationName: displaySpace.locationName,
          theatreImage: displaySpace.image,
          slot: {
            id: booking.slot?.id ?? null,
            date: scheduleDateKey,
            startTime: scheduleStartTime,
            endTime: scheduleEndTime,
            status: booking.slot?.status ?? booking.bookingStatus,
            basePrice: booking.slot?.basePrice ?? null,
            finalPrice: booking.slot?.finalPrice ?? null,
            decorationMandatory: booking.slot?.decorationMandatory ?? false,
          },
          guestCount: booking.guestCount,
          decorationRequired: booking.decorationRequired,
          pricing: {
            base: booking.baseAmount,
            extras: booking.extrasAmount,
            products: booking.productsAmount,
            decoration: booking.decorationAmount,
            discount: booking.discountAmount,
            total: booking.totalAmount,
            advancePaid: booking.advancePaid,
            remainingPayable: booking.remainingPayable,
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
              unitPrice: item.unitPrice,
              totalPrice: item.totalPrice,
              image: item.product?.image ?? null,
              category: item.category,
              ledNumber,
            };
          }),
          occasionLabel: booking.occasionLabel ?? null,
          occasionKey: booking.occasionKey ?? null,
          occasionData,
          confirmationEmailSent: booking.confirmationEmailSent,
          abandonmentCustomerEmailSentAt:
            booking.abandonmentCustomerEmailSentAt?.toISOString() ?? null,
          abandonmentAdminEmailSentAt:
            booking.abandonmentAdminEmailSentAt?.toISOString() ?? null,
          termsAcceptedAt: booking.termsAcceptedAt?.toISOString() ?? null,
          signedAgreement: latestSignedAgreement
            ? {
                id: latestSignedAgreement.id,
                signerName: latestSignedAgreement.signerName,
                signerEmail: latestSignedAgreement.signerEmail,
                signedAt: latestSignedAgreement.signedAt.toISOString(),
                signatureImage: latestSignedAgreement.signatureImage,
                ipAddress: latestSignedAgreement.ipAddress,
                userAgent: latestSignedAgreement.userAgent,
                agreementVersion: latestSignedAgreement.agreementVersion,
                confirmationAccepted: latestSignedAgreement.confirmationAccepted,
                paymentReference: latestSignedAgreement.paymentReference,
                pdfGeneratedAt: latestSignedAgreement.pdfGeneratedAt?.toISOString() ?? null,
                createdAt: latestSignedAgreement.createdAt.toISOString(),
              }
            : null,
          razorpayOrderId: booking.razorpayOrderId ?? null,
          razorpayPaymentId: booking.razorpayPaymentId ?? null,
          razorpaySignature: booking.razorpaySignature ?? null,
          paymentDetails: latestPayment
            ? {
                provider: latestPayment.provider,
                method: latestPayment.method,
                transactionId: latestPayment.transactionId,
                amount: latestPayment.amount,
                status: latestPayment.status,
                createdAt: latestPayment.createdAt.toISOString(),
                recordedByAdminId: latestPayment.recordedByAdminId,
              }
            : null,
          createdByRole: booking.createdByRole ?? null,
          createdByAdminId: booking.createdByAdminId ?? null,
          paymentStatus: paymentStatusForDisplay,
          bookingStatus: booking.bookingStatus,
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
        locationId: booking.theatre?.locationId ?? "",
        date: scheduleDateKey,
        theatreId: booking.theatreId,
        slotId: booking.slotId,
        guestCount: booking.guestCount,
        decorationRequired: booking.decorationRequired,
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
            unitPrice: item.unitPrice,
            totalPrice: item.totalPrice,
            category: item.category,
            ledNumber,
          };
        }),
        payment: {
          type: paymentType,
          amountMode: paymentAmountMode,
          advanceAmount: booking.advancePaid,
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
          baseAmount: booking.baseAmount,
          extrasAmount: booking.extrasAmount,
          productsAmount: booking.productsAmount,
          decorationAmount: booking.decorationAmount,
          discountAmount: booking.discountAmount,
          totalAmount: booking.totalAmount,
          advancePaid: booking.advancePaid,
          remainingPayable: booking.remainingPayable,
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

    assertBookingMutationPayload(body);
    ensureValidDateKey(body.date);

    const customerName = String(body.customer.name ?? "").trim();
    const phone = normalizeIndianPhone(String(body.customer.phone ?? ""));
    const emailRaw = String(body.customer.email ?? "").trim();
    const email = emailRaw.length > 0 ? emailRaw : null;
    const guestCount = Number(body.guestCount ?? 0);
    const decorationRequired = Boolean(body.decorationRequired);

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

    const paymentType = body.payment.type;
    const paymentAmountMode = body.payment.amountMode;
    const customAdvanceAmount = Number(body.payment.advanceAmount ?? 0);
    const offlineMethod = body.payment.offlineMethod;
    const offlineReference = body.payment.offlineReference?.trim() ?? "";
    const requestedPaymentStatus = body.payment.paymentStatus;
    const cookieStore = await cookies();
    const requestedLockOwner =
      cookieStore.get("ds_lock_owner")?.value ?? null;

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

      if ((offlineMethod === "UPI" || offlineMethod === "BANK") && !offlineReference) {
        throw new AdminBookingEditError(
          400,
          "OFFLINE_REFERENCE_REQUIRED",
          "Reference ID is required for UPI or Bank payments."
        );
      }
    }

    if (paymentAmountMode === "ADVANCE") {
      if (!Number.isFinite(customAdvanceAmount) || customAdvanceAmount <= 0) {
        throw new AdminBookingEditError(
          400,
          "INVALID_REQUEST",
          "Advance amount must be a positive number."
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
          slot: true,
          theatre: true,
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
        booking.paymentStatus === PaymentStatus.PAID && booking.remainingPayable <= 0;
      const nextPaymentStatus =
        requestedPaymentStatus ??
        booking.paymentStatus ??
        PaymentStatus.INITIALIZED;
      let adminNotification: AdminSlotAvailabilityNotification | null = null;
      let onlineCollectionOrder: { id: string; amount: number } | null = null;

      if (wasFullyPaid && nextPaymentStatus !== PaymentStatus.PAID) {
        throw new AdminBookingEditError(
          409,
          "PAYMENT_DOWNGRADE_BLOCKED",
          "A fully paid booking cannot be downgraded."
        );
      }

      await lockSlotRowForUpdate(tx, {
        slotId: body.slotId,
        context: "admin-booking-update",
      });

      let slot = await tx.slot.findUnique({
        where: { id: body.slotId },
        include: {
          theatre: true,
        },
      });

      if (!slot) {
        throw new AdminBookingEditError(
          404,
          "SLOT_NOT_FOUND",
          "Selected slot does not exist."
        );
      }

      if (slot.theatreId !== body.theatreId || slot.theatre.locationId !== body.locationId) {
        throw new AdminBookingEditError(
          400,
          "INVALID_REQUEST",
          "Selected slot does not belong to the chosen theatre/location."
        );
      }

      const slotDateKey = formatInTimeZone(slot.date, IST_TIMEZONE, "yyyy-MM-dd");
      if (slotDateKey !== body.date) {
        throw new AdminBookingEditError(
          409,
          "SLOT_DATE_MISMATCH",
          "Selected date does not match the selected slot."
        );
      }

      if (guestCount > slot.theatre.capacity) {
        throw new AdminBookingEditError(
          400,
          "GUEST_LIMIT_EXCEEDED",
          `Guest count cannot exceed theatre capacity (${slot.theatre.capacity}).`
        );
      }

      const slotChanged = slot.id !== booking.slotId;
      if (slotChanged) {
        if (!booking.slot) {
          throw new AdminBookingEditError(
            409,
            "SLOT_CHANGE_NOT_ALLOWED",
            "This booking does not have a previous slot to change."
          );
        }

        const currentSlotStarted = isSlotExpiredInIST(
          { startTime: booking.slot.startTime, endTime: booking.slot.endTime },
          booking.slot.date,
          { mode: "START_TIME" }
        );

        if (currentSlotStarted) {
          throw new AdminBookingEditError(
            409,
            "SLOT_CHANGE_NOT_ALLOWED",
            "Slot cannot be changed after it has started."
          );
        }
      }

      if (slotChanged && slot.status === "LOCKED") {
        if (!body.allowLockedSlotOverride) {
          const lockedBySameSession = Boolean(
            requestedLockOwner && slot.lockedBy === requestedLockOwner
          );
          throw new AdminBookingEditError(
            409,
            "SLOT_LOCKED_ACTIVE_SESSION",
            lockedBySameSession
              ? "This slot is currently reserved in your active booking session. Do you want to override the existing session and proceed with admin booking?"
              : "This slot is currently locked by another customer session. Do you want to override and proceed with admin booking?",
            {
              lockContext: lockedBySameSession
                ? "same_session"
                : "other_session",
            }
          );
        }

        const overrideResult = await overrideLockedSlotForAdmin(tx, {
          slotId: slot.id,
          adminId,
          now: new Date(),
        });
        overrideResult.abandonedBookingIds.forEach((id) => abandonedBookingIds.add(id));

        const refreshedSlot = await tx.slot.findUnique({
          where: { id: slot.id },
          include: { theatre: true },
        });
        if (!refreshedSlot) {
          throw new AdminBookingEditError(
            404,
            "SLOT_NOT_FOUND",
            "Selected slot does not exist."
          );
        }
        slot = refreshedSlot;
      }

      if (slotChanged && slot.status !== "AVAILABLE") {
        throw new AdminBookingEditError(
          409,
          "SLOT_UNAVAILABLE",
          "Selected slot is no longer available."
        );
      }

      const slotExpiryConfig = await resolveSlotExpiryConfig(tx);
      const isNewSlotExpired = isSlotExpiredInIST(
        { startTime: slot.startTime, endTime: slot.endTime },
        slot.date,
        slotExpiryConfig
      );
      if (slotChanged && isNewSlotExpired) {
        throw new AdminBookingEditError(
          409,
          "SLOT_UNAVAILABLE",
          "Selected slot is no longer available."
        );
      }

      await validateNoOverlappingActiveBooking(tx, {
        theatreId: slot.theatreId,
        date: slot.date,
        startTime: slot.startTime,
        endTime: slot.endTime,
        excludeBookingId: booking.id,
        context: "admin-booking-update",
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
          const unitPrice = variant.salePrice ?? variant.regularPrice;
          const totalPrice = unitPrice * item.quantity;
          productsAmount += totalPrice;

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

        const unitPrice = fallback.unitPrice;
        const totalPrice = unitPrice * item.quantity;
        productsAmount += totalPrice;

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

      const effectiveDecorationRequired = slot.decorationMandatory
        ? true
        : decorationRequired;

      const pricingBase = calculateBookingPricing({
        slotBasePrice: slot.basePrice,
        slotFinalPrice: slot.finalPrice,
        guestCount,
        theatreBaseGuests: slot.theatre.baseGuests,
        theatreExtraPersonPrice: slot.theatre.extraPersonPrice,
        theatreDecorationPrice: slot.theatre.decorationPrice,
        slotDecorationMandatory: slot.decorationMandatory,
        decorationRequired: effectiveDecorationRequired,
        productsAmount,
        discountAmount: 0,
        advancePaid: 0,
      });

      const couponResult = await evaluateAdminCoupons(tx, {
        couponCodes:
          body.couponCodes && body.couponCodes.length > 0
            ? body.couponCodes
            : body.couponCode
            ? [body.couponCode]
            : [],
        slot: {
          id: slot.id,
          date: slot.date,
          startTime: slot.startTime,
          endTime: slot.endTime,
          durationMin: slot.durationMin,
        },
        theatreId: slot.theatreId,
        locationId: body.locationId,
        userId: linkedUserId,
        userPhone: phone,
        decorationRequired: effectiveDecorationRequired,
        items: bookingItemsToCreate.map((item) => ({
          itemKey: item.variantId,
          productId: item.productId,
          category: item.category,
          totalPrice: item.totalPrice,
        })),
        bookingSubtotal: pricingBase.totalAmount,
        slotAmount: pricingBase.baseAmount,
        nonSlotAmount:
          pricingBase.extrasAmount +
          pricingBase.decorationAmount +
          pricingBase.productsAmount,
        productsTotal: pricingBase.productsAmount,
        extrasTotal: pricingBase.extrasAmount,
        advanceFloor: minAdvanceAmount,
      });
      const couponDiscount = couponResult.totalDiscount;
      const totalAfterDiscount = Math.max(
        pricingBase.totalAmount - couponDiscount,
        0
      );

      const desiredAdvance =
        paymentAmountMode === "FULL"
          ? totalAfterDiscount
          : Math.trunc(customAdvanceAmount || minAdvanceAmount);

      if (paymentAmountMode === "ADVANCE" && nextPaymentStatus !== PaymentStatus.PAID) {
        if (desiredAdvance < minAdvanceAmount) {
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
        slotBasePrice: slot.basePrice,
        slotFinalPrice: slot.finalPrice,
        guestCount,
        theatreBaseGuests: slot.theatre.baseGuests,
        theatreExtraPersonPrice: slot.theatre.extraPersonPrice,
        theatreDecorationPrice: slot.theatre.decorationPrice,
        slotDecorationMandatory: slot.decorationMandatory,
        decorationRequired: effectiveDecorationRequired,
        productsAmount,
        discountAmount: couponDiscount,
        advancePaid: desiredAdvance,
      });

      const currentAdvancePaid = Math.min(
        Math.max(Number(booking.advancePaid ?? 0), 0),
        pricing.totalAmount
      );
      const additionalAmountToCollect = Math.max(pricing.advancePaid - currentAdvancePaid, 0);
      const shouldCollectOnlineNow =
        paymentType === "ONLINE" &&
        additionalAmountToCollect > 0 &&
        booking.bookingStatus === BookingStatus.CONFIRMED &&
        (booking.paymentStatus ?? PaymentStatus.INITIALIZED) === PaymentStatus.PAID;
      const effectivePaymentStatus = shouldCollectOnlineNow
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
          id: "",
          amount: additionalAmountToCollect * 100,
        };
      }

      if (slotChanged) {
        const reserveNextSlot = await tx.slot.updateMany({
          where: {
            id: slot.id,
            status: "AVAILABLE",
          },
          data: {
            status: "BOOKED",
            lockedAt: null,
            lockExpiresAt: null,
            lockedBy: null,
          },
        });

        if (reserveNextSlot.count === 0) {
          throw new AdminBookingEditError(
            409,
            "SLOT_UNAVAILABLE",
            "Selected slot is no longer available."
          );
        }
      } else if (
        effectivePaymentStatus === PaymentStatus.PAID &&
        booking.slot?.status !== "BOOKED"
      ) {
        await tx.slot.updateMany({
          where: {
            id: slot.id,
            status: {
              in: ["AVAILABLE", "LOCKED"],
            },
          },
          data: {
            status: "BOOKED",
            lockedAt: null,
            lockExpiresAt: null,
            lockedBy: null,
          },
        });
      }

      const nextBookingStatus =
        effectivePaymentStatus === PaymentStatus.PAID
          ? BookingStatus.CONFIRMED
          : booking.bookingStatus;

      const wasStockDeducted =
        booking.paymentStatus === PaymentStatus.PAID &&
        booking.bookingStatus === BookingStatus.CONFIRMED;

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

      if (effectivePaymentStatus === PaymentStatus.PAID) {
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
          theatreId: slot.theatreId,
          slotId: slot.id,
          occasionKey,
          occasionLabel,
          occasionData: occasionJson,
          guestCount,
          decorationRequired: effectiveDecorationRequired,
          baseAmount: pricing.baseAmount,
          extrasAmount: pricing.extrasAmount,
          productsAmount: pricing.productsAmount,
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
        status:
          effectivePaymentStatus === PaymentStatus.PAID ? "CONFIRMED" : "RESERVED",
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

      if (slotChanged && booking.slotId && booking.slot) {
        const otherActiveBookings = await tx.booking.count({
          where: {
            slotId: booking.slotId,
            id: { not: booking.id },
            bookingStatus: {
              notIn: [
                BookingStatus.CANCELLED,
                BookingStatus.ABANDONED,
                BookingStatus.PAID_EXPIRED,
              ],
            },
          },
        });

        if (otherActiveBookings === 0) {
          const releasedPreviousSlot = await tx.slot.updateMany({
            where: {
              id: booking.slotId,
              status: {
                in: ["BOOKED", "LOCKED"],
              },
            },
            data: {
              status: "AVAILABLE",
              lockedAt: null,
              lockExpiresAt: null,
              lockedBy: null,
            },
          });

          if (releasedPreviousSlot.count > 0) {
            const dateLabel = formatInTimeZone(
              booking.slot.date,
              IST_TIMEZONE,
              "dd MMM yyyy"
            );
            adminNotification = {
              type: "PREMIUM_SLOT_RELEASED",
              title: "Premium slot status updated",
              message: `Premium slot is now available: ${
                booking.theatre?.name ?? "Haven Retreat"
              } | ${dateLabel} | ${booking.slot.startTime} - ${booking.slot.endTime} | Booking ${booking.bookingRef}`,
              details: {
                bookingRef: booking.bookingRef,
                slotId: booking.slotId,
                theatreName: booking.theatre?.name ?? "Haven Retreat",
                date: formatInTimeZone(booking.slot.date, IST_TIMEZONE, "yyyy-MM-dd"),
                startTime: booking.slot.startTime,
                endTime: booking.slot.endTime,
                finalPrice: booking.slot.finalPrice,
                status: "AVAILABLE",
              },
            };
          }
        }
      }

      return {
        ...updated,
        paymentType,
        onlineCollectionRequired: shouldCollectOnlineNow,
        orderId: onlineCollectionOrder?.id ?? null,
        amount: onlineCollectionOrder?.amount ?? null,
        abandonedBookingIds: Array.from(abandonedBookingIds),
        slotReassigned: slotChanged,
        slotReassignedSummary: slotChanged
          ? {
              theatreName: slot.theatre.name,
              dateLabel: formatInTimeZone(slot.date, IST_TIMEZONE, "dd MMM"),
              timeRangeLabel: formatSlotTime(slot.startTime, slot.endTime),
            }
          : null,
        adminNotification,
      };
    });

    if (result.onlineCollectionRequired) {
      const orderAmountInPaise = Math.max(Number(result.amount ?? 0), 0);
      if (!Number.isFinite(orderAmountInPaise) || orderAmountInPaise <= 0) {
        throw new AdminBookingEditError(
          500,
          "ONLINE_PAYMENT_INIT_FAILED",
          "Unable to initialize online payment amount."
        );
      }

      const orderAmountInRupees = Math.max(Math.round(orderAmountInPaise / 100), 0);
      const orderResolution = await prisma.$transaction(async (tx) => {
        await tx.$queryRaw<{ id: string }[]>(Prisma.sql`
          SELECT id
          FROM "Booking"
          WHERE id = ${result.id}
          FOR UPDATE
        `);

        const pendingPaymentForRetry = await tx.payment.findFirst({
          where: {
            bookingId: result.id,
            provider: "RAZORPAY",
            status: PaymentStatus.INITIALIZED,
            transactionId: {
              not: null,
            },
            amount: orderAmountInRupees,
          },
          orderBy: { createdAt: "desc" },
          select: {
            transactionId: true,
          },
        });

        if (pendingPaymentForRetry?.transactionId) {
          await tx.booking.update({
            where: { id: result.id },
            data: {
              razorpayOrderId: pendingPaymentForRetry.transactionId,
              razorpayPaymentId: null,
              razorpaySignature: null,
            },
          });

          return {
            orderId: pendingPaymentForRetry.transactionId,
            amount: orderAmountInPaise,
          };
        }

        const receipt = `${result.bookingRef}-ADM-${Date.now()}`.slice(0, 40);
        const createdOrder = await createRazorpayOrder({
          amount: orderAmountInPaise,
          currency: "INR",
          receipt,
          payment_capture: true,
        });

        await tx.payment.updateMany({
          where: {
            bookingId: result.id,
            provider: "RAZORPAY",
            status: PaymentStatus.INITIALIZED,
          },
          data: {
            status: PaymentStatus.CANCELLED,
          },
        });

        await tx.payment.create({
          data: {
            bookingId: result.id,
            provider: "RAZORPAY",
            method: "ONLINE",
            transactionId: createdOrder.id,
            amount: Math.max(Math.round(Number(createdOrder.amount) / 100), 0),
            status: PaymentStatus.INITIALIZED,
            recordedByAdminId: adminId,
          },
        });

        await tx.booking.update({
          where: { id: result.id },
          data: {
            razorpayOrderId: createdOrder.id,
            razorpayPaymentId: null,
            razorpaySignature: null,
          },
        });

        return {
          orderId: createdOrder.id,
          amount: Number(createdOrder.amount),
        };
      });

      result = {
        ...result,
        orderId: orderResolution.orderId,
        amount: orderResolution.amount,
      };
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
    if (error instanceof BookingSlotLockError) {
      return bookingErrorResponse(
        404,
        "SLOT_NOT_FOUND",
        "Selected slot does not exist."
      );
    }

    if (error instanceof BookingOverlapError) {
      return bookingErrorResponse(
        409,
        "RANGE_ALREADY_RESERVED",
        "Selected time range is already reserved."
      );
    }

    if (error instanceof RazorpayServerError) {
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
        include: {
          slot: {
            select: {
              id: true,
              status: true,
            },
          },
        },
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

      const activeConfirmedBookingsOnSlot = await tx.booking.count({
        where: {
          slotId: booking.slot?.id ?? "",
          bookingStatus: BookingStatus.CONFIRMED,
          OR: [
            { cancelledReason: null },
            { cancelledReason: { not: ADMIN_SOFT_DELETE_REASON } },
          ],
        },
      });

      if (
        booking.slot?.status === "LOCKED" &&
        booking.bookingStatus !== BookingStatus.CONFIRMED
      ) {
        await tx.slot.updateMany({
          where: {
            id: booking.slot.id,
            status: "LOCKED",
          },
          data: {
            status: "AVAILABLE",
            lockedAt: null,
            lockExpiresAt: null,
            lockedBy: null,
          },
        });
      }

      if (
        booking.slot?.status === "BOOKED" &&
        activeConfirmedBookingsOnSlot === 0
      ) {
        await tx.slot.updateMany({
          where: {
            id: booking.slot.id,
            status: "BOOKED",
          },
          data: {
            status: "AVAILABLE",
            lockedAt: null,
            lockExpiresAt: null,
            lockedBy: null,
          },
        });
      }

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
