// Regression coverage for reducing package-included quantities end to end.
//
// Included tables/chairs are pre-paid inside the package price. Reducing below
// the included quantity credits the package price back at a SNAPSHOTTED rate;
// increasing above it charges only the excess at the live rate.
//
// The failure mode these tests exist to prevent is the same class as the
// extra-hour regression: an admin edit that touches nothing related silently
// re-deriving the allowance from live config and wiping the customer's
// reduction (or, worse, re-pricing it at a changed catalogue price).
//
// These drive the real route handlers and the real pricing modules; only I/O
// and notification boundaries are mocked.

import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock, evaluateAdminCouponsMock, persistAdminBookingCouponsMock } =
  vi.hoisted(() => ({
    prismaMock: { $transaction: vi.fn() },
    evaluateAdminCouponsMock: vi.fn(),
    persistAdminBookingCouponsMock: vi.fn(),
  }));

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  after: vi.fn(),
}));

vi.mock("@/services/auth/adminAuth.server", () => ({
  getAuthenticatedAdminIdFromCookies: vi.fn().mockResolvedValue("admin-1"),
}));

vi.mock("@/services/booking/admin-range-booking.service", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/services/booking/admin-range-booking.service")>();
  return {
    ...actual,
    validateAdminRangeBooking: vi.fn(
      async (
        _tx: unknown,
        input: Parameters<typeof actual.normalizeAdminRange>[0]
      ) => ({ range: actual.normalizeAdminRange(input) })
    ),
    acquireAdminRangeTransactionLock: vi.fn().mockResolvedValue(undefined),
  };
});

vi.mock("@/app/api/admin/bookings/_coupon", () => ({
  evaluateAdminCoupons: evaluateAdminCouponsMock,
  persistAdminBookingCoupons: persistAdminBookingCouponsMock,
}));

vi.mock("@/services/booking/bookingId.service", () => ({
  allocateBookingRef: vi.fn().mockResolvedValue("HR-TEST-0001"),
}));
vi.mock("@/services/booking/successToken.server", () => ({
  createSuccessToken: vi.fn().mockReturnValue("success-token"),
}));
vi.mock("@/services/booking/bookingSession.server", () => ({
  createBookingSessionToken: vi.fn().mockReturnValue("session-token"),
}));
vi.mock("@/lib/square/server", () => ({
  createSquarePaymentLink: vi.fn(),
  getSquareCurrency: vi.fn().mockReturnValue("USD"),
  SquareServerError: class SquareServerError extends Error {
    status = 500;
  },
}));

vi.mock("@/services/booking/booking-confirmation-email.service", () => ({
  sendBookingConfirmationEmail: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/services/booking/booking-review-email.service", () => ({
  sendBookingApprovedEmail: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/services/booking/admin-booking-confirmation-email.service", () => ({
  sendAdminBookingConfirmationEmail: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/services/booking/booking-payment-link-email.service", () => ({
  sendBookingPaymentLinkEmail: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/services/booking/booking-abandonment-email.service", () => ({
  notifyAbandonedBookingsByIds: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/services/whatsapp.service", () => ({
  buildCustomerBookingWhatsAppMessage: vi.fn().mockReturnValue(""),
  sendWhatsAppMessage: vi.fn().mockResolvedValue(undefined),
}));

import { PATCH } from "@/app/api/admin/bookings/[id]/route";
import { POST as CREATE } from "@/app/api/admin/bookings/create/route";
import { createOrReplaceVenueBookingSession } from "@/services/booking/venue-booking-session.service";

/* ─── Fixtures ─────────────────────────────────────────────────────────────── */

const PACKAGE = {
  id: "pkg-premium",
  venueId: "venue-1",
  locationId: "loc-1",
  name: "Premium Package",
  slug: "premium",
  shortDescription: "Premium event",
  isActive: true,
  guestLimit: 40,
  eventDurationHours: 4,
  complimentarySetupHours: 1,
  rentalAmount: 600,
  decorationAmount: 0,
  decorationAddonPrice: 100,
  decorationDefault: false,
  cleaningAmount: 85,
  subtotalAmount: 841,
  hourlyRate: 150,
  features: [],
  venue: { id: "venue-1", name: "Haven Retreat", slug: "haven", maxGuests: 60 },
};

const PACKAGE_AMOUNT = 841;
const TABLE_PRICE = 15;
const CHAIR_PRICE = 3;
const INCLUDED_TABLES = 4;
const INCLUDED_CHAIRS = 32;

const EVENT_DATE = "2030-07-15";
const START_TIME = "09:00";
const END_TIME = "13:00"; // exactly the package's 4 included hours

const TABLES_PRODUCT = {
  id: "tables-product",
  slug: "tables",
  name: "Tables",
  category: "GIFT",
  isActive: true,
};
const CHAIRS_PRODUCT = {
  id: "chairs-product",
  slug: "chairs",
  name: "Chairs",
  category: "GIFT",
  isActive: true,
};

function variantRow(
  product: typeof TABLES_PRODUCT,
  id: string,
  label: string,
  regularPrice: number
) {
  return {
    id,
    productId: product.id,
    label,
    regularPrice,
    salePrice: null,
    stock: null,
    maxPerBooking: null,
    isDefault: true,
    isActive: true,
    sortOrder: 0,
    product,
  };
}

const TABLE_VARIANT = variantRow(
  TABLES_PRODUCT,
  "tables-default",
  "Per Table",
  TABLE_PRICE
);
const CHAIR_VARIANT = variantRow(
  CHAIRS_PRODUCT,
  "chairs-default",
  "Per Chair",
  CHAIR_PRICE
);

// Shape returned by product.findMany({ include: { variants } }).
const INCLUDED_PRODUCTS = [
  { ...TABLES_PRODUCT, variants: [TABLE_VARIANT] },
  { ...CHAIRS_PRODUCT, variants: [CHAIR_VARIANT] },
];

const ALL_VARIANTS = [TABLE_VARIANT, CHAIR_VARIANT];

const ALLOWANCE_SNAPSHOT = [
  {
    productSlug: "tables",
    productId: TABLES_PRODUCT.id,
    variantId: TABLE_VARIANT.id,
    includedQuantity: INCLUDED_TABLES,
    includedUnitPrice: TABLE_PRICE,
  },
  {
    productSlug: "chairs",
    productId: CHAIRS_PRODUCT.id,
    variantId: CHAIR_VARIANT.id,
    includedQuantity: INCLUDED_CHAIRS,
    includedUnitPrice: CHAIR_PRICE,
  },
];

function bookingItemRow(
  variant: typeof TABLE_VARIANT,
  quantity: number,
  includedQuantity: number,
  includedUnitPrice: number
) {
  return {
    id: `item-${variant.id}`,
    productId: variant.productId,
    variantId: variant.id,
    productName: variant.product.name,
    variantLabel: variant.label,
    category: "GIFT",
    unitPrice: variant.regularPrice,
    quantity,
    includedQuantity,
    includedUnitPrice,
  };
}

/**
 * A saved booking where the customer already reduced chairs 32 -> 10,
 * crediting 22 x $3 = $66 off the package price.
 */
function reducedBooking(
  overrides: {
    items?: ReturnType<typeof bookingItemRow>[];
    packageIncludedSnapshot?: unknown;
    packageAdjustmentAmount?: number;
  } = {}
) {
  const packageAdjustmentAmount = overrides.packageAdjustmentAmount ?? 66;
  const total = PACKAGE_AMOUNT - packageAdjustmentAmount;
  return {
    id: "booking-1",
    bookingRef: "HR-TEST-0001",
    venueId: PACKAGE.venueId,
    packageId: PACKAGE.id,
    userId: null,
    contactPhone: "9998887777",
    bookingStatus: "APPROVED",
    paymentStatus: "INITIALIZED",
    createdByRole: "ADMIN",
    createdByAdminId: "admin-1",
    cancelledReason: null,
    eventDate: new Date(`${EVENT_DATE}T00:00:00.000Z`),
    eventStartTime: START_TIME,
    eventEndTime: END_TIME,
    timezone: "America/New_York",
    guestCount: PACKAGE.guestLimit,
    decorationRequired: false,
    baseAmount: total,
    extrasAmount: 0,
    productsAmount: 0,
    additionalChargeAmount: 0,
    additionalChargeReason: null,
    decorationAmount: 0,
    discountAmount: 0,
    packageAdjustmentAmount,
    packageIncludedSnapshot:
      "packageIncludedSnapshot" in overrides
        ? overrides.packageIncludedSnapshot
        : ALLOWANCE_SNAPSHOT,
    totalAmount: total,
    advancePaid: 150,
    remainingPayable: total - 150,
    eventPackage: {
      name: PACKAGE.name,
      eventDurationHours: PACKAGE.eventDurationHours,
      hourlyRate: PACKAGE.hourlyRate,
      guestLimit: PACKAGE.guestLimit,
      venueId: PACKAGE.venueId,
      venue: { maxGuests: PACKAGE.venue.maxGuests },
    },
    packageSnapshot: {
      id: PACKAGE.id,
      guestLimit: PACKAGE.guestLimit,
      eventDurationHours: PACKAGE.eventDurationHours,
      subtotalAmount: PACKAGE_AMOUNT,
      decorationAddonPrice: PACKAGE.decorationAddonPrice,
      extraPersonPrice: 0,
    },
    pricingSnapshot: {
      packageAmount: total,
      packageListAmount: PACKAGE_AMOUNT,
      packageAdjustmentAmount,
      packageGuestLimit: PACKAGE.guestLimit,
      includedDurationHours: PACKAGE.eventDurationHours,
      bookedDurationHours: 4,
      extraDurationHours: 0,
      extraHourlyRate: PACKAGE.hourlyRate,
      extraDurationAmount: 0,
      extraGuestPrice: 0,
      extraGuestAmount: 0,
      productsAmount: 0,
      additionalChargeAmount: 0,
      decorationAmount: 0,
      discountAmount: 0,
      totalAmount: total,
      advancePaid: 150,
      remainingPayable: total - 150,
    },
    items: overrides.items ?? [
      bookingItemRow(TABLE_VARIANT, INCLUDED_TABLES, INCLUDED_TABLES, TABLE_PRICE),
      bookingItemRow(CHAIR_VARIANT, 10, INCLUDED_CHAIRS, CHAIR_PRICE),
    ],
    occasionData: null,
    occasionKey: null,
    occasionLabel: null,
    specialInstructions: null,
    lockVersion: 1,
  };
}

function makeTx(overrides: Record<string, unknown> = {}) {
  return {
    booking: {
      findUnique: vi.fn().mockResolvedValue(reducedBooking()),
      findFirst: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
      update: vi
        .fn()
        .mockResolvedValue({ id: "booking-1", bookingRef: "HR-TEST-0001" }),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      create: vi
        .fn()
        .mockResolvedValue({ id: "booking-1", bookingRef: "HR-TEST-0001" }),
    },
    bookingItem: {
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      createMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    eventPackage: {
      findFirst: vi.fn().mockResolvedValue(PACKAGE),
      findUnique: vi.fn().mockResolvedValue(PACKAGE),
    },
    product: { findMany: vi.fn().mockResolvedValue(INCLUDED_PRODUCTS) },
    productVariant: {
      findMany: vi.fn().mockResolvedValue(ALL_VARIANTS),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    payment: {
      create: vi.fn().mockResolvedValue({}),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    user: { findUnique: vi.fn().mockResolvedValue(null) },
    occasion: { findFirst: vi.fn().mockResolvedValue(null) },
    couponUsage: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
    appSetting: {
      findUnique: vi.fn().mockResolvedValue({ value: "150" }),
      findMany: vi.fn().mockResolvedValue([]),
    },
    $queryRaw: vi.fn().mockResolvedValue([{ id: "booking-1" }]),
    ...overrides,
  };
}

function withTx(tx: ReturnType<typeof makeTx>) {
  prismaMock.$transaction.mockImplementation(
    (cb: (t: typeof tx) => Promise<unknown>) => cb(tx)
  );
  return tx;
}

function adminBookingPayload(overrides: Record<string, unknown> = {}) {
  return {
    locationId: PACKAGE.locationId,
    venueId: PACKAGE.venueId,
    packageId: PACKAGE.id,
    date: EVENT_DATE,
    startTime: START_TIME,
    endTime: END_TIME,
    customer: {
      name: "Regression Customer",
      phone: "9998887777",
      email: "regression@example.com",
    },
    guestCount: PACKAGE.guestLimit,
    decorationRequired: false,
    items: [],
    couponCodes: [],
    additionalChargeAmount: 0,
    payment: {
      type: "OFFLINE",
      amountMode: "ADVANCE",
      advanceAmount: 150,
      offlineMethod: "CASH",
    },
    ...overrides,
  };
}

function itemsPayload(tables: number, chairs: number) {
  return [
    {
      productId: TABLES_PRODUCT.id,
      variantId: TABLE_VARIANT.id,
      quantity: tables,
    },
    {
      productId: CHAIRS_PRODUCT.id,
      variantId: CHAIR_VARIANT.id,
      quantity: chairs,
    },
  ];
}

async function patchBooking(body: Record<string, unknown>) {
  return PATCH(
    new Request("http://localhost/api/admin/bookings/booking-1", {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id: "booking-1" }) }
  );
}

function persisted(call: { data: Record<string, unknown> }) {
  const data = call.data;
  return {
    baseAmount: Number(data.baseAmount),
    totalAmount: Number(data.totalAmount),
    productsAmount: Number(data.productsAmount),
    packageAdjustmentAmount: Number(data.packageAdjustmentAmount),
    packageIncludedSnapshot: data.packageIncludedSnapshot,
    snapshot: data.pricingSnapshot as Record<string, number>,
  };
}

function createdItems(tx: ReturnType<typeof makeTx>) {
  const call = tx.bookingItem.createMany.mock.calls[0]?.[0] as
    | { data: Array<Record<string, unknown>> }
    | undefined;
  return call?.data ?? [];
}

function itemFor(
  items: Array<Record<string, unknown>>,
  variantId: string
): Record<string, unknown> | undefined {
  return items.find((item) => item.variantId === variantId);
}

/* ─── Tests ────────────────────────────────────────────────────────────────── */

describe("admin create with package-included reductions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    evaluateAdminCouponsMock.mockResolvedValue({ totalDiscount: 0, coupons: [] });
    persistAdminBookingCouponsMock.mockResolvedValue(undefined);
  });

  it("charges the full package when the included quantities are untouched", async () => {
    const tx = withTx(makeTx());

    const res = await CREATE(
      new Request("http://localhost/api/admin/bookings/create", {
        method: "POST",
        body: JSON.stringify({
          mode: "CREATE",
          ...adminBookingPayload({
            items: itemsPayload(INCLUDED_TABLES, INCLUDED_CHAIRS),
          }),
        }),
      })
    );
    expect(res.status).toBe(200);

    const result = persisted(tx.booking.create.mock.calls[0][0]);
    expect(result.packageAdjustmentAmount).toBe(0);
    expect(result.productsAmount).toBe(0);
    expect(result.totalAmount).toBe(PACKAGE_AMOUNT);
  });

  it("reduces the package price when chairs are reduced (32 -> 10)", async () => {
    const tx = withTx(makeTx());

    const res = await CREATE(
      new Request("http://localhost/api/admin/bookings/create", {
        method: "POST",
        body: JSON.stringify({
          mode: "CREATE",
          ...adminBookingPayload({ items: itemsPayload(INCLUDED_TABLES, 10) }),
        }),
      })
    );
    expect(res.status).toBe(200);

    const result = persisted(tx.booking.create.mock.calls[0][0]);
    expect(result.packageAdjustmentAmount).toBe(66);
    expect(result.totalAmount).toBe(775);
    expect(result.snapshot.packageListAmount).toBe(PACKAGE_AMOUNT);
    expect(result.snapshot.packageAdjustmentAmount).toBe(66);
  });

  it("credits the whole Tables & Chairs line when both are reduced to zero", async () => {
    const tx = withTx(makeTx());

    await CREATE(
      new Request("http://localhost/api/admin/bookings/create", {
        method: "POST",
        body: JSON.stringify({
          mode: "CREATE",
          ...adminBookingPayload({ items: itemsPayload(0, 0) }),
        }),
      })
    );

    const result = persisted(tx.booking.create.mock.calls[0][0]);
    expect(result.packageAdjustmentAmount).toBe(156);
    expect(result.totalAmount).toBe(PACKAGE_AMOUNT - 156);
  });

  it("charges only the excess when quantities are increased", async () => {
    const tx = withTx(makeTx());

    await CREATE(
      new Request("http://localhost/api/admin/bookings/create", {
        method: "POST",
        body: JSON.stringify({
          mode: "CREATE",
          ...adminBookingPayload({ items: itemsPayload(INCLUDED_TABLES, 35) }),
        }),
      })
    );

    const result = persisted(tx.booking.create.mock.calls[0][0]);
    expect(result.packageAdjustmentAmount).toBe(0);
    expect(result.productsAmount).toBe(9); // 3 extra chairs x $3
    expect(result.totalAmount).toBe(PACKAGE_AMOUNT + 9);
  });

  it("nets a reduction against an increase on a different product", async () => {
    const tx = withTx(makeTx());

    await CREATE(
      new Request("http://localhost/api/admin/bookings/create", {
        method: "POST",
        body: JSON.stringify({
          mode: "CREATE",
          ...adminBookingPayload({ items: itemsPayload(10, 20) }),
        }),
      })
    );

    const result = persisted(tx.booking.create.mock.calls[0][0]);
    expect(result.packageAdjustmentAmount).toBe(36); // 12 chairs short
    expect(result.productsAmount).toBe(90); // 6 extra tables
    expect(result.totalAmount).toBe(895);
  });

  it("keeps the package default for an included line the payload omits", async () => {
    const tx = withTx(makeTx());

    await CREATE(
      new Request("http://localhost/api/admin/bookings/create", {
        method: "POST",
        body: JSON.stringify({
          mode: "CREATE",
          ...adminBookingPayload({ items: [] }),
        }),
      })
    );

    const result = persisted(tx.booking.create.mock.calls[0][0]);
    expect(result.packageAdjustmentAmount).toBe(0);
    expect(result.totalAmount).toBe(PACKAGE_AMOUNT);
  });

  it("persists the allowance snapshot and the per-line allowance", async () => {
    const tx = withTx(makeTx());

    await CREATE(
      new Request("http://localhost/api/admin/bookings/create", {
        method: "POST",
        body: JSON.stringify({
          mode: "CREATE",
          ...adminBookingPayload({ items: itemsPayload(INCLUDED_TABLES, 10) }),
        }),
      })
    );

    const result = persisted(tx.booking.create.mock.calls[0][0]);
    expect(result.packageIncludedSnapshot).toEqual(ALLOWANCE_SNAPSHOT);

    const chairs = itemFor(createdItems(tx), CHAIR_VARIANT.id);
    expect(chairs?.quantity).toBe(10);
    expect(chairs?.includedQuantity).toBe(INCLUDED_CHAIRS);
    expect(chairs?.includedUnitPrice).toBe(CHAIR_PRICE);
    expect(chairs?.totalPrice).toBe(0);
  });

  it("gives coupons the reduced package as their base", async () => {
    withTx(makeTx());

    await CREATE(
      new Request("http://localhost/api/admin/bookings/create", {
        method: "POST",
        body: JSON.stringify({
          mode: "CREATE",
          ...adminBookingPayload({ items: itemsPayload(INCLUDED_TABLES, 10) }),
        }),
      })
    );

    // slotAmount is what a PACKAGE_ONLY coupon discounts; it must be $775,
    // not the $841 list price.
    const couponArgs = evaluateAdminCouponsMock.mock.calls[0][1];
    expect(couponArgs.slotAmount).toBe(775);
    expect(couponArgs.bookingSubtotal).toBe(775);
  });
});

describe("admin edit preserves package-included reductions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    evaluateAdminCouponsMock.mockResolvedValue({ totalDiscount: 0, coupons: [] });
    persistAdminBookingCouponsMock.mockResolvedValue(undefined);
  });

  it("an unrelated edit keeps the reduction and the total", async () => {
    // THE regression this feature is most at risk of: re-deriving the allowance
    // from live config on save would restore all 32 chairs and push the total
    // back to $841.
    const tx = withTx(makeTx());

    const res = await patchBooking(
      adminBookingPayload({
        items: itemsPayload(INCLUDED_TABLES, 10),
        customer: {
          name: "Renamed Customer",
          phone: "9998887766",
          email: "renamed@example.com",
        },
        specialInstructions: "Set the projector up early.",
      })
    );
    expect(res.status).toBe(200);

    const result = persisted(tx.booking.update.mock.calls[0][0]);
    expect(result.packageAdjustmentAmount).toBe(66);
    expect(result.totalAmount).toBe(775);
    expect(result.snapshot.packageAdjustmentAmount).toBe(66);

    const data = tx.booking.update.mock.calls[0][0].data;
    expect(data.contactName).toBe("Renamed Customer");
    expect(data.specialInstructions).toBe("Set the projector up early.");
  });

  it("keeps the reduction across repeated saves", async () => {
    const tx = withTx(makeTx());

    for (let i = 0; i < 3; i += 1) {
      await patchBooking(
        adminBookingPayload({ items: itemsPayload(INCLUDED_TABLES, 10) })
      );
    }

    tx.booking.update.mock.calls.forEach((call) => {
      const result = persisted(call[0]);
      expect(result.packageAdjustmentAmount).toBe(66);
      expect(result.totalAmount).toBe(775);
    });
  });

  it("re-persists the allowance snapshot rather than dropping it", async () => {
    const tx = withTx(makeTx());

    await patchBooking(
      adminBookingPayload({ items: itemsPayload(INCLUDED_TABLES, 10) })
    );

    const result = persisted(tx.booking.update.mock.calls[0][0]);
    expect(result.packageIncludedSnapshot).toEqual(ALLOWANCE_SNAPSHOT);
  });

  it("restores the full package price when the reduction is undone", async () => {
    const tx = withTx(makeTx());

    await patchBooking(
      adminBookingPayload({
        items: itemsPayload(INCLUDED_TABLES, INCLUDED_CHAIRS),
      })
    );

    const result = persisted(tx.booking.update.mock.calls[0][0]);
    expect(result.packageAdjustmentAmount).toBe(0);
    expect(result.totalAmount).toBe(PACKAGE_AMOUNT);
  });

  it("charges only the excess when increased past the original allowance", async () => {
    // Client's stated rule: after reducing to 10, going to 35 still includes
    // 32 and charges 3.
    const tx = withTx(makeTx());

    await patchBooking(
      adminBookingPayload({ items: itemsPayload(INCLUDED_TABLES, 35) })
    );

    const result = persisted(tx.booking.update.mock.calls[0][0]);
    expect(result.packageAdjustmentAmount).toBe(0);
    expect(result.productsAmount).toBe(9);
    expect(result.totalAmount).toBe(PACKAGE_AMOUNT + 9);
  });

  it("deepens the reduction when quantities are lowered further", async () => {
    const tx = withTx(makeTx());

    await patchBooking(adminBookingPayload({ items: itemsPayload(0, 0) }));

    const result = persisted(tx.booking.update.mock.calls[0][0]);
    expect(result.packageAdjustmentAmount).toBe(156);
    expect(result.totalAmount).toBe(PACKAGE_AMOUNT - 156);
  });

  it("credits at the snapshotted rate after a catalogue price rise", async () => {
    // Chairs are re-priced $3 -> $5 in the catalogue. The booking was sold at
    // $3, so its credit must stay $66 rather than becoming $110.
    const raised = {
      ...CHAIR_VARIANT,
      regularPrice: 5,
    };
    const tx = withTx(
      makeTx({
        productVariant: {
          findMany: vi.fn().mockResolvedValue([TABLE_VARIANT, raised]),
          updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        },
      })
    );

    await patchBooking(
      adminBookingPayload({ items: itemsPayload(INCLUDED_TABLES, 10) })
    );

    const result = persisted(tx.booking.update.mock.calls[0][0]);
    expect(result.packageAdjustmentAmount).toBe(66);
    expect(result.totalAmount).toBe(775);
  });

  it("charges NEW extras at the raised catalogue price", async () => {
    // The snapshot freezes the credit rate, not the price of genuinely new
    // add-on quantities.
    const raised = { ...CHAIR_VARIANT, regularPrice: 5 };
    const tx = withTx(
      makeTx({
        productVariant: {
          findMany: vi.fn().mockResolvedValue([TABLE_VARIANT, raised]),
          updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        },
      })
    );

    await patchBooking(
      adminBookingPayload({ items: itemsPayload(INCLUDED_TABLES, 35) })
    );

    const result = persisted(tx.booking.update.mock.calls[0][0]);
    expect(result.productsAmount).toBe(15); // 3 extra x live $5
  });

  it("keeps the persisted snapshot internally consistent", async () => {
    const tx = withTx(makeTx());

    await patchBooking(
      adminBookingPayload({ items: itemsPayload(INCLUDED_TABLES, 10) })
    );

    const { baseAmount, totalAmount, snapshot } = persisted(
      tx.booking.update.mock.calls[0][0]
    );
    expect(snapshot.packageAmount + snapshot.extraDurationAmount).toBe(baseAmount);
    expect(snapshot.packageListAmount - snapshot.packageAdjustmentAmount).toBe(
      snapshot.packageAmount
    );
    expect(snapshot.totalAmount).toBe(totalAmount);
  });

  it("keeps extra hours at the full rate alongside a reduction", async () => {
    const tx = withTx(makeTx());

    await patchBooking(
      adminBookingPayload({
        endTime: "15:00", // 6h on a 4h package
        items: itemsPayload(INCLUDED_TABLES, 10),
      })
    );

    const result = persisted(tx.booking.update.mock.calls[0][0]);
    expect(result.snapshot.extraDurationAmount).toBe(300);
    expect(result.packageAdjustmentAmount).toBe(66);
    expect(result.totalAmount).toBe(PACKAGE_AMOUNT + 300 - 66);
  });
});

describe("bookings that predate the feature", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    evaluateAdminCouponsMock.mockResolvedValue({ totalDiscount: 0, coupons: [] });
    persistAdminBookingCouponsMock.mockResolvedValue(undefined);
  });

  function legacyTx() {
    return withTx(
      makeTx({
        booking: {
          ...makeTx().booking,
          findUnique: vi.fn().mockResolvedValue(
            reducedBooking({
              packageAdjustmentAmount: 0,
              packageIncludedSnapshot: null,
              items: [
                bookingItemRow(
                  TABLE_VARIANT,
                  INCLUDED_TABLES,
                  0, // pre-migration default
                  0
                ),
                bookingItemRow(CHAIR_VARIANT, INCLUDED_CHAIRS, 0, 0),
              ],
            })
          ),
        },
      })
    );
  }

  it("an unrelated edit leaves a legacy booking's total unchanged", async () => {
    const tx = legacyTx();

    const res = await patchBooking(
      adminBookingPayload({
        items: itemsPayload(INCLUDED_TABLES, INCLUDED_CHAIRS),
        specialInstructions: "Unrelated note.",
      })
    );
    expect(res.status).toBe(200);

    const result = persisted(tx.booking.update.mock.calls[0][0]);
    expect(result.packageAdjustmentAmount).toBe(0);
    expect(result.productsAmount).toBe(0);
    expect(result.totalAmount).toBe(PACKAGE_AMOUNT);
  });

  it("does not bill a legacy booking that has no stored furniture rows", async () => {
    // The edit form loads these lines at the package quantity (they are covered
    // by the package price), so the save MUST treat them as included. Resolving
    // the allowance from the booking's own rows returned nothing for a booking
    // with no rows, which would have billed the full $156 as a new add-on.
    const tx = withTx(
      makeTx({
        booking: {
          ...makeTx().booking,
          findUnique: vi.fn().mockResolvedValue(
            reducedBooking({
              packageAdjustmentAmount: 0,
              packageIncludedSnapshot: null,
              items: [],
            })
          ),
        },
      })
    );

    const res = await patchBooking(
      adminBookingPayload({
        items: itemsPayload(INCLUDED_TABLES, INCLUDED_CHAIRS),
        specialInstructions: "Unrelated note.",
      })
    );
    expect(res.status).toBe(200);

    const result = persisted(tx.booking.update.mock.calls[0][0]);
    expect(result.productsAmount).toBe(0);
    expect(result.packageAdjustmentAmount).toBe(0);
    expect(result.totalAmount).toBe(PACKAGE_AMOUNT);
    // It gains a snapshot, so future edits are frozen against price drift.
    expect(result.packageIncludedSnapshot).toEqual(ALLOWANCE_SNAPSHOT);
  });

  it("lets a legacy booking with no rows be reduced on the same edit", async () => {
    const tx = withTx(
      makeTx({
        booking: {
          ...makeTx().booking,
          findUnique: vi.fn().mockResolvedValue(
            reducedBooking({
              packageAdjustmentAmount: 0,
              packageIncludedSnapshot: null,
              items: [],
            })
          ),
        },
      })
    );

    await patchBooking(
      adminBookingPayload({ items: itemsPayload(INCLUDED_TABLES, 10) })
    );

    const result = persisted(tx.booking.update.mock.calls[0][0]);
    expect(result.packageAdjustmentAmount).toBe(66);
    expect(result.totalAmount).toBe(775);
  });

  it("rebuilds an allowance for a legacy booking so it can be reduced", async () => {
    const tx = legacyTx();

    await patchBooking(
      adminBookingPayload({ items: itemsPayload(INCLUDED_TABLES, 10) })
    );

    const result = persisted(tx.booking.update.mock.calls[0][0]);
    expect(result.packageAdjustmentAmount).toBe(66);
    expect(result.totalAmount).toBe(775);
    // It now carries a snapshot, so later edits are frozen against price drift.
    expect(result.packageIncludedSnapshot).toEqual(ALLOWANCE_SNAPSHOT);
  });
});

describe("customer booking session", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("freezes the allowance snapshot when the package is selected", async () => {
    const tx = withTx(
      makeTx({
        booking: {
          ...makeTx().booking,
          findUnique: vi.fn().mockResolvedValue(null),
        },
      })
    );


    await createOrReplaceVenueBookingSession(
      {
        packageId: PACKAGE.id,
        eventDate: EVENT_DATE,
        startTime: START_TIME,
        endTime: END_TIME,
      },
      "guest-1",
      null
    );

    const created = tx.booking.create.mock.calls[0][0];
    expect(created.data.packageIncludedSnapshot).toEqual(ALLOWANCE_SNAPSHOT);
    expect(created.data.packageAdjustmentAmount).toBe(0);
    expect(Number(created.data.totalAmount)).toBe(PACKAGE_AMOUNT);
    expect(created.data.pricingSnapshot.packageListAmount).toBe(PACKAGE_AMOUNT);
  });
});
