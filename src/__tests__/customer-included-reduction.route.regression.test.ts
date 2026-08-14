// Customer-flow coverage for reducing package-included quantities.
//
// Drives the real /api/bookings/items/commit handler with the real pricing
// modules, so the allowance snapshot, the per-line pricing and the persisted
// package adjustment are all genuinely exercised. Only session, coupon and
// settings boundaries are mocked.

import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  prismaMock,
  resolveBookingCouponUserIdMock,
  buildBookingCouponContextMock,
  rebalanceReservedBookingCouponsMock,
  getRequiredAdvancePaymentAmountMock,
  isNumberDecorationProductMock,
} = vi.hoisted(() => ({
  prismaMock: {
    $transaction: vi.fn(),
    couponUsage: { findMany: vi.fn() },
  },
  resolveBookingCouponUserIdMock: vi.fn(),
  buildBookingCouponContextMock: vi.fn(),
  rebalanceReservedBookingCouponsMock: vi.fn(),
  getRequiredAdvancePaymentAmountMock: vi.fn(),
  isNumberDecorationProductMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

vi.mock("@/services/booking/range-booking-api-session", () => ({
  getRangeBookingApiIdentity: vi.fn().mockResolvedValue({
    bookingId: "booking_1",
    lockOwner: "owner_1",
    lockVersion: 1,
  }),
}));

vi.mock("@/services/booking/range-booking-session.service", () => ({
  requireActiveRangeBookingSession: vi.fn().mockResolvedValue({}),
  RangeBookingSessionError: class RangeBookingSessionError extends Error {},
}));

vi.mock("@/services/coupon/booking-coupon.service", () => ({
  buildBookingCouponContext: buildBookingCouponContextMock,
  rebalanceReservedBookingCoupons: rebalanceReservedBookingCouponsMock,
  resolveBookingCouponUserId: resolveBookingCouponUserIdMock,
  BookingCouponMinimumPayableError: class BookingCouponMinimumPayableError extends Error {},
}));

vi.mock("@/lib/advance-payment", () => ({
  getRequiredAdvancePaymentAmount: getRequiredAdvancePaymentAmountMock,
}));

vi.mock("@/lib/product-numbering", () => ({
  isNumberDecorationProduct: isNumberDecorationProductMock,
}));

vi.mock("@/lib/coupon-display", () => ({
  getCouponDisplayCode: vi.fn((code: string) => code),
}));

vi.mock("@/services/coupon/coupon-minimum-payable", () => ({
  buildMinimumPayableMessage: vi.fn(() => "Minimum payable not met."),
}));

import { POST } from "@/app/api/bookings/items/commit/route";

/* ─── Fixtures: the Premium package ────────────────────────────────────────── */

const PACKAGE_AMOUNT = 841;
const CHAIR_PRICE = 3;
const TABLE_PRICE = 15;
const INCLUDED_CHAIRS = 32;
const INCLUDED_TABLES = 4;

const TABLE_VARIANT = {
  id: "tables-default",
  productId: "tables-product",
  label: "Per Table",
  regularPrice: TABLE_PRICE,
  salePrice: null,
  stock: null,
  maxPerBooking: null,
  isDefault: true,
  isActive: true,
  product: {
    id: "tables-product",
    name: "Tables",
    slug: "tables",
    category: "GIFT",
  },
};

const CHAIR_VARIANT = {
  id: "chairs-default",
  productId: "chairs-product",
  label: "Per Chair",
  regularPrice: CHAIR_PRICE,
  salePrice: null,
  stock: null,
  maxPerBooking: null,
  isDefault: true,
  isActive: true,
  product: {
    id: "chairs-product",
    name: "Chairs",
    slug: "chairs",
    category: "GIFT",
  },
};

const ALLOWANCE_SNAPSHOT = [
  {
    productSlug: "tables",
    productId: "tables-product",
    variantId: "tables-default",
    includedQuantity: INCLUDED_TABLES,
    includedUnitPrice: TABLE_PRICE,
  },
  {
    productSlug: "chairs",
    productId: "chairs-product",
    variantId: "chairs-default",
    includedQuantity: INCLUDED_CHAIRS,
    includedUnitPrice: CHAIR_PRICE,
  },
];

function createTxMock(
  overrides: { packageIncludedSnapshot?: unknown; items?: unknown[] } = {}
) {
  return {
    $queryRaw: vi.fn().mockResolvedValue([{ id: "booking_1" }]),
    booking: {
      findUnique: vi.fn().mockResolvedValue({
        id: "booking_1",
        bookingStatus: "INCOMPLETE",
        advancePaid: 0,
        extrasAmount: 0,
        discountAmount: 0,
        guestCount: 40,
        userId: null,
        contactPhone: "9999999999",
        decorationRequired: false,
        occasionData: null,
        venueId: "venue_1",
        eventDate: new Date("2030-03-25T00:00:00.000Z"),
        eventStartTime: "10:00",
        eventEndTime: "14:00",
        startsAtUtc: new Date("2030-03-25T14:00:00.000Z"),
        endsAtUtc: new Date("2030-03-25T18:00:00.000Z"),
        baseAmount: PACKAGE_AMOUNT,
        packageSnapshot: {
          guestLimit: 40,
          eventDurationHours: 4,
          hourlyRate: 150,
        },
        pricingSnapshot: {
          packageAmount: PACKAGE_AMOUNT,
          packageListAmount: PACKAGE_AMOUNT,
          packageAdjustmentAmount: 0,
          extraDurationAmount: 0,
          advancePaid: 0,
        },
        packageIncludedSnapshot:
          "packageIncludedSnapshot" in overrides
            ? overrides.packageIncludedSnapshot
            : ALLOWANCE_SNAPSHOT,
        items: overrides.items ?? [],
        eventPackage: { locationId: "loc_1" },
      }),
      update: vi.fn().mockResolvedValue({}),
    },
    product: { findMany: vi.fn().mockResolvedValue([]) },
    productVariant: {
      findMany: vi.fn().mockResolvedValue([TABLE_VARIANT, CHAIR_VARIANT]),
    },
    appSetting: { findMany: vi.fn().mockResolvedValue([]) },
    bookingItem: {
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      create: vi.fn().mockResolvedValue({}),
    },
  };
}

function itemsPayload(tables: number, chairs: number) {
  return [
    { productId: "tables-product", variantId: "tables-default", quantity: tables },
    { productId: "chairs-product", variantId: "chairs-default", quantity: chairs },
  ];
}

async function commit(
  tx: ReturnType<typeof createTxMock>,
  items: ReturnType<typeof itemsPayload> | []
) {
  prismaMock.$transaction.mockImplementation(
    async (cb: (inner: typeof tx) => Promise<unknown>) => cb(tx)
  );
  const res = await POST(
    new Request("http://localhost/api/bookings/items/commit", {
      method: "POST",
      body: JSON.stringify({ bookingId: "booking_1", items }),
    })
  );
  return res;
}

function updateData(tx: ReturnType<typeof createTxMock>) {
  return tx.booking.update.mock.calls[0][0].data as Record<string, unknown>;
}

function createdItem(tx: ReturnType<typeof createTxMock>, variantId: string) {
  const call = tx.bookingItem.create.mock.calls.find(
    (c) => (c[0] as { data: { variantId: string } }).data.variantId === variantId
  );
  return (call?.[0] as { data: Record<string, unknown> } | undefined)?.data;
}

/* ─── Tests ────────────────────────────────────────────────────────────────── */

describe("customer flow: package-included reductions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resolveBookingCouponUserIdMock.mockResolvedValue(null);
    buildBookingCouponContextMock.mockReturnValue({});
    rebalanceReservedBookingCouponsMock.mockResolvedValue({
      totalDiscount: 0,
      appliedCoupons: [],
      allocations: [],
    });
    getRequiredAdvancePaymentAmountMock.mockResolvedValue(150);
    isNumberDecorationProductMock.mockReturnValue(false);
    prismaMock.couponUsage.findMany.mockResolvedValue([]);
  });

  it("charges the full package when included quantities are untouched", async () => {
    const tx = createTxMock();
    const res = await commit(tx, itemsPayload(INCLUDED_TABLES, INCLUDED_CHAIRS));
    expect(res.status).toBe(200);

    const data = updateData(tx);
    expect(Number(data.packageAdjustmentAmount)).toBe(0);
    expect(Number(data.productsAmount)).toBe(0);
    expect(Number(data.totalAmount)).toBe(PACKAGE_AMOUNT);
  });

  it("reduces the package price when chairs are reduced (32 -> 20)", async () => {
    const tx = createTxMock();
    const res = await commit(tx, itemsPayload(INCLUDED_TABLES, 20));
    expect(res.status).toBe(200);

    const data = updateData(tx);
    expect(Number(data.packageAdjustmentAmount)).toBe(36);
    expect(Number(data.totalAmount)).toBe(PACKAGE_AMOUNT - 36);
    expect(Number(data.baseAmount)).toBe(PACKAGE_AMOUNT - 36);
  });

  it("credits the whole allowance when reduced to zero", async () => {
    const tx = createTxMock();
    const res = await commit(tx, itemsPayload(0, 0));
    expect(res.status).toBe(200);

    const data = updateData(tx);
    expect(Number(data.packageAdjustmentAmount)).toBe(156);
    expect(Number(data.totalAmount)).toBe(PACKAGE_AMOUNT - 156);
  });

  it("persists a reduced-to-zero line so it cannot be re-seeded", async () => {
    const tx = createTxMock();
    await commit(tx, itemsPayload(INCLUDED_TABLES, 0));

    const chairs = createdItem(tx, "chairs-default");
    expect(chairs).toBeDefined();
    expect(chairs?.quantity).toBe(0);
    expect(chairs?.includedQuantity).toBe(INCLUDED_CHAIRS);
    expect(chairs?.includedUnitPrice).toBe(CHAIR_PRICE);
  });

  it("charges only the excess when quantities are increased", async () => {
    const tx = createTxMock();
    const res = await commit(tx, itemsPayload(INCLUDED_TABLES, 35));
    expect(res.status).toBe(200);

    const data = updateData(tx);
    expect(Number(data.packageAdjustmentAmount)).toBe(0);
    expect(Number(data.productsAmount)).toBe(9);
    expect(Number(data.totalAmount)).toBe(PACKAGE_AMOUNT + 9);
  });

  it("restores the full package price when a reduction is undone", async () => {
    const tx = createTxMock();
    await commit(tx, itemsPayload(INCLUDED_TABLES, 20));
    expect(Number(updateData(tx).packageAdjustmentAmount)).toBe(36);

    const tx2 = createTxMock();
    await commit(tx2, itemsPayload(INCLUDED_TABLES, INCLUDED_CHAIRS));
    expect(Number(updateData(tx2).packageAdjustmentAmount)).toBe(0);
    expect(Number(updateData(tx2).totalAmount)).toBe(PACKAGE_AMOUNT);
  });

  it("keeps the package default for an included line the client omits", async () => {
    const tx = createTxMock();
    const res = await commit(tx, []);
    expect(res.status).toBe(200);

    const data = updateData(tx);
    expect(Number(data.packageAdjustmentAmount)).toBe(0);
    expect(Number(data.totalAmount)).toBe(PACKAGE_AMOUNT);
  });

  it("credits at the snapshotted rate after a catalogue price rise", async () => {
    const tx = createTxMock();
    tx.productVariant.findMany = vi
      .fn()
      .mockResolvedValue([TABLE_VARIANT, { ...CHAIR_VARIANT, regularPrice: 5 }]);

    await commit(tx, itemsPayload(INCLUDED_TABLES, 20));

    const data = updateData(tx);
    expect(Number(data.packageAdjustmentAmount)).toBe(36); // 12 x $3, not x $5
  });

  it("gives coupons the reduced package as their base", async () => {
    const tx = createTxMock();
    await commit(tx, itemsPayload(INCLUDED_TABLES, 20));

    const context = buildBookingCouponContextMock.mock.calls[0][0];
    expect(context.slotAmount).toBe(PACKAGE_AMOUNT - 36);
  });

  it("does not compound the reduction across repeated commits", async () => {
    // Each commit re-reads the booking's snapshot, which carries the list price;
    // re-basing off the already-net amount would shrink the total every save.
    const tx = createTxMock();
    await commit(tx, itemsPayload(INCLUDED_TABLES, 20));
    const first = Number(updateData(tx).totalAmount);

    const tx2 = createTxMock();
    tx2.booking.findUnique = vi.fn().mockResolvedValue({
      ...(await tx.booking.findUnique()),
      pricingSnapshot: updateData(tx).pricingSnapshot,
      packageAdjustmentAmount: 36,
    });
    await commit(tx2, itemsPayload(INCLUDED_TABLES, 20));

    expect(Number(updateData(tx2).totalAmount)).toBe(first);
    expect(first).toBe(PACKAGE_AMOUNT - 36);
  });

  it("leaves a booking with no allowance snapshot unpriced by the feature", async () => {
    const tx = createTxMock({ packageIncludedSnapshot: null, items: [] });
    const res = await commit(tx, itemsPayload(INCLUDED_TABLES, 20));
    expect(res.status).toBe(200);

    // No snapshot and no legacy items to rebuild from -> chairs are a plain
    // add-on, charged in full, and no package credit is invented.
    const data = updateData(tx);
    expect(Number(data.packageAdjustmentAmount)).toBe(0);
    expect(Number(data.productsAmount)).toBe(20 * CHAIR_PRICE + 4 * TABLE_PRICE);
  });
});
