import { randomUUID } from "crypto";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { type BookingStatus, type PaymentStatus, type Prisma } from "@prisma/client";
import { formatInTimeZone } from "date-fns-tz";
import {
  basePrisma,
  requireTx,
  withRollbackTransaction,
} from "@/__tests__/helpers/prisma-integration-db";
type TxClient = Prisma.TransactionClient;

const { adminAuthMock } = vi.hoisted(() => ({
  adminAuthMock: vi.fn(async () => "admin_test"),
}));

vi.mock("@/lib/db", async () => {
  const { prismaProxy } = await import("@/__tests__/helpers/prisma-integration-db");
  return {
    prisma: prismaProxy,
  };
});

vi.mock("@/services/auth/adminAuth.server", () => ({
  getAuthenticatedAdminIdFromCookies: adminAuthMock,
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: vi.fn(() => undefined),
    set: vi.fn(),
  })),
}));

vi.mock("@/services/email.service", () => ({
  sendEmail: vi.fn(async () => undefined),
}));

vi.mock("@/services/whatsapp.service", () => ({
  sendBookingConfirmationWhatsApp: vi.fn(async () => undefined),
}));

vi.mock("@/emails/BookingConfirmationEmail", () => ({
  default: vi.fn(() => null),
}));

vi.mock("@/services/booking/bookingSession.server", () => ({
  createBookingSessionToken: vi.fn(() => "test-booking-session-token"),
  verifyBookingSessionToken: vi.fn(() => null),
}));

import { POST as applyCouponPOST } from "@/app/api/bookings/apply-coupon/route";
import { POST as removeCouponPOST } from "@/app/api/bookings/remove-coupon/route";
import { POST as updateContactPOST } from "@/app/api/bookings/update/contact/route";
import { POST as verifyPaymentPOST } from "@/app/api/payments/razorpay/verify/route";
import { POST as adminCouponPreviewPOST } from "@/app/api/admin/bookings/coupon-preview/route";
import { POST as adminCreateBookingPOST } from "@/app/api/admin/bookings/create/route";
import { releaseStaleReservedCoupons } from "@/services/coupon/coupon-release.service";

let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

function unique(prefix: string) {
  return `${prefix}_${randomUUID().replace(/-/g, "").slice(0, 10)}`;
}

function uniquePhone() {
  const digits = randomUUID().replace(/\D/g, "").slice(0, 10);
  return digits.padEnd(10, "7");
}

function toDateKeyInIST(date: Date) {
  return formatInTimeZone(date, "Asia/Kolkata", "yyyy-MM-dd");
}

let slotTimeSeed = 0;

function nextSlotTimes() {
  const hour = 8 + (slotTimeSeed % 12);
  slotTimeSeed += 1;
  const startHour = hour % 24;
  const endHour = (hour + 1) % 24;
  return {
    startTime: `${String(startHour).padStart(2, "0")}:00`,
    endTime: `${String(endHour).padStart(2, "0")}:00`,
  };
}

async function createLocation(tx: TxClient) {
  return tx.location.create({
    data: {
      name: unique("LOC"),
      city: "Delhi",
      isActive: true,
      sortOrder: 0,
    },
  });
}

async function createTheatre(tx: TxClient, locationId: string, advanceAmount = 750) {
  await tx.appSetting.upsert({
    where: { key: "ADVANCE_PAYMENT_AMOUNT" },
    update: { value: String(advanceAmount) },
    create: { key: "ADVANCE_PAYMENT_AMOUNT", value: String(advanceAmount) },
  });

  return tx.theatre.create({
    data: {
      name: unique("THEATRE"),
      images: [],
      locationId,
      capacity: 8,
      baseGuests: 2,
      extraPersonPrice: 300,
      decorationPrice: 750,
      isActive: true,
      sortOrder: 0,
    },
  });
}

async function createSlot(
  tx: TxClient,
  input: {
    theatreId: string;
    date: Date;
    status: "AVAILABLE" | "LOCKED";
    basePrice?: number;
    finalPrice?: number;
    lockOwner?: string;
  }
) {
  const times = nextSlotTimes();

  const template = await tx.slotTemplate.create({
    data: {
      theatreId: input.theatreId,
      startTime: times.startTime,
      endTime: times.endTime,
      durationMin: 60,
      bufferMin: 15,
      regularPrice: input.basePrice ?? 2000,
      salePrice: input.finalPrice ?? input.basePrice ?? 2000,
      decorationMandatory: false,
      isActive: true,
    },
  });

  const now = new Date();

  return tx.slot.create({
    data: {
      theatreId: input.theatreId,
      slotTemplateId: template.id,
      date: input.date,
      startTime: times.startTime,
      endTime: times.endTime,
      durationMin: 60,
      basePrice: input.basePrice ?? 2000,
      baseGuests: 2,
      regularPrice: input.basePrice ?? 2000,
      salePrice: input.finalPrice ?? input.basePrice ?? 2000,
      finalPrice: input.finalPrice ?? input.basePrice ?? 2000,
      status: input.status,
      lockedAt: input.status === "LOCKED" ? now : null,
      lockExpiresAt:
        input.status === "LOCKED"
          ? new Date(now.getTime() + 15 * 60 * 1000)
          : null,
      lockedBy: input.status === "LOCKED" ? input.lockOwner ?? unique("owner") : null,
    },
  });
}

async function createUser(tx: TxClient) {
  return tx.user.create({
    data: {
      name: unique("User"),
      phone: uniquePhone(),
      email: `${unique("user")}@example.com`,
      isGuest: false,
    },
  });
}

async function createBooking(
  tx: TxClient,
  input: {
    theatreId: string;
    slotId: string;
    userId?: string | null;
    bookingStatus: BookingStatus;
    paymentStatus?: PaymentStatus | null;
    baseAmount?: number;
    extrasAmount?: number;
    productsAmount?: number;
    decorationAmount?: number;
    discountAmount?: number;
    totalAmount?: number;
    advancePaid?: number;
    remainingPayable?: number;
    razorpayOrderId?: string | null;
  }
) {
  const baseAmount = input.baseAmount ?? 2000;
  const extrasAmount = input.extrasAmount ?? 0;
  const productsAmount = input.productsAmount ?? 0;
  const decorationAmount = input.decorationAmount ?? 0;
  const gross = baseAmount + extrasAmount + productsAmount + decorationAmount;
  const discountAmount = input.discountAmount ?? 0;
  const totalAmount = input.totalAmount ?? Math.max(gross - discountAmount, 0);
  const advancePaid = input.advancePaid ?? 750;
  const remainingPayable =
    input.remainingPayable ?? Math.max(totalAmount - advancePaid, 0);

  return tx.booking.create({
    data: {
      bookingRef: unique("DS_TEST").toUpperCase(),
      userId: input.userId ?? null,
      contactName: unique("Guest"),
      contactPhone: uniquePhone(),
      contactEmail: `${unique("guest")}@example.com`,
      theatreId: input.theatreId,
      slotId: input.slotId,
      guestCount: 2,
      decorationRequired: false,
      baseAmount,
      extrasAmount,
      productsAmount,
      decorationAmount,
      discountAmount,
      totalAmount,
      advancePaid,
      remainingPayable,
      paymentStatus: input.paymentStatus ?? null,
      bookingStatus: input.bookingStatus,
      termsAcceptedAt: new Date(),
      razorpayOrderId: input.razorpayOrderId ?? null,
      createdByRole: "CUSTOMER",
    },
  });
}

async function createCoupon(
  tx: TxClient,
  input: {
    code: string;
    discountValue: number;
    isStackable?: boolean;
    stackableCouponIds?: string[];
    usageLimit?: number | null;
    perUserUsageLimit?: number | null;
    locationId?: string | null;
    isActive?: boolean;
    rules?: Array<{
      type:
        | "SLOT_DATE_RANGE"
        | "SLOT_TIME_RANGE"
        | "SLOT_ID"
        | "THEATRE_ID"
        | "CATEGORY"
        | "PRODUCT_ID"
        | "USER_ID"
        | "DECORATION_REQUIRED";
      operator: "IN" | "NOT_IN" | "BETWEEN" | "EQUALS";
      value: Prisma.InputJsonValue;
    }>;
  }
) {
  const coupon = await tx.coupon.create({
    data: {
      code: input.code,
      discountType: "FLAT",
      discountValue: input.discountValue,
      maxDiscount: null,
      isStackable: input.isStackable ?? true,
      stackableCouponIds: input.stackableCouponIds ?? [],
      validFrom: new Date(Date.now() - 24 * 60 * 60 * 1000),
      validTill: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000),
      scope: "BOOKING_TOTAL",
      usageLimit: input.usageLimit ?? null,
      perUserUsageLimit: input.perUserUsageLimit ?? null,
      isActive: input.isActive ?? true,
      isDeleted: false,
      locationId: input.locationId ?? null,
      createdBy: "coupon-test",
    },
  });

  if (input.rules && input.rules.length > 0) {
    await tx.couponRule.createMany({
      data: input.rules.map((rule) => ({
        couponId: coupon.id,
        type: rule.type,
        operator: rule.operator,
        value: rule.value,
      })),
    });
  }

  return coupon;
}

async function assertBookingDiscountInvariant(bookingId: string) {
  const tx = requireTx();
  const booking = await tx.booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      discountAmount: true,
    },
  });

  const aggregate = await tx.couponUsage.aggregate({
    where: {
      bookingId,
      status: {
        in: ["RESERVED", "CONFIRMED"],
      },
    },
    _sum: {
      discountAmount: true,
    },
  });

  const usageSum = Number(aggregate._sum.discountAmount ?? 0);
  expect(booking?.discountAmount ?? 0).toBe(usageSum);
}

describe.sequential("Coupon engine core invariants (integration)", () => {
  beforeAll(async () => {
    await basePrisma.$connect();
    process.env.RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET ?? "test_secret_key";
    process.env.SUCCESS_PAGE_SECRET = process.env.SUCCESS_PAGE_SECRET ?? "test_success_secret";
    process.env.NEXT_PUBLIC_APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  });

  afterAll(async () => {
    await basePrisma.$disconnect();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it("rejects stacked coupons that would break the minimum payable floor", async () => {
    await withRollbackTransaction(async () => {
      const tx = requireTx();
      const location = await createLocation(tx);
      const theatre = await createTheatre(tx, location.id, 750);
      const slot = await createSlot(tx, {
        theatreId: theatre.id,
        date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        status: "LOCKED",
      });
      const booking = await createBooking(tx, {
        theatreId: theatre.id,
        slotId: slot.id,
        bookingStatus: "INCOMPLETE",
        paymentStatus: "INITIALIZED",
        baseAmount: 2000,
        totalAmount: 2000,
        advancePaid: 750,
        remainingPayable: 1250,
      });

      const couponA = await createCoupon(tx, {
        code: unique("CAPA").toUpperCase(),
        discountValue: 800,
        isStackable: true,
        locationId: location.id,
      });
      const couponB = await createCoupon(tx, {
        code: unique("CAPB").toUpperCase(),
        discountValue: 800,
        isStackable: true,
        locationId: location.id,
      });
      const couponC = await createCoupon(tx, {
        code: unique("CAPC").toUpperCase(),
        discountValue: 300,
        isStackable: true,
        locationId: location.id,
      });

      const first = await applyCouponPOST(
        new Request("http://localhost/api/bookings/apply-coupon", {
          method: "POST",
          body: JSON.stringify({ bookingId: booking.id, couponCode: couponA.code }),
        })
      );
      expect(first.status).toBe(200);

      const second = await applyCouponPOST(
        new Request("http://localhost/api/bookings/apply-coupon", {
          method: "POST",
          body: JSON.stringify({ bookingId: booking.id, couponCode: couponB.code }),
        })
      );
      const secondJson = await second.json();
      expect(second.status).toBe(409);
      expect(secondJson).toMatchObject({
        success: false,
        code: "COUPON_NOT_APPLICABLE",
      });

      const third = await applyCouponPOST(
        new Request("http://localhost/api/bookings/apply-coupon", {
          method: "POST",
          body: JSON.stringify({ bookingId: booking.id, couponCode: couponC.code }),
        })
      );
      expect(third.status).toBe(200);

      const reloadedBooking = await tx.booking.findUniqueOrThrow({
        where: { id: booking.id },
        select: { discountAmount: true, totalAmount: true },
      });

      const usages = await tx.couponUsage.findMany({
        where: {
          bookingId: booking.id,
          couponId: { in: [couponA.id, couponB.id, couponC.id] },
        },
        select: {
          couponId: true,
          status: true,
          discountAmount: true,
        },
      });

      const usageByCouponId = new Map(usages.map((usage) => [usage.couponId, usage]));

      expect(reloadedBooking.discountAmount).toBe(1100);
      expect(reloadedBooking.totalAmount).toBe(900);
      expect(usageByCouponId.get(couponA.id)).toMatchObject({
        status: "RESERVED",
        discountAmount: 800,
      });
      expect(usageByCouponId.get(couponC.id)).toMatchObject({
        status: "RESERVED",
        discountAmount: 300,
      });
      expect(usageByCouponId.get(couponB.id)).toBeUndefined();

      await assertBookingDiscountInvariant(booking.id);
    });
  });

  it("enforces USER_ID rule from booking identity and ignores request-body userId", async () => {
    await withRollbackTransaction(async () => {
      const tx = requireTx();
      const location = await createLocation(tx);
      const theatre = await createTheatre(tx, location.id);
      const slot1 = await createSlot(tx, {
        theatreId: theatre.id,
        date: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000),
        status: "LOCKED",
      });
      const slot2 = await createSlot(tx, {
        theatreId: theatre.id,
        date: new Date(Date.now() + 9 * 24 * 60 * 60 * 1000),
        status: "LOCKED",
      });

      const allowedUser = await createUser(tx);
      const blockedUser = await createUser(tx);

      const coupon = await createCoupon(tx, {
        code: unique("USR").toUpperCase(),
        discountValue: 300,
        locationId: location.id,
        rules: [
          {
            type: "USER_ID",
            operator: "EQUALS",
            value: allowedUser.id,
          },
        ],
      });

      const passBooking = await createBooking(tx, {
        theatreId: theatre.id,
        slotId: slot1.id,
        userId: allowedUser.id,
        bookingStatus: "INCOMPLETE",
        paymentStatus: "INITIALIZED",
      });

      const passRes = await applyCouponPOST(
        new Request("http://localhost/api/bookings/apply-coupon", {
          method: "POST",
          body: JSON.stringify({
            bookingId: passBooking.id,
            couponCode: coupon.code,
            userId: blockedUser.id,
          }),
        })
      );
      expect(passRes.status).toBe(200);

      const failBooking = await createBooking(tx, {
        theatreId: theatre.id,
        slotId: slot2.id,
        userId: blockedUser.id,
        bookingStatus: "INCOMPLETE",
        paymentStatus: "INITIALIZED",
      });

      const failRes = await applyCouponPOST(
        new Request("http://localhost/api/bookings/apply-coupon", {
          method: "POST",
          body: JSON.stringify({
            bookingId: failBooking.id,
            couponCode: coupon.code,
            userId: allowedUser.id,
          }),
        })
      );

      const failJson = await failRes.json();
      expect(failRes.status).toBe(409);
      expect(failJson.code).toBe("COUPON_NOT_APPLICABLE");

      await assertBookingDiscountInvariant(passBooking.id);
      await assertBookingDiscountInvariant(failBooking.id);
    });
  });

  it("enforces per-user usage limit from confirmed usages", async () => {
    await withRollbackTransaction(async () => {
      const tx = requireTx();
      const location = await createLocation(tx);
      const theatre = await createTheatre(tx, location.id);
      const slotA = await createSlot(tx, {
        theatreId: theatre.id,
        date: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
        status: "LOCKED",
      });
      const slotB = await createSlot(tx, {
        theatreId: theatre.id,
        date: new Date(Date.now() + 11 * 24 * 60 * 60 * 1000),
        status: "LOCKED",
      });

      const user = await createUser(tx);
      const coupon = await createCoupon(tx, {
        code: unique("PUL").toUpperCase(),
        discountValue: 400,
        perUserUsageLimit: 1,
        locationId: location.id,
      });

      const confirmedBooking = await createBooking(tx, {
        theatreId: theatre.id,
        slotId: slotA.id,
        userId: user.id,
        bookingStatus: "CONFIRMED",
        paymentStatus: "PAID",
      });

      await tx.couponUsage.create({
        data: {
          couponId: coupon.id,
          bookingId: confirmedBooking.id,
          userId: user.id,
          status: "CONFIRMED",
          discountAmount: 400,
          confirmedAt: new Date(),
        },
      });

      const newBooking = await createBooking(tx, {
        theatreId: theatre.id,
        slotId: slotB.id,
        userId: user.id,
        bookingStatus: "INCOMPLETE",
        paymentStatus: "INITIALIZED",
      });

      const res = await applyCouponPOST(
        new Request("http://localhost/api/bookings/apply-coupon", {
          method: "POST",
          body: JSON.stringify({ bookingId: newBooking.id, couponCode: coupon.code }),
        })
      );
      const json = await res.json();

      expect(res.status).toBe(409);
      expect(json.code).toBe("COUPON_NOT_APPLICABLE");

      const usageForNewBooking = await tx.couponUsage.findMany({
        where: {
          bookingId: newBooking.id,
        },
      });
      expect(usageForNewBooking).toHaveLength(0);

      await assertBookingDiscountInvariant(newBooking.id);
    });
  });

  it("blocks RESERVED -> CONFIRMED when coupon becomes invalid before payment verification", async () => {
    await withRollbackTransaction(async () => {
      const tx = requireTx();
      const location = await createLocation(tx);
      const theatre = await createTheatre(tx, location.id);
      const slot = await createSlot(tx, {
        theatreId: theatre.id,
        date: new Date(Date.now() + 12 * 24 * 60 * 60 * 1000),
        status: "LOCKED",
        lockOwner: unique("owner"),
      });

      const user = await createUser(tx);

      const booking = await createBooking(tx, {
        theatreId: theatre.id,
        slotId: slot.id,
        userId: user.id,
        bookingStatus: "AWAITING_PAYMENT",
        paymentStatus: "AWAITING_PAYMENT",
        discountAmount: 300,
        totalAmount: 1700,
        remainingPayable: 950,
        razorpayOrderId: "order_test_revalidation",
      });

      const coupon = await createCoupon(tx, {
        code: unique("REVAL").toUpperCase(),
        discountValue: 300,
        locationId: location.id,
      });

      await tx.couponUsage.create({
        data: {
          couponId: coupon.id,
          bookingId: booking.id,
          userId: user.id,
          status: "RESERVED",
          discountAmount: 300,
          reservedAt: new Date(),
        },
      });

      await tx.coupon.update({
        where: { id: coupon.id },
        data: {
          isActive: false,
        },
      });

      const orderId = "order_test_revalidation";
      const paymentId = "pay_test_revalidation";
      const signature = await import("crypto").then(({ createHmac }) =>
        createHmac("sha256", process.env.RAZORPAY_KEY_SECRET as string)
          .update(`${orderId}|${paymentId}`)
          .digest("hex")
      );

      const res = await verifyPaymentPOST(
        new Request("http://localhost/api/payments/razorpay/verify", {
          method: "POST",
          body: JSON.stringify({
            bookingId: booking.id,
            razorpay_order_id: orderId,
            razorpay_payment_id: paymentId,
            razorpay_signature: signature,
          }),
        })
      );

      const json = await res.json();
      expect(res.status).toBe(409);
      expect(json.code).toBe("COUPON_NOT_APPLICABLE");

      const usage = await tx.couponUsage.findFirstOrThrow({
        where: {
          bookingId: booking.id,
          couponId: coupon.id,
        },
        select: {
          status: true,
          discountAmount: true,
        },
      });
      expect(usage.status).toBe("RESERVED");
      expect(usage.discountAmount).toBe(300);

      await assertBookingDiscountInvariant(booking.id);
    });
  });

  it("manual release endpoint releases RESERVED usage and keeps booking discount invariant", async () => {
    await withRollbackTransaction(async () => {
      const tx = requireTx();
      const location = await createLocation(tx);
      const theatre = await createTheatre(tx, location.id);
      const slot = await createSlot(tx, {
        theatreId: theatre.id,
        date: new Date(Date.now() + 13 * 24 * 60 * 60 * 1000),
        status: "LOCKED",
      });

      const booking = await createBooking(tx, {
        theatreId: theatre.id,
        slotId: slot.id,
        bookingStatus: "INCOMPLETE",
        paymentStatus: "INITIALIZED",
        discountAmount: 250,
        totalAmount: 1750,
      });

      const coupon = await createCoupon(tx, {
        code: unique("REM").toUpperCase(),
        discountValue: 250,
        locationId: location.id,
      });

      await tx.couponUsage.create({
        data: {
          couponId: coupon.id,
          bookingId: booking.id,
          status: "RESERVED",
          discountAmount: 250,
        },
      });

      const response = await removeCouponPOST(
        new Request("http://localhost/api/bookings/remove-coupon", {
          method: "POST",
          body: JSON.stringify({
            bookingId: booking.id,
            couponId: coupon.id,
          }),
        })
      );
      expect(response.status).toBe(200);

      const usage = await tx.couponUsage.findFirstOrThrow({
        where: {
          bookingId: booking.id,
          couponId: coupon.id,
        },
        select: {
          status: true,
          discountAmount: true,
          releasedAt: true,
        },
      });

      expect(usage.status).toBe("RELEASED");
      expect(usage.discountAmount).toBe(0);
      expect(usage.releasedAt).not.toBeNull();

      await assertBookingDiscountInvariant(booking.id);
    });
  });

  it("stale RESERVED sweep is idempotent", async () => {
    await withRollbackTransaction(async () => {
      const tx = requireTx();
      const location = await createLocation(tx);
      const theatre = await createTheatre(tx, location.id);
      const slot = await createSlot(tx, {
        theatreId: theatre.id,
        date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        status: "LOCKED",
      });

      const booking = await createBooking(tx, {
        theatreId: theatre.id,
        slotId: slot.id,
        bookingStatus: "ABANDONED",
        paymentStatus: "EXPIRED",
        discountAmount: 600,
        totalAmount: 1400,
        remainingPayable: 650,
      });

      const coupon = await createCoupon(tx, {
        code: unique("SWP").toUpperCase(),
        discountValue: 600,
        locationId: location.id,
      });

      await tx.couponUsage.create({
        data: {
          couponId: coupon.id,
          bookingId: booking.id,
          status: "RESERVED",
          discountAmount: 600,
          reservedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
        },
      });

      const first = await releaseStaleReservedCoupons();
      expect(first.releasedCount).toBeGreaterThan(0);
      expect(first.affectedBookings).toContain(booking.id);

      await assertBookingDiscountInvariant(booking.id);

      const second = await releaseStaleReservedCoupons();
      expect(second.releasedCount).toBe(0);
      expect(second.affectedBookings).toHaveLength(0);

      await assertBookingDiscountInvariant(booking.id);
    });
  });

  it("contact update revalidates reserved USER_ID coupons against the submitted phone identity", async () => {
    await withRollbackTransaction(async () => {
      const tx = requireTx();
      const location = await createLocation(tx);
      const theatre = await createTheatre(tx, location.id);
      const slot = await createSlot(tx, {
        theatreId: theatre.id,
        date: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
        status: "LOCKED",
      });
      const allowedUser = await createUser(tx);
      const replacementUser = await createUser(tx);
      const coupon = await createCoupon(tx, {
        code: unique("CID").toUpperCase(),
        discountValue: 300,
        locationId: location.id,
        rules: [
          {
            type: "USER_ID",
            operator: "EQUALS",
            value: allowedUser.id,
          },
        ],
      });

      const booking = await createBooking(tx, {
        theatreId: theatre.id,
        slotId: slot.id,
        userId: allowedUser.id,
        bookingStatus: "AWAITING_PAYMENT",
        paymentStatus: "AWAITING_PAYMENT",
        razorpayOrderId: "order_contact_identity",
      });

      const applyRes = await applyCouponPOST(
        new Request("http://localhost/api/bookings/apply-coupon", {
          method: "POST",
          body: JSON.stringify({
            bookingId: booking.id,
            couponCode: coupon.code,
          }),
        })
      );
      expect(applyRes.status).toBe(200);

      const response = await updateContactPOST(
        new Request("http://localhost/api/bookings/update/contact", {
          method: "POST",
          body: JSON.stringify({
            bookingId: booking.id,
            name: "Updated Guest",
            phone: replacementUser.phone,
            email: "updated-guest@example.com",
            guestCount: 2,
            decorationRequired: false,
          }),
        })
      );
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json).toMatchObject({
        success: true,
        data: {
          effectiveDecorationRequired: false,
          discountAmount: 0,
          appliedCoupons: [],
        },
      });

      const updatedBooking = await tx.booking.findUniqueOrThrow({
        where: { id: booking.id },
        select: {
          userId: true,
          contactPhone: true,
          discountAmount: true,
          totalAmount: true,
          remainingPayable: true,
          paymentStatus: true,
          razorpayOrderId: true,
        },
      });
      expect(updatedBooking.userId).toBe(replacementUser.id);
      expect(updatedBooking.contactPhone).toBe(replacementUser.phone);
      expect(updatedBooking.discountAmount).toBe(0);
      expect(updatedBooking.totalAmount).toBe(2000);
      expect(updatedBooking.remainingPayable).toBe(1250);
      expect(updatedBooking.paymentStatus).toBe("INITIALIZED");
      expect(updatedBooking.razorpayOrderId).toBeNull();

      const usage = await tx.couponUsage.findFirstOrThrow({
        where: {
          bookingId: booking.id,
          couponId: coupon.id,
        },
        select: {
          status: true,
          discountAmount: true,
          releasedAt: true,
        },
      });
      expect(usage.status).toBe("RELEASED");
      expect(usage.discountAmount).toBe(0);
      expect(usage.releasedAt).not.toBeNull();

      await assertBookingDiscountInvariant(booking.id);
    });
  });

  it("contact update releases coupons that become invalid after decoration changes", async () => {
    await withRollbackTransaction(async () => {
      const tx = requireTx();
      const location = await createLocation(tx);
      const theatre = await createTheatre(tx, location.id);
      const slot = await createSlot(tx, {
        theatreId: theatre.id,
        date: new Date(Date.now() + 16 * 24 * 60 * 60 * 1000),
        status: "LOCKED",
      });
      const booking = await createBooking(tx, {
        theatreId: theatre.id,
        slotId: slot.id,
        bookingStatus: "INCOMPLETE",
        paymentStatus: "INITIALIZED",
      });
      const coupon = await createCoupon(tx, {
        code: unique("CDEC").toUpperCase(),
        discountValue: 250,
        locationId: location.id,
        rules: [
          {
            type: "DECORATION_REQUIRED",
            operator: "EQUALS",
            value: "No",
          },
        ],
      });

      const applyRes = await applyCouponPOST(
        new Request("http://localhost/api/bookings/apply-coupon", {
          method: "POST",
          body: JSON.stringify({
            bookingId: booking.id,
            couponCode: coupon.code,
          }),
        })
      );
      expect(applyRes.status).toBe(200);

      const response = await updateContactPOST(
        new Request("http://localhost/api/bookings/update/contact", {
          method: "POST",
          body: JSON.stringify({
            bookingId: booking.id,
            name: "Decor Guest",
            phone: booking.contactPhone,
            email: booking.contactEmail,
            guestCount: 2,
            decorationRequired: true,
          }),
        })
      );
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json).toMatchObject({
        success: true,
        data: {
          effectiveDecorationRequired: true,
          discountAmount: 0,
          appliedCoupons: [],
        },
      });

      const updatedBooking = await tx.booking.findUniqueOrThrow({
        where: { id: booking.id },
        select: {
          decorationRequired: true,
          decorationAmount: true,
          discountAmount: true,
          totalAmount: true,
          remainingPayable: true,
        },
      });
      expect(updatedBooking.decorationRequired).toBe(true);
      expect(updatedBooking.decorationAmount).toBe(750);
      expect(updatedBooking.discountAmount).toBe(0);
      expect(updatedBooking.totalAmount).toBe(2750);
      expect(updatedBooking.remainingPayable).toBe(2000);

      const usage = await tx.couponUsage.findFirstOrThrow({
        where: {
          bookingId: booking.id,
          couponId: coupon.id,
        },
        select: {
          status: true,
          discountAmount: true,
        },
      });
      expect(usage.status).toBe("RELEASED");
      expect(usage.discountAmount).toBe(0);

      await assertBookingDiscountInvariant(booking.id);
    });
  });

  it("admin coupon preview matches final single-coupon booking discount", async () => {
    await withRollbackTransaction(async () => {
      const tx = requireTx();
      await tx.appSetting.upsert({
        where: { key: "ADVANCE_PAYMENT_AMOUNT" },
        update: { value: "750" },
        create: { key: "ADVANCE_PAYMENT_AMOUNT", value: "750" },
      });

      const location = await createLocation(tx);
      const theatre = await createTheatre(tx, location.id, 750);
      const slotDate = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000);
      const slot = await createSlot(tx, {
        theatreId: theatre.id,
        date: slotDate,
        status: "AVAILABLE",
        basePrice: 2000,
        finalPrice: 2000,
      });

      const coupon = await createCoupon(tx, {
        code: unique("PV1").toUpperCase(),
        discountValue: 500,
        isStackable: true,
        locationId: location.id,
      });

      const previewRes = await adminCouponPreviewPOST(
        new Request("http://localhost/api/admin/bookings/coupon-preview", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            slotId: slot.id,
            couponCodes: [coupon.code],
            userId: null,
            items: [],
            amounts: {
              bookingSubtotal: 2000,
              slotAmount: 2000,
              nonSlotAmount: 0,
              productsTotal: 0,
              extrasTotal: 0,
            },
          }),
        })
      );

      const previewJson = await previewRes.json();
      expect(previewRes.status).toBe(200);
      expect(previewJson.data.couponDebug).toMatchObject([
        {
          couponId: coupon.id,
          code: coupon.code,
          outcome: "APPLIED",
          finalDiscountAmount: 500,
        },
      ]);
      const previewDiscount = Number(previewJson.data.discountAmount);

      const createRes = await adminCreateBookingPOST(
        new Request("http://localhost/api/admin/bookings/create", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            mode: "CREATE",
            locationId: location.id,
            date: toDateKeyInIST(slotDate),
            theatreId: theatre.id,
            slotId: slot.id,
            customer: {
              name: "Admin Test",
              phone: uniquePhone(),
              email: "admin-test@example.com",
            },
            guestCount: 2,
            decorationRequired: false,
            couponCodes: [coupon.code],
            items: [],
            payment: {
              type: "OFFLINE",
              amountMode: "ADVANCE",
              advanceAmount: 750,
              offlineMethod: "CASH",
            },
          }),
        })
      );

      const createJson = await createRes.json();
      expect(createRes.status).toBe(200);

      const booking = await tx.booking.findUniqueOrThrow({
        where: { bookingRef: String(createJson.data.bookingRef) },
        select: {
          id: true,
          discountAmount: true,
        },
      });

      expect(booking.discountAmount).toBe(previewDiscount);
      await assertBookingDiscountInvariant(booking.id);
    });
  });

  it("admin coupon preview and create both reject multi-coupon selections below minimum payable", async () => {
    await withRollbackTransaction(async () => {
      const tx = requireTx();
      await tx.appSetting.upsert({
        where: { key: "ADVANCE_PAYMENT_AMOUNT" },
        update: { value: "750" },
        create: { key: "ADVANCE_PAYMENT_AMOUNT", value: "750" },
      });

      const location = await createLocation(tx);
      const theatre = await createTheatre(tx, location.id, 750);
      const slotDate = new Date(Date.now() + 16 * 24 * 60 * 60 * 1000);
      const slot = await createSlot(tx, {
        theatreId: theatre.id,
        date: slotDate,
        status: "AVAILABLE",
        basePrice: 2000,
        finalPrice: 2000,
      });

      const couponA = await createCoupon(tx, {
        code: unique("PVM1").toUpperCase(),
        discountValue: 800,
        isStackable: true,
        locationId: location.id,
      });
      const couponB = await createCoupon(tx, {
        code: unique("PVM2").toUpperCase(),
        discountValue: 800,
        isStackable: true,
        locationId: location.id,
      });

      const previewRes = await adminCouponPreviewPOST(
        new Request("http://localhost/api/admin/bookings/coupon-preview", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            slotId: slot.id,
            couponCodes: [couponA.code, couponB.code],
            userId: null,
            items: [],
            amounts: {
              bookingSubtotal: 2000,
              slotAmount: 2000,
              nonSlotAmount: 0,
              productsTotal: 0,
              extrasTotal: 0,
            },
          }),
        })
      );

      const previewJson = await previewRes.json();
      expect(previewRes.status).toBe(409);
      expect(previewJson).toMatchObject({
        success: false,
        code: "COUPON_NOT_APPLICABLE",
      });

      const createRes = await adminCreateBookingPOST(
        new Request("http://localhost/api/admin/bookings/create", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            mode: "CREATE",
            locationId: location.id,
            date: toDateKeyInIST(slotDate),
            theatreId: theatre.id,
            slotId: slot.id,
            customer: {
              name: "Admin Multi Coupon",
              phone: uniquePhone(),
              email: "admin-multi@example.com",
            },
            guestCount: 2,
            decorationRequired: false,
            couponCodes: [couponA.code, couponB.code],
            items: [],
            payment: {
              type: "OFFLINE",
              amountMode: "ADVANCE",
              advanceAmount: 750,
              offlineMethod: "CASH",
            },
          }),
        })
      );

      const createJson = await createRes.json();
      expect(createRes.status).toBe(409);
      expect(createJson).toMatchObject({
        success: false,
        code: "COUPON_NOT_APPLICABLE",
      });
    });
  });
});
