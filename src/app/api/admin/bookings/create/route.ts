import { after, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { formatCalendarDate } from "@/lib/formatters";
import { nanoid } from "nanoid";

import { prisma } from "@/lib/db";
import { bookingErrorResponse } from "@/lib/booking-api-response";
import { calculateBookingPricing } from "@/lib/booking-pricing";
import { appLogger } from "@/lib/app-logger";
import { createPerformanceProfiler } from "@/lib/performance-profiler";
import {
  centsToMoney,
  hasMoreThanTwoDecimals,
  toCents,
  toMoney,
  toNonNegativeMoney,
} from "@/lib/money";
import {
  PACKAGE_EXTRA_PERSON_PRICE,
  maxGuestsForIncluded,
} from "@/lib/package-guest-pricing";
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
import { sendBookingApprovedEmail } from "@/services/booking/booking-review-email.service";
import { sendAdminBookingConfirmationEmail } from "@/services/booking/admin-booking-confirmation-email.service";
import { notifyAbandonedBookingsByIds } from "@/services/booking/booking-abandonment-email.service";
import {
  type BookingConfirmationAddonItem,
  type BookingConfirmationDetail,
  type BookingConfirmationEmailProps,
} from "@/emails/BookingConfirmationEmail";
import { isNumberDecorationProduct } from "@/lib/product-numbering";
import { getDurationAdjustedUnitPrice } from "@/lib/product-duration-pricing";
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
  additionalChargeAmount?: number;
  additionalChargeReason?: string;
  payment?: {
    type?: PaymentType;
    offlineMethod?: OfflineMethod;
    offlineReference?: string;
    amountMode?: PaymentAmountMode;
    advanceAmount?: number;
    offlineAmountMode?: PaymentAmountMode;
    /**
     * false = no payment collected with this booking: it is created APPROVED
     * and awaiting payment, with no payment record. Defaults to true.
     */
    collectNow?: boolean;
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
  additionalChargeAmount: number;
  additionalChargeReason: string | null;
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
    date: formatCalendarDate(input.slotDate, "EEE, dd MMM yyyy"),
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
    additionalChargeAmount: input.additionalChargeAmount,
    additionalChargeReason: input.additionalChargeReason,
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

function normalizeAdditionalChargeAmount(value: unknown) {
  if (value == null || String(value).trim() === "") return 0;
  const parsed = Number(value);
  if (hasMoreThanTwoDecimals(value)) {
    throw new AdminBookingError(
      400,
      "INVALID_REQUEST",
      "Additional charge amount can have up to 2 decimal places."
    );
  }
  const amount = toNonNegativeMoney(value);
  if (!Number.isFinite(parsed) || !Number.isFinite(amount) || parsed < 0) {
    throw new AdminBookingError(
      400,
      "INVALID_REQUEST",
      "Additional charge amount must be zero or a positive number."
    );
  }
  return amount;
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
    image?: string | null;
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
      image: item.image ?? null,
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

type AdminCreateBookingResult = {
  bookingId: string;
  bookingRef: string;
  paymentType: PaymentType;
  awaitingPayment: boolean;
  lockOwner: string | null;
  abandonedBookingIds: string[];
  successToken: string | null;
};

async function runAdminCreateBookingNotifications(
  result: AdminCreateBookingResult
) {
  const profiler = createPerformanceProfiler(
    "ADMIN_CREATE_BOOKING_BACKGROUND_TIMINGS"
  );

  try {
    if (result.abandonedBookingIds.length > 0) {
      await profiler.measure(
        "Abandonment notification",
        "Non-critical",
        async () => {
          try {
            await notifyAbandonedBookingsByIds(result.abandonedBookingIds);
          } catch (notifyError) {
            appLogger.warn("ADMIN_CREATE_BOOKING_ABANDONMENT_NOTIFY_FAILED", {
              bookingId: result.bookingId,
              bookingRef: result.bookingRef,
              message:
                notifyError instanceof Error
                  ? notifyError.message
                  : "Unknown notification error",
            });
          }
        }
      );
    }

    if (result.awaitingPayment) {
      await profiler.measure("Review/payment email", "Non-critical", async () => {
        try {
          await sendBookingApprovedEmail(result.bookingId);
        } catch (error) {
          appLogger.warn("ADMIN_PAY_LATER_APPROVED_EMAIL_FAILED", {
            bookingId: result.bookingId,
            bookingRef: result.bookingRef,
            message:
              error instanceof Error
                ? error.message
                : "Unknown email notification error",
          });
        }
      });
      return;
    }

    if (result.paymentType !== "OFFLINE") {
      return;
    }

    const bookingForNotification = await profiler.measure(
      "Notification booking reload",
      "Non-critical",
      () =>
        prisma.booking.findUnique({
          where: { id: result.bookingId },
          include: {
            venue: true,
            items: {
              orderBy: { createdAt: "asc" },
              include: {
                product: {
                  select: { image: true },
                },
              },
            },
            payment: {
              orderBy: { createdAt: "desc" },
              take: 1,
            },
          },
        })
    );

    if (!bookingForNotification) return;

    const successToken = createSuccessToken(
      bookingForNotification.id,
      bookingForNotification.bookingRef
    );
    const addonItems = profiler.measureSync(
      "Email/PDF data preparation",
      "Non-critical",
      () =>
        buildAddonItemsWithNumberValues(
          bookingForNotification.items.map((item) => ({
            productName: item.productName,
            variantLabel: item.variantLabel,
            quantity: item.quantity,
            totalPrice: toMoney(item.totalPrice),
            image: item.product?.image ?? null,
          })),
          bookingForNotification.occasionData as Prisma.JsonValue | null
        )
    );
    const latestPayment = bookingForNotification.payment[0];
    const slotDate = bookingForNotification.eventDate;
    const slotStartTime = bookingForNotification.eventStartTime;
    const slotEndTime = bookingForNotification.eventEndTime;

    const packageSnapshotForEmail =
      bookingForNotification.packageSnapshot as { name?: string } | null;
    const emailData =
      slotDate && slotStartTime && slotEndTime
        ? profiler.measureSync("Email data build", "Non-critical", () =>
            buildEmailData({
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
              baseAmount: toMoney(bookingForNotification.baseAmount),
              extrasAmount: toMoney(bookingForNotification.extrasAmount),
              productsAmount: toMoney(bookingForNotification.productsAmount),
              additionalChargeAmount: toMoney(
                bookingForNotification.additionalChargeAmount
              ),
              additionalChargeReason:
                bookingForNotification.additionalChargeReason,
              decorationAmount: toMoney(bookingForNotification.decorationAmount),
              discountAmount: toMoney(bookingForNotification.discountAmount),
              totalAmount: toMoney(bookingForNotification.totalAmount),
              advancePaid: toMoney(bookingForNotification.advancePaid),
              remainingPayable: toMoney(
                bookingForNotification.remainingPayable
              ),
            })
          )
        : null;

    const notificationTasks: Promise<void>[] = [];

    if (bookingForNotification.contactEmail && emailData) {
      notificationTasks.push(
        profiler.measure("Customer email/PDF send", "Non-critical", async () => {
          try {
            const emailSent = await sendBookingConfirmationEmail({
              to: bookingForNotification.contactEmail!,
              bookingRef: bookingForNotification.bookingRef,
              emailData,
              theme: process.env.BOOKING_EMAIL_THEME,
            });

            if (emailSent) {
              await prisma.booking.update({
                where: { id: bookingForNotification.id },
                data: { confirmationEmailSent: true },
              });
            }
          } catch (emailError) {
            appLogger.warn("ADMIN_OFFLINE_CONFIRMATION_EMAIL_FAILED", {
              bookingId: bookingForNotification.id,
              bookingRef: bookingForNotification.bookingRef,
              message:
                emailError instanceof Error
                  ? emailError.message
                  : "Unknown customer email error",
            });
          }
        })
      );
    }

    if (emailData) {
      notificationTasks.push(
        profiler.measure("Admin email send", "Non-critical", async () => {
          try {
            await sendAdminBookingConfirmationEmail({
              bookingRef: bookingForNotification.bookingRef,
              emailData,
              confirmationSource: "ADMIN_OFFLINE_CREATE",
            });
          } catch (adminEmailError) {
            appLogger.warn("ADMIN_OFFLINE_ADMIN_CONFIRMATION_EMAIL_FAILED", {
              bookingId: bookingForNotification.id,
              bookingRef: bookingForNotification.bookingRef,
              message:
                adminEmailError instanceof Error
                  ? adminEmailError.message
                  : "Unknown admin email error",
            });
          }
        })
      );
    }

    if (bookingForNotification.contactPhone && emailData) {
      notificationTasks.push(
        profiler.measure("WhatsApp send", "Non-critical", async () => {
          try {
            await sendBookingConfirmationWhatsApp({
              phone: bookingForNotification.contactPhone!.startsWith("91")
                ? bookingForNotification.contactPhone!
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
            appLogger.warn("ADMIN_OFFLINE_CONFIRMATION_WHATSAPP_FAILED", {
              bookingId: bookingForNotification.id,
              bookingRef: bookingForNotification.bookingRef,
              message:
                whatsappError instanceof Error
                  ? whatsappError.message
                  : "Unknown WhatsApp notification error",
            });
          }
        })
      );
    }

    await Promise.allSettled(notificationTasks);
  } finally {
    profiler.report({
      bookingId: result.bookingId,
      bookingRef: result.bookingRef,
    });
  }
}

export async function POST(req: Request) {
  const profiler = createPerformanceProfiler("ADMIN_CREATE_BOOKING_TIMINGS");
  try {
    const authenticatedAdminId = await profiler.measure(
      "Authenticate admin",
      "Critical",
      () => getAuthenticatedAdminIdFromCookies()
    );
    if (!authenticatedAdminId) {
      profiler.report({ outcome: "unauthorized" });
      return bookingErrorResponse(401, "UNAUTHORIZED", "Unauthorized");
    }

    const body = await profiler.measure("Parse request", "Critical", async () =>
      (await req.json().catch(() => null)) as
        | LookupUserPayload
        | CreateBookingPayload
        | null
    );

    if (!body) {
      profiler.report({ outcome: "invalid_request" });
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

      const existingUser = await profiler.measure(
        "Lookup user",
        "Critical",
        () =>
          prisma.user.findUnique({
            where: { phone: normalizedPhone },
            select: {
              id: true,
              name: true,
              phone: true,
              email: true,
            },
          })
      );

      profiler.report({ outcome: "lookup_user" });
      return NextResponse.json({
        success: true,
        data: {
          exists: Boolean(existingUser),
          user: existingUser ?? null,
        },
      });
    }

    profiler.measureSync("Validate request", "Critical", () => {
      assertBookingMutationPayload(body, { requireSlot: false });

      ensureValidDateKey(body.date);
    });
    const createBody = body as CreateBookingPayload;

    const normalizedPayload = profiler.measureSync(
      "Normalize request fields",
      "Critical",
      () => {
        const customerName = String(createBody.customer?.name ?? "").trim();
        const phone = normalizeIndianPhone(String(createBody.customer?.phone ?? ""));
        const emailRaw = String(createBody.customer?.email ?? "").trim();
        const email = emailRaw.length > 0 ? emailRaw : null;
        const guestCount = Number(createBody.guestCount ?? 0);
        const decorationRequired = Boolean(createBody.decorationRequired);
        const specialInstructions =
          String(createBody.specialInstructions ?? "").trim() || null;
        const additionalChargeAmount = normalizeAdditionalChargeAmount(
          createBody.additionalChargeAmount
        );
        const additionalChargeReason =
          additionalChargeAmount > 0
            ? String(createBody.additionalChargeReason ?? "").trim() || null
            : null;
        return {
          customerName,
          phone,
          email,
          guestCount,
          decorationRequired,
          specialInstructions,
          additionalChargeAmount,
          additionalChargeReason,
        };
      }
    );
    const {
      customerName,
      phone,
      email,
      guestCount,
      decorationRequired,
      specialInstructions,
      additionalChargeAmount,
      additionalChargeReason,
    } = normalizedPayload;
    // Online collection has been removed from admin bookings; always settle offline.
    const paymentType = "OFFLINE" as PaymentType;
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

    const offlineMethod = createBody.payment?.offlineMethod;
    const paymentAmountMode =
      createBody.payment?.amountMode ??
      createBody.payment?.offlineAmountMode ??
      "ADVANCE";
    const offlineReference = createBody.payment?.offlineReference?.trim() ?? "";
      if (hasMoreThanTwoDecimals(createBody.payment?.advanceAmount ?? 0)) {
        throw new AdminBookingError(
          400,
          "INVALID_REQUEST",
          "Advance amount can have up to 2 decimal places."
        );
      }
      const customAdvanceAmount = toNonNegativeMoney(
        createBody.payment?.advanceAmount ?? 0
      );
      if (!Number.isFinite(Number(createBody.payment?.advanceAmount ?? 0))) {
        throw new AdminBookingError(
          400,
          "INVALID_REQUEST",
          "Advance amount must be zero or a positive number."
        );
      }
    // Pay-later bookings (phone/email, Zelle paid later) are created approved
    // and awaiting payment; the collection fields are not required for them.
    const collectPaymentNow = createBody.payment?.collectNow !== false;

    if (paymentType === "OFFLINE" && collectPaymentNow) {
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

    if (collectPaymentNow && paymentAmountMode === "ADVANCE") {
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

    const result = await profiler.measure(
      "Database transaction",
      "Critical",
      () =>
        prisma.$transaction(async (tx) => {
      const abandonedBookingIds = new Set<string>();
      const rangeStartTime = createBody.startTime?.trim() || "";
      const rangeEndTime = createBody.endTime?.trim() || "";
      const selectedPackage = await profiler.measure(
        "Load package/settings",
        "Critical",
        async () =>
          createBody.packageId
            ? await tx.eventPackage.findFirst({
                where: {
                  id: createBody.packageId,
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
            : null
      );

      if (createBody.packageId && !selectedPackage) {
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

      const rangeContext = await profiler.measure(
        "Availability checks",
        "Critical",
        () =>
          validateAdminRangeBooking(tx, {
            venueId: selectedPackage.venueId,
            date: createBody.date ?? "",
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
              maximumGuests: maxGuestsForIncluded(selectedPackage.guestLimit),
            },
            timezone: BOOKING_TIME_ZONE,
          })
      );

      const normalizedItemsMap = new Map<
        string,
        {
          productId: string;
          variantId: string;
          quantity: number;
          ledNumber?: string;
        }
      >();

      profiler.measureSync("Normalize booking items", "Critical", () => {
        (createBody.items ?? []).forEach((item) => {
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
        const includedProducts = await profiler.measure(
          "Load included products",
          "Critical",
          () =>
            tx.product.findMany({
              where: {
                slug: { in: packageIncludedProductSlugs },
                isActive: true,
                OR: [
                  { locationId: createBody.locationId },
                  { locationId: null },
                ],
              },
              include: {
                variants: {
                  where: { isActive: true },
                  orderBy: { sortOrder: "asc" },
                },
              },
            })
        );

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

      const variants = await profiler.measure(
        "Load products",
        "Critical",
        async () =>
          variantIds.length > 0
            ? await tx.productVariant.findMany({
                where: {
                  id: { in: variantIds },
                  isActive: true,
                  product: {
                    isActive: true,
                    OR: [
                    { locationId: createBody.locationId },
                      { locationId: null },
                    ],
                  },
                },
                include: {
                  product: true,
                },
              })
            : []
      );

      const variantMap = new Map(variants.map((variant) => [variant.id, variant]));

      if (variantIds.length > 0 && variants.length !== variantIds.length) {
        throw new AdminBookingError(
          400,
          "INVALID_PRODUCT_SELECTION",
          "One or more selected product variants are invalid for this location."
        );
      }

      const bookingDurationHours = rangeStartTime && rangeEndTime
        ? Math.max((timeToMinutes(rangeEndTime) - timeToMinutes(rangeStartTime)) / 60, 0)
        : 0;

      const bookingItemsToCreate: Prisma.BookingItemCreateManyInput[] = [];
      let productsAmount = 0;
      const ledNumbers: string[] = [];

      profiler.measureSync("Product pricing calculation", "Critical", () => {
        normalizedItems.forEach((item) => {
        const variant = variantMap.get(item.variantId);
        if (!variant || variant.productId !== item.productId) {
          throw new AdminBookingError(
            400,
            "INVALID_PRODUCT_SELECTION",
            "Selected product and variant mapping is invalid."
          );
        }

        // stock === null means unlimited / untracked → no availability ceiling.
        if (variant.stock !== null && item.quantity > variant.stock) {
          throw new AdminBookingError(
            409,
            "PRODUCT_OUT_OF_STOCK",
            `${variant.product.name} is out of stock.`
          );
        }

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
      });

      if (paymentType === "OFFLINE" && bookingItemsToCreate.length > 0) {
        await profiler.measure("Stock reservation", "Critical", async () => {
          for (const item of bookingItemsToCreate) {
          // stock === null means unlimited / untracked → never decrement.
          if (variantMap.get(item.variantId)?.stock === null) {
            continue;
          }

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
        });
      }

      let occasionKey: string | null = null;
      let occasionLabel: string | null = null;
      const occasionPayloadData: Record<string, string | string[]> = {};

      const incomingOccasionKey = String(createBody.occasionKey ?? "").trim();
      if (incomingOccasionKey) {
        const occasion = await profiler.measure(
          "Load occasion",
          "Critical",
          () =>
            tx.occasion.findFirst({
              where: {
                key: incomingOccasionKey,
                isActive: true,
              },
              include: {
                fields: {
                  orderBy: { sortOrder: "asc" },
                },
              },
            })
        );

        if (!occasion) {
          throw new AdminBookingError(
            400,
            "INVALID_OCCASION",
            "Selected occasion is invalid."
          );
        }

        const rawOccasionData = normalizeOccasionData(createBody.occasionData);
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
      if (createBody.customer?.userId) {
        const explicitUser = await profiler.measure(
          "Load customer",
          "Critical",
          () =>
            tx.user.findUnique({
              where: { id: createBody.customer!.userId },
            })
        );

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
        const existingUser = await profiler.measure(
          "Load customer",
          "Critical",
          () =>
            tx.user.findUnique({
              where: { phone },
              select: { id: true },
            })
        );
        linkedUserId = existingUser?.id ?? null;
      }

      const minAdvanceAmount = await profiler.measure(
        "Load payment settings",
        "Critical",
        () => getRequiredAdminAdvanceAmount(tx)
      );

      const includedDurationHours = selectedPackage?.eventDurationHours ?? 0;
      const extraHourlyRate = selectedPackage?.hourlyRate ?? 0;

      const effectiveDecorationRequired = decorationRequired;

      const pricingBase = profiler.measureSync(
        "Pricing calculation",
        "Critical",
        () =>
          calculateBookingPricing({
            slotBasePrice: selectedPackage?.subtotalAmount ?? 0,
            slotFinalPrice: selectedPackage?.subtotalAmount ?? null,
            guestCount,
            theatreBaseGuests: selectedPackage?.guestLimit ?? 2,
            theatreExtraPersonPrice: PACKAGE_EXTRA_PERSON_PRICE,
            productsAmount,
            additionalChargeAmount,
            discountAmount: 0,
            advancePaid: 0,
            durationHours: bookingDurationHours,
            includedDurationHours,
            extraHourlyRate,
          })
      );

      const couponResult = await profiler.measure("Coupon validation", "Critical", () =>
        evaluateAdminCoupons(tx, {
        couponCodes:
          createBody.couponCodes && createBody.couponCodes.length > 0
            ? createBody.couponCodes
            : createBody.couponCode
            ? [createBody.couponCode]
            : [],
        bookingSchedule: {
          eventDate: rangeContext.range.eventDate,
          eventStartTime: rangeStartTime,
          eventEndTime: rangeEndTime,
          startsAtUtc: rangeContext.range.startsAtUtc,
          endsAtUtc: rangeContext.range.endsAtUtc,
        },
        venueId: selectedPackage.venueId,
        locationId: createBody.locationId ?? "",
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
        })
      );
      const couponDiscount = couponResult.totalDiscount;
      const totalAfterDiscount = Math.max(
        pricingBase.totalAmount - couponDiscount,
        0
      );

      const desiredAdvance = !collectPaymentNow
        ? 0
        : paymentAmountMode === "FULL"
        ? totalAfterDiscount
        : customAdvanceAmount || minAdvanceAmount;

      if (collectPaymentNow && paymentAmountMode === "ADVANCE") {
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

      const pricing = profiler.measureSync(
        "Final pricing calculation",
        "Critical",
        () =>
          calculateBookingPricing({
            slotBasePrice: selectedPackage?.subtotalAmount ?? 0,
            slotFinalPrice: selectedPackage?.subtotalAmount ?? null,
            guestCount,
            theatreBaseGuests: selectedPackage?.guestLimit ?? 2,
            theatreExtraPersonPrice: PACKAGE_EXTRA_PERSON_PRICE,
            productsAmount,
            additionalChargeAmount,
            discountAmount: couponDiscount,
            advancePaid: desiredAdvance,
            durationHours: bookingDurationHours,
            includedDurationHours,
            extraHourlyRate,
          })
      );

      const booking = await profiler.measure("Booking creation", "Critical", () =>
        createBookingWithUniqueRef(tx, now, {
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
              maxGuests: maxGuestsForIncluded(selectedPackage.guestLimit),
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
              additionalChargeAmount: pricing.additionalChargeAmount,
              additionalChargeReason,
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
        additionalChargeAmount: pricing.additionalChargeAmount,
        additionalChargeReason,
        discountAmount: pricing.discountAmount,
        totalAmount: pricing.totalAmount,
        decorationAmount: pricing.decorationAmount,
        advancePaid: pricing.advancePaid,
        remainingPayable: pricing.remainingPayable,
        // Booking status answers "where in the lifecycle"; payment status
        // answers "how much was paid". An admin create is an approval either
        // way — pay-now vs pay-later differs only on the payment axis.
        paymentStatus:
          paymentType === "OFFLINE" && collectPaymentNow ? "PAID" : "INITIALIZED",
        bookingStatus: paymentType === "OFFLINE" ? "APPROVED" : "AWAITING_PAYMENT",
        termsAcceptedAt: now,
        createdByRole: "ADMIN",
        createdByAdminId,
        })
      );

      if (bookingItemsToCreate.length > 0) {
        await profiler.measure("Booking items", "Critical", () =>
          tx.bookingItem.createMany({
            data: bookingItemsToCreate.map((item) => ({
              ...item,
              bookingId: booking.id,
            })),
          })
        );
      }

      if (paymentType === "OFFLINE" && collectPaymentNow) {
        await profiler.measure("Payment creation", "Critical", () =>
          tx.payment.create({
            data: {
              bookingId: booking.id,
              provider: "OFFLINE",
              method: offlineMethod,
              transactionId: offlineReference || null,
              amount: pricing.advancePaid,
              status: "PAID",
              recordedByAdminId: createdByAdminId,
            },
          })
        );
      }

      if (couponResult.coupons.length > 0) {
        await profiler.measure("Coupon reservation", "Critical", () =>
          persistAdminBookingCoupons({
            tx,
            bookingId: booking.id,
            userId: linkedUserId ?? null,
            coupons: couponResult.coupons,
            status: paymentType === "OFFLINE" ? "CONFIRMED" : "RESERVED",
            now,
            mode: "create",
          })
        );
      }

      return {
        bookingId: booking.id,
        bookingRef: booking.bookingRef,
        paymentType,
        awaitingPayment: paymentType === "OFFLINE" && !collectPaymentNow,
        lockOwner,
        abandonedBookingIds: Array.from(abandonedBookingIds),
        successToken:
          paymentType === "OFFLINE"
            ? createSuccessToken(booking.id, booking.bookingRef)
            : null,
      };
      })
    );

    const offlineSuccessRedirect =
      result.paymentType === "OFFLINE" && result.successToken
        ? `/booking/success?t=${encodeURIComponent(result.successToken)}`
        : null;

    const response = profiler.measureSync(
      "Response serialization",
      "Critical",
      () =>
        NextResponse.json({
          success: true,
          data: {
            bookingId: result.bookingId,
            bookingRef: result.bookingRef,
            paymentType: result.paymentType,
            awaitingPayment: result.awaitingPayment,
            successToken: result.successToken,
            redirectUrl:
              result.paymentType === "ONLINE"
                ? "/booking/payment"
                : offlineSuccessRedirect ??
                  `/admin/bookings?ref=${encodeURIComponent(result.bookingRef)}`,
          },
        })
    );

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

    after(async () => {
      await runAdminCreateBookingNotifications(result);
    });

    profiler.report({
      outcome: "success",
      bookingId: result.bookingId,
      bookingRef: result.bookingRef,
    });

    return response;
  } catch (error) {
    if (error instanceof AdminRangeBookingError) {
      profiler.report({ outcome: "range_error", code: error.code });
      return bookingErrorResponse(409, error.code, error.message);
    }

    if (error instanceof BookingOverlapError) {
      profiler.report({ outcome: "booking_overlap" });
      return bookingErrorResponse(
        409,
        "RANGE_ALREADY_RESERVED",
        "Selected time range is already reserved."
      );
    }

    if (error instanceof AdminBookingError) {
      profiler.report({ outcome: "admin_error", code: error.code });
      return bookingErrorResponse(
        error.status,
        error.code,
        error.message,
        error.extra
      );
    }

    appLogger.error("ADMIN_CREATE_BOOKING_ERROR", {
      message:
        error instanceof Error ? error.message : "Unknown admin booking error",
    });
    profiler.report({ outcome: "unhandled_error" });
    return bookingErrorResponse(
      500,
      "INTERNAL_ERROR",
      "Failed to create admin booking."
    );
  }
}
