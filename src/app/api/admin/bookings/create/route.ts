import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { formatInTimeZone } from "date-fns-tz";
import { nanoid } from "nanoid";

import { prisma } from "@/lib/db";
import { bookingErrorResponse } from "@/lib/booking-api-response";
import { calculateBookingPricing } from "@/lib/booking-pricing";
import { PACKAGE_EXTRA_PERSON_PRICE } from "@/lib/package-guest-pricing";
import { resolveLocationDisplayName } from "@/lib/location-display";
import { timeToMinutes } from "@/lib/time";
import {
  getPackageIncludedProductTotalPrice,
  resolvePackageIncludedProducts,
} from "@/lib/package-included-products";
import { createBookingSessionToken } from "@/services/booking/bookingSession.server";
import { allocateBookingRef } from "@/services/booking/bookingId.service";
import { createSuccessToken } from "@/services/booking/successToken.server";
import { getAuthenticatedAdminIdFromCookies } from "@/services/auth/adminAuth.server";
import { sendBookingConfirmationWhatsApp } from "@/services/whatsapp.service";
import { sendBookingConfirmationEmail } from "@/services/booking/booking-confirmation-email.service";
import { sendAdminBookingConfirmationEmail } from "@/services/booking/admin-booking-confirmation-email.service";
import { notifyAbandonedBookingsByIds } from "@/services/booking/booking-abandonment-email.service";
import {
  type BookingConfirmationAddonItem,
  type BookingConfirmationDetail,
  type BookingConfirmationEmailProps,
} from "@/emails/BookingConfirmationEmail";
import { isNumberDecorationProduct } from "@/lib/product-numbering";
import {
  AdminRangeBookingError,
  validateAdminRangeBooking,
} from "@/services/booking/admin-range-booking.service";
import {
  BookingOverlapError,
} from "@/services/booking/booking-safety.service";
import {
  BOOKING_BUFFER_MINUTES,
  BOOKING_BUSINESS_CLOSE_TIME,
  BOOKING_BUSINESS_OPEN_TIME,
  BOOKING_TIME_ZONE,
  DEFAULT_MINIMUM_BOOKING_MINUTES,
} from "@/lib/booking-policy";
import {
  AdminBookingApiError as AdminBookingError,
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

type ConfirmationEmailData = BookingConfirmationEmailProps & {
  customerName: string;
  customerPhone: string;
  locationName: string;
};

type LookupUserPayload = {
  mode: "LOOKUP_USER";
  phone?: string;
};

type CreateBookingItemPayload = {
  productId?: string;
  variantId?: string;
  quantity?: number;
  ledNumber?: string;
};

type CreateBookingPayload = {
  mode?: "CREATE";
  locationId?: string;
  venueId?: string;
  date?: string;
  packageId?: string;
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
  occasionKey?: string;
  occasionData?: Record<string, unknown>;
  couponCode?: string;
  couponCodes?: string[];
  items?: CreateBookingItemPayload[];
  specialInstructions?: string;
  payment?: {
    type?: PaymentType;
    offlineMethod?: OfflineMethod;
    offlineReference?: string;
    amountMode?: PaymentAmountMode;
    advanceAmount?: number;
    offlineAmountMode?: PaymentAmountMode;
  };
  createdByAdminId?: string;
};

function buildEmailData(input: {
  bookingRef: string;
  successToken: string;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  locationName: string | null;
  theatreName: string;
  slotDate: Date;
  slotStartTime: string;
  slotEndTime: string;
  guestCount: number;
  occasionLabel: string | null;
  occasionData: Prisma.JsonValue | null;
  addonItems: BookingConfirmationAddonItem[];
  paymentType: string | null;
  paymentMethod: string | null;
  paymentStatus: string | null;
  paymentReference: string | null;
  baseAmount: number;
  extrasAmount: number;
  productsAmount: number;
  decorationAmount: number;
  discountAmount: number;
  totalAmount: number;
  advancePaid: number;
  remainingPayable: number;
}) {
  const data: ConfirmationEmailData = {
    bookingRef: input.bookingRef,
    customerName: input.contactName ?? "Guest",
    customerPhone: input.contactPhone ?? "—",
    customerEmail: input.contactEmail ?? undefined,
    locationName: input.locationName ?? "—",
    theatreName: input.theatreName,
    date: formatInTimeZone(input.slotDate, IST_TIMEZONE, "EEE, dd MMM yyyy"),
    timeSlot: `${input.slotStartTime} - ${input.slotEndTime}`,
    guestCount: input.guestCount,
    occasionLabel: input.occasionLabel ?? undefined,
    occasionDetails: buildOccasionDetails(input.occasionData),
    addonItems: input.addonItems,
    paymentType: input.paymentType ?? undefined,
    paymentMethod: input.paymentMethod ?? undefined,
    paymentStatus: input.paymentStatus ?? undefined,
    paymentReference: input.paymentReference ?? undefined,
    baseAmount: input.baseAmount,
    extrasAmount: input.extrasAmount,
    productsAmount: input.productsAmount,
    decorationAmount: input.decorationAmount,
    discountAmount: input.discountAmount,
    totalAmount: input.totalAmount,
    advancePaid: input.advancePaid,
    remainingPayable: input.remainingPayable,
    successUrl: `${process.env.NEXT_PUBLIC_APP_URL}/booking/success?t=${encodeURIComponent(
      input.successToken
    )}`,
  };

  return data;
}

function stringifyOccasionValue(value: Prisma.JsonValue): string {
  if (Array.isArray(value)) {
    const parts = value
      .map((item) => {
        if (typeof item === "string" || typeof item === "number" || typeof item === "boolean") {
          return String(item).trim();
        }
        return "";
      })
      .filter(Boolean);

    return parts.join(", ");
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value).trim();
  }

  return "";
}

function normalizeOccasionNumberKey(key: string) {
  return key.trim().toLowerCase().replace(/[_\-\s]+/g, "");
}

function isOccasionNumberKey(key: string) {
  const normalized = normalizeOccasionNumberKey(key);
  return (
    normalized === "lednumber" ||
    normalized === "ledno" ||
    normalized === "led"
  );
}

function extractNumberValues(value: Prisma.JsonValue | undefined): string[] {
  if (Array.isArray(value)) {
    return value
      .flatMap((entry) => extractNumberValues(entry as Prisma.JsonValue))
      .filter(Boolean);
  }

  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    const raw = String(value).trim();
    if (!raw) return [];

    return raw
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
  }

  return [];
}

function buildOccasionDetails(
  occasionData: Prisma.JsonValue | null
): BookingConfirmationDetail[] {
  if (!occasionData || typeof occasionData !== "object" || Array.isArray(occasionData)) {
    return [];
  }

  const source = occasionData as Record<string, Prisma.JsonValue>;
  return Object.entries(source)
    .filter(([label]) => !isOccasionNumberKey(label))
    .map(([label, value]) => ({
      label,
      value: stringifyOccasionValue(value),
    }))
    .filter((entry) => entry.value.length > 0);
}

function extractLedNumbersFromOccasionData(
  occasionData: Prisma.JsonValue | null
) {
  if (!occasionData || typeof occasionData !== "object" || Array.isArray(occasionData)) {
    return [] as string[];
  }

  const source = occasionData as Record<string, Prisma.JsonValue>;
  const directKeys = ["ledNumber", "led_number", "ledNo", "ledno", "led"];

  for (const key of directKeys) {
    if (key in source) {
      const values = extractNumberValues(source[key]);
      if (values.length > 0) {
        return values;
      }
    }
  }

  for (const [key, value] of Object.entries(source)) {
    if (!isOccasionNumberKey(key)) continue;
    const values = extractNumberValues(value);
    if (values.length > 0) {
      return values;
    }
  }

  return [] as string[];
}

function buildAddonItemsWithNumberValues(
  items: Array<{
    productName: string;
    variantLabel: string;
    quantity: number;
    totalPrice: number;
  }>,
  occasionData: Prisma.JsonValue | null
): BookingConfirmationAddonItem[] {
  const ledNumbers = extractLedNumbersFromOccasionData(occasionData);
  let ledIndex = 0;

  return items.map((item) => {
    const isNumberItem = isNumberDecorationProduct({ name: item.productName });
    const numberValue = isNumberItem ? ledNumbers[ledIndex++] : undefined;

    return {
      name: item.productName,
      variantLabel: item.variantLabel,
      quantity: item.quantity,
      totalPrice: item.totalPrice,
      numberValue,
    };
  });
}

async function createBookingWithUniqueRef(
  tx: Prisma.TransactionClient,
  now: Date,
  data: Omit<Prisma.BookingUncheckedCreateInput, "bookingRef">
) {
  const bookingRef = await allocateBookingRef(tx, now);
  return tx.booking.create({
    data: {
      ...data,
      bookingRef,
    },
  });
}

export async function POST(req: Request) {
  try {
    const authenticatedAdminId = await getAuthenticatedAdminIdFromCookies();
    if (!authenticatedAdminId) {
      return bookingErrorResponse(401, "UNAUTHORIZED", "Unauthorized");
    }

    const body = (await req.json().catch(() => null)) as
      | LookupUserPayload
      | CreateBookingPayload
      | null;

    if (!body) {
      return bookingErrorResponse(
        400,
        "INVALID_REQUEST",
        "Invalid request payload."
      );
    }

    if (body.mode === "LOOKUP_USER") {
      const normalizedPhone = normalizeIndianPhone(body.phone ?? "");

      if (!isValidPhone(normalizedPhone)) {
        return bookingErrorResponse(
          400,
          "INVALID_PHONE",
          "Enter a valid 10-digit phone number."
        );
      }

      const existingUser = await prisma.user.findUnique({
        where: { phone: normalizedPhone },
        select: {
          id: true,
          name: true,
          phone: true,
          email: true,
        },
      });

      return NextResponse.json({
        success: true,
        data: {
          exists: Boolean(existingUser),
          user: existingUser ?? null,
        },
      });
    }

    assertBookingMutationPayload(body, { requireSlot: false });

    ensureValidDateKey(body.date);

    const customerName = String(body.customer.name ?? "").trim();
    const phone = normalizeIndianPhone(String(body.customer.phone ?? ""));
    const emailRaw = String(body.customer.email ?? "").trim();
    const email = emailRaw.length > 0 ? emailRaw : null;
    const guestCount = Number(body.guestCount ?? 0);
    const decorationRequired = Boolean(body.decorationRequired);
    const specialInstructions = String(body.specialInstructions ?? "").trim() || null;
    const paymentType = body.payment.type;
    const createdByAdminId = authenticatedAdminId;

    if (!customerName) {
      throw new AdminBookingError(400, "INVALID_REQUEST", "Customer name is required.");
    }
    if (!isValidPhone(phone)) {
      throw new AdminBookingError(
        400,
        "INVALID_PHONE",
        "Enter a valid 10-digit phone number."
      );
    }
    if (email && !isValidEmail(email)) {
      throw new AdminBookingError(400, "INVALID_EMAIL", "Enter a valid email address.");
    }
    if (!Number.isInteger(guestCount) || guestCount < 1) {
      throw new AdminBookingError(
        400,
        "INVALID_GUEST_COUNT",
        "Guest count must be at least 1."
      );
    }
    if (!PAYMENT_TYPES.includes(paymentType as PaymentType)) {
      throw new AdminBookingError(400, "INVALID_REQUEST", "Invalid payment type selected.");
    }

    const offlineMethod = body.payment.offlineMethod;
    const paymentAmountMode =
      body.payment.amountMode ?? body.payment.offlineAmountMode ?? "ADVANCE";
    const offlineReference = body.payment.offlineReference?.trim() ?? "";
    const customAdvanceAmount = Number(body.payment.advanceAmount ?? 0);

    if (paymentType === "OFFLINE") {
      if (!OFFLINE_METHODS.includes(offlineMethod as OfflineMethod)) {
        throw new AdminBookingError(
          400,
          "INVALID_REQUEST",
          "Offline payment method is required."
        );
      }
      if (!PAYMENT_AMOUNT_MODES.includes(paymentAmountMode as PaymentAmountMode)) {
        throw new AdminBookingError(
          400,
          "INVALID_REQUEST",
          "Invalid payment amount mode."
        );
      }
      if (offlineMethod === "BANK" && !offlineReference) {
        throw new AdminBookingError(
          400,
          "OFFLINE_REFERENCE_REQUIRED",
          "Reference ID is required for Bank payments."
        );
      }
    }

    if (!PAYMENT_AMOUNT_MODES.includes(paymentAmountMode as PaymentAmountMode)) {
      throw new AdminBookingError(
        400,
        "INVALID_REQUEST",
        "Invalid payment amount mode."
      );
    }

    if (paymentAmountMode === "ADVANCE") {
      if (!Number.isFinite(customAdvanceAmount) || customAdvanceAmount <= 0) {
        throw new AdminBookingError(
          400,
          "INVALID_REQUEST",
          "Advance amount must be a positive number."
        );
      }
    }

    const lockOwner =
      paymentType === "ONLINE"
        ? `admin_${nanoid(20)}`
        : null;

    const now = new Date();

    const result = await prisma.$transaction(async (tx) => {
      const abandonedBookingIds = new Set<string>();
      const rangeStartTime = body.startTime?.trim() || "";
      const rangeEndTime = body.endTime?.trim() || "";
      const selectedPackage = body.packageId
        ? await tx.eventPackage.findFirst({
            where: {
              id: body.packageId,
              isActive: true,
              venue: { isActive: true },
            },
            include: {
              venue: true,
              features: {
                orderBy: { sortOrder: "asc" },
              },
            },
          })
        : null;

      if (body.packageId && !selectedPackage) {
        throw new AdminBookingError(
          400,
          "INVALID_REQUEST",
          "Select a valid active package."
        );
      }
      if (!selectedPackage) {
        throw new AdminBookingError(
          400,
          "INVALID_REQUEST",
          "A package is required for a range booking."
        );
      }

      const rangeContext = await validateAdminRangeBooking(tx, {
        venueId: selectedPackage.venueId,
        date: body.date,
        startTime: rangeStartTime,
        endTime: rangeEndTime,
        guestCount,
        settings: {
          businessOpenTime: BOOKING_BUSINESS_OPEN_TIME,
          businessCloseTime: BOOKING_BUSINESS_CLOSE_TIME,
          minimumDurationMinutes:
            selectedPackage.eventDurationHours * 60 ||
            DEFAULT_MINIMUM_BOOKING_MINUTES,
          bufferMinutes: BOOKING_BUFFER_MINUTES,
          maximumGuests:
            selectedPackage.venue.maxGuests ?? selectedPackage.guestLimit,
        },
        timezone: BOOKING_TIME_ZONE,
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
          throw new AdminBookingError(
            400,
            "INVALID_REQUEST",
            "Each selected product must include productId and variantId."
          );
        }

        if (!Number.isInteger(quantity) || quantity < 0) {
          throw new AdminBookingError(
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

      const includedProductSource = selectedPackage
        ? {
            name: selectedPackage.name,
            baseGuests: selectedPackage.guestLimit,
          }
        : null;
      const packageIncludedProducts = resolvePackageIncludedProducts(
        includedProductSource
      );
      const packageIncludedProductSlugs = Object.keys(packageIncludedProducts);

      if (packageIncludedProductSlugs.length > 0) {
        const includedProducts = await tx.product.findMany({
          where: {
            slug: { in: packageIncludedProductSlugs },
            isActive: true,
            OR: [
              { locationId: body.locationId },
              { locationId: null },
            ],
          },
          include: {
            variants: {
              where: { isActive: true },
              orderBy: { sortOrder: "asc" },
            },
          },
        });

        includedProducts.forEach((product) => {
          const includedQuantity =
            packageIncludedProducts[product.slug] ?? 0;
          const variant =
            product.variants.find((item) => item.isDefault) ??
            product.variants[0];
          if (includedQuantity <= 0 || !variant) return;

          const key = `${product.id}:${variant.id}`;
          const existing = normalizedItemsMap.get(key);
          normalizedItemsMap.set(key, {
            productId: product.id,
            variantId: variant.id,
            quantity: Math.max(existing?.quantity ?? 0, includedQuantity),
            ledNumber: existing?.ledNumber,
          });
        });
      }

      const normalizedItems = Array.from(normalizedItemsMap.values());
      const variantIds = [...new Set(normalizedItems.map((item) => item.variantId))];

      const variants =
        variantIds.length > 0
          ? await tx.productVariant.findMany({
              where: {
                id: { in: variantIds },
                isActive: true,
                product: {
                  isActive: true,
                  OR: [
                    { locationId: body.locationId },
                    { locationId: null },
                  ],
                },
              },
              include: {
                product: true,
              },
            })
          : [];

      const variantMap = new Map(variants.map((variant) => [variant.id, variant]));

      if (variantIds.length > 0 && variants.length !== variantIds.length) {
        throw new AdminBookingError(
          400,
          "INVALID_PRODUCT_SELECTION",
          "One or more selected product variants are invalid for this location."
        );
      }

      const bookingItemsToCreate: Prisma.BookingItemCreateManyInput[] = [];
      let productsAmount = 0;
      const ledNumbers: string[] = [];

      normalizedItems.forEach((item) => {
        const variant = variantMap.get(item.variantId);
        if (!variant || variant.productId !== item.productId) {
          throw new AdminBookingError(
            400,
            "INVALID_PRODUCT_SELECTION",
            "Selected product and variant mapping is invalid."
          );
        }

        if (item.quantity > variant.stock) {
          throw new AdminBookingError(
            409,
            "PRODUCT_OUT_OF_STOCK",
            `${variant.product.name} is out of stock.`
          );
        }

        const unitPrice = variant.salePrice ?? variant.regularPrice;
        const totalPrice = getPackageIncludedProductTotalPrice({
          source: variant.isDefault ? includedProductSource : null,
          product: {
            slug: variant.product.slug,
            name: variant.product.name,
          },
          quantity: item.quantity,
          unitPrice,
        });
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
          bookingId: "",
          productId: variant.productId,
          variantId: variant.id,
          productName: variant.product.name,
          variantLabel: variant.label,
          category: variant.product.category,
          unitPrice,
          quantity: item.quantity,
          totalPrice,
        });
      });

      if (paymentType === "OFFLINE" && bookingItemsToCreate.length > 0) {
        for (const item of bookingItemsToCreate) {
          const updated = await tx.productVariant.updateMany({
            where: {
              id: item.variantId,
              stock: {
                gte: item.quantity,
              },
            },
            data: {
              stock: {
                decrement: item.quantity,
              },
            },
          });

          if (updated.count === 0) {
            throw new AdminBookingError(
              409,
              "PRODUCT_OUT_OF_STOCK",
              `${item.productName} is out of stock.`
            );
          }
        }
      }

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
          throw new AdminBookingError(
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
            throw new AdminBookingError(
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
          throw new AdminBookingError(
            404,
            "USER_NOT_FOUND",
            "Selected user not found."
          );
        }

        if (explicitUser.phone !== phone) {
          throw new AdminBookingError(
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

      const includedDurationHours = selectedPackage?.eventDurationHours ?? 0;
      const extraHourlyRate = selectedPackage?.hourlyRate ?? 0;
      const bookingDurationHours = rangeStartTime && rangeEndTime
        ? Math.max((timeToMinutes(rangeEndTime) - timeToMinutes(rangeStartTime)) / 60, 0)
        : 0;

      const effectiveDecorationRequired = decorationRequired;

      const pricingBase = calculateBookingPricing({
        slotBasePrice: selectedPackage?.subtotalAmount ?? 0,
        slotFinalPrice: selectedPackage?.subtotalAmount ?? null,
        guestCount,
        theatreBaseGuests: selectedPackage?.guestLimit ?? 2,
        theatreExtraPersonPrice: PACKAGE_EXTRA_PERSON_PRICE,
        theatreDecorationPrice: selectedPackage?.decorationAddonPrice ?? 0,
        slotDecorationMandatory: false,
        decorationRequired: effectiveDecorationRequired,
        productsAmount,
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
        venueId: selectedPackage.venueId,
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

      if (paymentAmountMode === "ADVANCE") {
        if (desiredAdvance < minAdvanceAmount) {
          throw new AdminBookingError(
            400,
            "ADVANCE_AMOUNT_TOO_LOW",
            `Advance amount must be at least Rs ${minAdvanceAmount}.`
          );
        }

        if (desiredAdvance > pricingBase.totalAmount) {
          throw new AdminBookingError(
            400,
            "INVALID_REQUEST",
            "Advance amount cannot exceed total booking amount."
          );
        }

        if (desiredAdvance > totalAfterDiscount) {
          throw new AdminBookingError(
            400,
            "INVALID_REQUEST",
            "Advance amount cannot exceed final total after discount."
          );
        }
      }

      const pricing = calculateBookingPricing({
        slotBasePrice: selectedPackage?.subtotalAmount ?? 0,
        slotFinalPrice: selectedPackage?.subtotalAmount ?? null,
        guestCount,
        theatreBaseGuests: selectedPackage?.guestLimit ?? 2,
        theatreExtraPersonPrice: PACKAGE_EXTRA_PERSON_PRICE,
        theatreDecorationPrice: selectedPackage?.decorationAddonPrice ?? 0,
        slotDecorationMandatory: false,
        decorationRequired: effectiveDecorationRequired,
        productsAmount,
        discountAmount: couponDiscount,
        advancePaid: desiredAdvance,
        durationHours: bookingDurationHours,
        includedDurationHours,
        extraHourlyRate,
      });

      const booking = await createBookingWithUniqueRef(tx, now, {
        userId: linkedUserId,
        contactName: customerName,
        contactPhone: phone,
        contactEmail: email,
        venueId: selectedPackage?.venueId,
        packageId: selectedPackage?.id,
        eventDate: rangeContext.range.eventDate,
        eventStartTime: rangeStartTime,
        eventEndTime: rangeEndTime,
        startsAtUtc: rangeContext.range.startsAtUtc,
        endsAtUtc: rangeContext.range.endsAtUtc,
        occupiedUntilUtc: rangeContext.range.occupiedUntilUtc,
        bufferMinutes: BOOKING_BUFFER_MINUTES,
        timezone: BOOKING_TIME_ZONE,
        packageSnapshot: selectedPackage
          ? {
              id: selectedPackage.id,
              venueId: selectedPackage.venueId,
              name: selectedPackage.name,
              slug: selectedPackage.slug,
              guestLimit: selectedPackage.guestLimit,
              eventDurationHours: selectedPackage.eventDurationHours,
              complimentarySetupHours:
                selectedPackage.complimentarySetupHours,
              rentalAmount: selectedPackage.rentalAmount,
              decorationAmount: selectedPackage.decorationAmount,
              cleaningAmount: selectedPackage.cleaningAmount,
              subtotalAmount: selectedPackage.subtotalAmount,
              savingsAmount: 0,
              finalAmount: selectedPackage.subtotalAmount,
              decorationAddonPrice: selectedPackage.decorationAddonPrice,
              extraPersonPrice: PACKAGE_EXTRA_PERSON_PRICE,
              features: selectedPackage.features.map((feature) => ({
                group: feature.group,
                label: feature.label,
                value: feature.value,
                icon: feature.icon,
                sortOrder: feature.sortOrder,
              })),
              venue: {
                id: selectedPackage.venue.id,
                name: selectedPackage.venue.name,
                slug: selectedPackage.venue.slug,
              },
            }
          : undefined,
        pricingSnapshot: selectedPackage
          ? {
              packageAmount: selectedPackage.subtotalAmount,
              packageGuestLimit: selectedPackage.guestLimit,
              includedDurationHours,
              bookedDurationHours: bookingDurationHours,
              extraDurationHours: pricing.extraDurationHours,
              extraHourlyRate: pricing.extraHourlyRate,
              extraDurationAmount: pricing.extraHoursAmount,
              extraGuestPrice: PACKAGE_EXTRA_PERSON_PRICE,
              extraGuestAmount: pricing.extrasAmount,
              productsAmount: pricing.productsAmount,
              decorationAmount: pricing.decorationAmount,
              discountAmount: pricing.discountAmount,
              totalAmount: pricing.totalAmount,
              advancePaid: pricing.advancePaid,
              remainingPayable: pricing.remainingPayable,
            }
          : undefined,
        occasionKey,
        occasionLabel,
        occasionData: occasionJson,
        specialInstructions,
        guestCount,
        decorationRequired: effectiveDecorationRequired,
        baseAmount: pricing.baseAmount,
        extrasAmount: pricing.extrasAmount,
        productsAmount: pricing.productsAmount,
        discountAmount: pricing.discountAmount,
        totalAmount: pricing.totalAmount,
        decorationAmount: pricing.decorationAmount,
        advancePaid: pricing.advancePaid,
        remainingPayable: pricing.remainingPayable,
        paymentStatus: paymentType === "OFFLINE" ? "PAID" : "INITIALIZED",
        bookingStatus: paymentType === "OFFLINE" ? "CONFIRMED" : "AWAITING_PAYMENT",
        termsAcceptedAt: now,
        createdByRole: "ADMIN",
        createdByAdminId,
      });

      if (bookingItemsToCreate.length > 0) {
        await tx.bookingItem.createMany({
          data: bookingItemsToCreate.map((item) => ({
            ...item,
            bookingId: booking.id,
          })),
        });
      }

      if (paymentType === "OFFLINE") {
        await tx.payment.create({
          data: {
            bookingId: booking.id,
            provider: "OFFLINE",
            method: offlineMethod,
            transactionId: offlineReference || null,
            amount: pricing.advancePaid,
            status: "PAID",
            recordedByAdminId: createdByAdminId,
          },
        });
      }

      if (couponResult.coupons.length > 0) {
        await persistAdminBookingCoupons({
          tx,
          bookingId: booking.id,
          userId: linkedUserId ?? null,
          coupons: couponResult.coupons,
          status: paymentType === "OFFLINE" ? "CONFIRMED" : "RESERVED",
          now,
          mode: "create",
        });
      }

      return {
        bookingId: booking.id,
        bookingRef: booking.bookingRef,
        paymentType,
        lockOwner,
        abandonedBookingIds: Array.from(abandonedBookingIds),
        successToken:
          paymentType === "OFFLINE"
            ? createSuccessToken(booking.id, booking.bookingRef)
            : null,
      };
    });

    const offlineSuccessRedirect =
      result.paymentType === "OFFLINE" && result.successToken
        ? `/booking/success?t=${encodeURIComponent(result.successToken)}`
        : null;

    const response = NextResponse.json({
      success: true,
      data: {
        bookingId: result.bookingId,
        bookingRef: result.bookingRef,
        paymentType: result.paymentType,
        successToken: result.successToken,
        redirectUrl:
          result.paymentType === "ONLINE"
            ? "/booking/payment"
            : offlineSuccessRedirect ??
              `/admin/bookings?ref=${encodeURIComponent(result.bookingRef)}`,
      },
    });

    if (result.paymentType === "ONLINE" && result.lockOwner) {
      response.cookies.set("ds_lock_owner", result.lockOwner, {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 2,
      });
      response.cookies.set(
        "ds_booking_session",
        createBookingSessionToken(result.bookingId, result.lockOwner),
        {
          httpOnly: true,
          sameSite: "lax",
          path: "/",
          maxAge: 60 * 60 * 2,
        }
      );
    }

    if (result.abandonedBookingIds.length > 0) {
      try {
        await notifyAbandonedBookingsByIds(result.abandonedBookingIds);
      } catch (notifyError) {
        console.error("ADMIN_CREATE_BOOKING_ABANDONMENT_NOTIFY_FAILED", notifyError);
      }
    }

    if (result.paymentType === "OFFLINE") {
      const bookingForNotification = await prisma.booking.findUnique({
        where: { id: result.bookingId },
        include: {
          venue: true,
          items: {
            orderBy: { createdAt: "asc" },
          },
          payment: {
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
      });

      if (bookingForNotification) {
        const successToken = createSuccessToken(
          bookingForNotification.id,
          bookingForNotification.bookingRef
        );
        const addonItems = buildAddonItemsWithNumberValues(
          bookingForNotification.items.map((item) => ({
            productName: item.productName,
            variantLabel: item.variantLabel,
            quantity: item.quantity,
            totalPrice: item.totalPrice,
          })),
          bookingForNotification.occasionData as Prisma.JsonValue | null
        );
        const latestPayment = bookingForNotification.payment[0];
        const slotDate = bookingForNotification.eventDate;
        const slotStartTime = bookingForNotification.eventStartTime;
        const slotEndTime = bookingForNotification.eventEndTime;

        const packageSnapshotForEmail = bookingForNotification.packageSnapshot as { name?: string } | null;
        const emailData =
          slotDate && slotStartTime && slotEndTime
            ? buildEmailData({
                bookingRef: bookingForNotification.bookingRef,
                successToken,
                contactName: bookingForNotification.contactName,
                contactPhone: bookingForNotification.contactPhone,
                contactEmail: bookingForNotification.contactEmail,
                locationName: resolveLocationDisplayName(
                  null,
                  bookingForNotification.venue?.city
                ),
                theatreName:
                  packageSnapshotForEmail?.name ??
                  bookingForNotification.venue?.name ??
                  "Haven Retreat",
                slotDate,
                slotStartTime,
                slotEndTime,
                guestCount: bookingForNotification.guestCount,
                occasionLabel: bookingForNotification.occasionLabel,
                occasionData:
                  bookingForNotification.occasionData as Prisma.JsonValue | null,
                addonItems,
                paymentType: "OFFLINE",
                paymentMethod: latestPayment?.method ?? null,
                paymentStatus:
                  bookingForNotification.paymentStatus ??
                  latestPayment?.status ??
                  null,
                paymentReference: latestPayment?.transactionId ?? null,
                baseAmount: bookingForNotification.baseAmount,
                extrasAmount: bookingForNotification.extrasAmount,
                productsAmount: bookingForNotification.productsAmount,
                decorationAmount: bookingForNotification.decorationAmount,
                discountAmount: bookingForNotification.discountAmount,
                totalAmount: bookingForNotification.totalAmount,
                advancePaid: bookingForNotification.advancePaid,
                remainingPayable: bookingForNotification.remainingPayable,
              })
            : null;

        if (bookingForNotification.contactEmail && emailData) {
          try {
            await sendBookingConfirmationEmail({
              to: bookingForNotification.contactEmail,
              bookingRef: bookingForNotification.bookingRef,
              emailData,
              theme: process.env.BOOKING_EMAIL_THEME,
            });

            await prisma.booking.update({
              where: { id: bookingForNotification.id },
              data: { confirmationEmailSent: true },
            });
          } catch (emailError) {
            console.error("ADMIN_OFFLINE_CONFIRMATION_EMAIL_FAILED", emailError);
          }
        }

        if (emailData) {
          try {
            await sendAdminBookingConfirmationEmail({
              bookingRef: bookingForNotification.bookingRef,
              emailData,
              confirmationSource: "ADMIN_OFFLINE_CREATE",
            });
          } catch (adminEmailError) {
            console.error(
              "ADMIN_OFFLINE_ADMIN_CONFIRMATION_EMAIL_FAILED",
              adminEmailError
            );
          }
        }

        if (bookingForNotification.contactPhone && emailData) {
          try {
            await sendBookingConfirmationWhatsApp({
              phone: bookingForNotification.contactPhone.startsWith("91")
                ? bookingForNotification.contactPhone
                : `91${bookingForNotification.contactPhone}`,
              customerName: emailData.customerName,
              bookingRef: bookingForNotification.bookingRef,
              location: emailData.locationName,
              theatre: emailData.theatreName,
              dateTime: `${emailData.date}, ${emailData.timeSlot}`,
              guests: String(emailData.guestCount),
              totalAmount: String(emailData.totalAmount),
              advancePaid: String(emailData.advancePaid),
              payAtTheatre: String(emailData.remainingPayable),
              bookingUrl: emailData.successUrl,
            });
          } catch (whatsappError) {
            console.error(
              "ADMIN_OFFLINE_CONFIRMATION_WHATSAPP_FAILED",
              whatsappError
            );
          }
        }
      }
    }

    return response;
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

    if (error instanceof AdminBookingError) {
      return bookingErrorResponse(
        error.status,
        error.code,
        error.message,
        error.extra
      );
    }

    console.error("ADMIN_CREATE_BOOKING_ERROR", error);
    return bookingErrorResponse(
      500,
      "INTERNAL_ERROR",
      "Failed to create admin booking."
    );
  }
}
