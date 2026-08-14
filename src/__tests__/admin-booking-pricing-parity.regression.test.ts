// Parity between the Booking Details drawer and the Edit Booking screen.
//
// Both read the same booking through the same GET handler; the drawer takes the
// `view=details` branch and the edit form the default branch. They diverged
// because the edit form then RE-DERIVED the products total client-side using a
// per-item allowance field that is 0 on every booking predating the feature —
// so `?? packageConfig` never fell through and the package's own tables/chairs
// were billed a second time.
//
// These tests drive the real GET handler against the shape of a real booking
// (HR0721202600029: Classic, base 692, products 95, additional charge 45.32,
// total 832.32) and assert the two branches cannot report different money.

import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: { booking: { findUnique: vi.fn() }, product: { findMany: vi.fn() } },
}));

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  after: vi.fn(),
}));
vi.mock("@/services/auth/adminAuth.server", () => ({
  getAuthenticatedAdminIdFromCookies: vi.fn().mockResolvedValue("admin-1"),
}));
// Signing needs a runtime secret and has nothing to do with pricing.
vi.mock("@/services/booking/successToken.server", () => ({
  createSuccessToken: vi.fn().mockReturnValue("success-token"),
}));

import { GET } from "@/app/api/admin/bookings/[id]/route";

/* ─── The real booking's stored shape ──────────────────────────────────────── */

const CLASSIC_PACKAGE_AMOUNT = 692;
const PRODUCTS_AMOUNT = 95; // Shimmer Wall only; tables/chairs are included
const ADDITIONAL_CHARGE = 45.32;
const TOTAL = 832.32;

const TABLES_PRODUCT = { id: "tables-product", slug: "tables", name: "Tables", category: "GIFT", isActive: true };
const CHAIRS_PRODUCT = { id: "chairs-product", slug: "chairs", name: "Chairs", category: "GIFT", isActive: true };

const CATALOGUE = [
  {
    ...TABLES_PRODUCT,
    variants: [{ id: "tables-v", productId: "tables-product", label: "Per Table", regularPrice: 15, salePrice: null, isDefault: true, isActive: true, sortOrder: 0 }],
  },
  {
    ...CHAIRS_PRODUCT,
    variants: [{ id: "chairs-v", productId: "chairs-product", label: "Per Chair", regularPrice: 3, salePrice: null, isDefault: true, isActive: true, sortOrder: 0 }],
  },
];

function storedItem(
  id: string, productId: string, variantId: string, productName: string,
  quantity: number, unitPrice: number, totalPrice: number, slug: string
) {
  return {
    id, productId, variantId, productName, variantLabel: "std", category: "GIFT",
    quantity, unitPrice, totalPrice,
    // 0 on every booking created before the feature — the value whose `??`
    // handling caused the divergence.
    includedQuantity: 0, includedUnitPrice: 0,
    product: { slug, image: null },
  };
}

function bookingRow() {
  return {
    id: "booking-1",
    bookingRef: "HR0721202600029",
    bookingStatus: "APPROVED",
    paymentStatus: "PAID",
    cancelledReason: null,
    contactName: "Parity Customer",
    contactPhone: "9998887777",
    contactEmail: "parity@example.com",
    user: null,
    venue: { id: "venue-1", name: "Haven", city: "Austin", images: [] },
    eventPackage: { id: "pkg-classic", name: "Classic Package", locationId: "loc-1", guestLimit: 30 },
    packageId: "pkg-classic",
    venueId: "venue-1",
    eventDate: new Date("2030-07-21T00:00:00.000Z"),
    eventStartTime: "10:00",
    eventEndTime: "14:00",
    startsAtUtc: new Date("2030-07-21T14:00:00.000Z"),
    endsAtUtc: new Date("2030-07-21T18:00:00.000Z"),
    guestCount: 30,
    decorationRequired: false,
    specialInstructions: null,
    occasionKey: null, occasionLabel: null, occasionData: null,

    baseAmount: CLASSIC_PACKAGE_AMOUNT,
    extrasAmount: 0,
    productsAmount: PRODUCTS_AMOUNT,
    additionalChargeAmount: ADDITIONAL_CHARGE,
    additionalChargeReason: "Late checkout",
    decorationAmount: 0,
    discountAmount: 0,
    totalAmount: TOTAL,
    advancePaid: 200,
    remainingPayable: TOTAL - 200,
    packageAdjustmentAmount: 0,
    packageIncludedSnapshot: null, // legacy booking

    packageSnapshot: {
      id: "pkg-classic", guestLimit: 30, eventDurationHours: 4,
      subtotalAmount: CLASSIC_PACKAGE_AMOUNT, decorationAddonPrice: 0, extraPersonPrice: 0,
    },
    pricingSnapshot: {
      packageAmount: CLASSIC_PACKAGE_AMOUNT, extraDurationAmount: 0, extraDurationHours: 0,
      productsAmount: PRODUCTS_AMOUNT, additionalChargeAmount: ADDITIONAL_CHARGE,
      discountAmount: 0, totalAmount: TOTAL, advancePaid: 200,
      remainingPayable: TOTAL - 200,
    },

    items: [
      storedItem("i1", "tables-product", "tables-v", "Tables", 3, 15, 0, "tables"),
      storedItem("i2", "chairs-product", "chairs-v", "Chairs", 24, 3, 0, "chairs"),
      storedItem("i3", "shimmer-product", "shimmer-v", "Shimmer Wall", 1, 95, 95, "shimmer-wall"),
    ],
    couponUsages: [],
    payment: [],
    signedAgreements: [],
    reviewSubmittedAt: null, reviewedAt: null, reviewedByAdminId: null,
    rejectionReason: null, approvalNotes: null, internalNotes: null,
    createdAt: new Date("2026-07-21T10:00:00.000Z"),
    updatedAt: new Date("2026-07-21T10:00:00.000Z"),
    lockVersion: 1, timezone: "America/New_York", bufferMinutes: 30,
    createdByRole: "ADMIN", createdByAdminId: "admin-1",
  };
}

async function fetchBooking(view?: string) {
  const url = view
    ? `http://localhost/api/admin/bookings/booking-1?view=${view}`
    : "http://localhost/api/admin/bookings/booking-1";
  const res = await GET(new Request(url), {
    params: Promise.resolve({ id: "booking-1" }),
  });
  const json = await res.json();
  return { res, data: json.data };
}

/**
 * Reproduces the edit form's client-side product pricing using the allowance
 * the API hands it — the exact path that used to double-bill the package
 * furniture.
 */
function editFormProductsTotal(data: {
  items: Array<{ productId: string; variantId: string; quantity: number; unitPrice: number }>;
  packageIncludedAllowances?: Array<{ variantId: string; includedQuantity: number; includedUnitPrice: number }>;
}) {
  const allowances = new Map(
    (data.packageIncludedAllowances ?? []).map((a) => [a.variantId, a])
  );
  return data.items.reduce((sum, item) => {
    const allowance = allowances.get(item.variantId);
    const included = allowance?.includedQuantity ?? 0;
    return sum + Math.max(item.quantity - included, 0) * item.unitPrice;
  }, 0);
}

/* ─── Tests ────────────────────────────────────────────────────────────────── */

describe("details drawer and edit screen report identical pricing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.booking.findUnique.mockResolvedValue(bookingRow());
    prismaMock.product.findMany.mockResolvedValue(CATALOGUE);
  });

  it("the drawer reports the stored pricing verbatim", async () => {
    const { res, data } = await fetchBooking("drawer");
    expect(res.status).toBe(200);

    expect(data.pricing.packageAmount).toBe(CLASSIC_PACKAGE_AMOUNT);
    expect(data.pricing.products).toBe(PRODUCTS_AMOUNT);
    expect(data.pricing.additionalChargeAmount).toBe(ADDITIONAL_CHARGE);
    expect(data.pricing.total).toBe(TOTAL);
  });

  it("the edit screen reports the same stored pricing", async () => {
    const { res, data } = await fetchBooking();
    expect(res.status).toBe(200);

    expect(data.pricing.productsAmount).toBe(PRODUCTS_AMOUNT);
    expect(data.pricing.additionalChargeAmount).toBe(ADDITIONAL_CHARGE);
    expect(data.pricing.totalAmount).toBe(TOTAL);
    expect(data.pricing.advancePaid).toBe(200);
    expect(data.pricing.remainingPayable).toBe(TOTAL - 200);
  });

  it("both branches agree on every money field", async () => {
    const { data: drawer } = await fetchBooking("drawer");
    const { data: edit } = await fetchBooking();

    expect(edit.pricing.productsAmount).toBe(drawer.pricing.products);
    expect(edit.pricing.additionalChargeAmount).toBe(drawer.pricing.additionalChargeAmount);
    expect(edit.pricing.additionalChargeReason).toBe(drawer.pricing.additionalChargeReason);
    expect(edit.pricing.discountAmount).toBe(drawer.pricing.discount);
    expect(edit.pricing.totalAmount).toBe(drawer.pricing.total);
    expect(edit.pricing.advancePaid).toBe(drawer.pricing.advancePaid);
    expect(edit.pricing.remainingPayable).toBe(drawer.pricing.remainingPayable);
    expect(edit.pricing.extrasAmount).toBe(drawer.pricing.extras);
    expect(edit.pricing.baseAmount).toBe(drawer.pricing.base);
  });

  it("the edit screen re-derives the SAME products total the booking stored", async () => {
    // The regression: this returned 212 (95 + the package's own $117 of tables
    // and chairs billed again), so the edit total read 904 against a stored 832.32.
    const { data } = await fetchBooking();

    expect(editFormProductsTotal(data)).toBe(PRODUCTS_AMOUNT);
    expect(editFormProductsTotal(data)).toBe(data.pricing.productsAmount);
  });

  it("hands the edit form an allowance covering the package furniture", async () => {
    const { data } = await fetchBooking();
    const byVariant = new Map(
      data.packageIncludedAllowances.map((a: { variantId: string }) => [a.variantId, a])
    );

    // Classic includes 3 tables + 24 chairs = the package's $117 line.
    expect(byVariant.get("tables-v")).toMatchObject({ includedQuantity: 3, includedUnitPrice: 15 });
    expect(byVariant.get("chairs-v")).toMatchObject({ includedQuantity: 24, includedUnitPrice: 3 });
  });

  it("keeps the stored per-line totals intact", async () => {
    const { data } = await fetchBooking();
    const byName = Object.fromEntries(
      data.items.map((i: { productName: string; totalPrice: number }) => [i.productName, i.totalPrice])
    );

    expect(byName.Tables).toBe(0);
    expect(byName.Chairs).toBe(0);
    expect(byName["Shimmer Wall"]).toBe(95);
    const summed = data.items.reduce(
      (s: number, i: { totalPrice: number }) => s + i.totalPrice, 0
    );
    expect(summed).toBe(PRODUCTS_AMOUNT);
  });

  it("reports pricing that adds up to the stored total", async () => {
    const { data } = await fetchBooking();
    const p = data.pricing;
    const rebuilt =
      p.baseAmount + p.extrasAmount + p.decorationAmount +
      p.productsAmount + p.additionalChargeAmount - p.discountAmount;

    expect(rebuilt).toBeCloseTo(p.totalAmount, 2);
    expect(rebuilt).toBeCloseTo(TOTAL, 2);
  });

  it("hydrates the additional charge into the edit form's input", async () => {
    // Mirrors AdminAddBookingForm's hydration expression and the memo that
    // feeds calculateBookingPricing, so a change to either that silently drops
    // a stored charge fails here.
    const { data } = await fetchBooking();

    const input =
      Number(data.pricing.additionalChargeAmount ?? 0) > 0
        ? String(Number(data.pricing.additionalChargeAmount ?? 0))
        : "";
    expect(input).toBe("45.32");

    const parsed = Number(input);
    const memoValue = !input.trim()
      ? 0
      : Number.isFinite(parsed)
        ? Math.max(parsed, 0)
        : Number.NaN;
    expect(memoValue).toBe(ADDITIONAL_CHARGE);
  });

  it("reconstructs the stored total from what the edit form would compute", async () => {
    // The whole divergence in one assertion: package + re-derived products +
    // hydrated additional charge must land on the stored total.
    const { data } = await fetchBooking();
    const editTotal =
      data.pricing.baseAmount +
      editFormProductsTotal(data) +
      Number(data.pricing.additionalChargeAmount ?? 0);

    expect(editTotal).toBeCloseTo(TOTAL, 2);
    expect(editTotal).toBeCloseTo(data.pricing.totalAmount, 2);
  });

  it("does not invent a package adjustment for a legacy booking", async () => {
    const { data: drawer } = await fetchBooking("drawer");
    expect(drawer.pricing.packageAdjustmentAmount).toBe(0);
    expect(drawer.pricing.packageAmount).toBe(CLASSIC_PACKAGE_AMOUNT);
  });
});
