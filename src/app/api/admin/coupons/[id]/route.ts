import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { toUiCouponScope } from "@/lib/coupon-scope";
import { AdminCouponFormState } from "@/components/admin/coupons/types";
import { getAuthenticatedAdminIdFromCookies } from "@/services/auth/adminAuth.server";
import {
  CouponValidationError,
  normalizeCouponPayload,
} from "@/services/coupon/coupon-validation";

class CouponCodeConflictError extends Error {
  constructor() {
    super("Coupon code already exists");
    this.name = "CouponCodeConflictError";
  }
}

function buildArchivedCouponCode(code: string, couponId: string) {
  const safeCode = code.trim().toUpperCase();
  const suffix = `${couponId.slice(-8)}_${Date.now()}`;
  return `${safeCode}__DELETED__${suffix}`;
}

const OPEN_BOOKING_STATUSES = ["INCOMPLETE", "AWAITING_PAYMENT", "PAYMENT_PROCESSING"] as const;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const adminId = await getAuthenticatedAdminIdFromCookies();
    if (!adminId) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const { id } = await params;

    const coupon = await prisma.coupon.findFirst({
      where: {
        id,
        isDeleted: false,
      },
      include: {
        rules: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!coupon) {
      return NextResponse.json(
        { success: false, message: "Coupon not found" },
        { status: 404 }
      );
    }

    const data: AdminCouponFormState = {
      id: coupon.id,
      code: coupon.code,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      maxDiscount: coupon.maxDiscount ?? null,
      scope: toUiCouponScope(coupon.scope),
      validFrom: coupon.validFrom.toISOString(),
      validTill: coupon.validTill ? coupon.validTill.toISOString() : null,
      isStackable: coupon.isStackable,
      stackableCouponIds: coupon.stackableCouponIds ?? [],
      usageLimit: coupon.usageLimit ?? null,
      perUserUsageLimit: coupon.perUserUsageLimit ?? null,
      minimumAmount: coupon.minimumAmount ?? null,
      locationId: coupon.locationId ?? null,
      isActive: coupon.isActive,
      rules: coupon.rules.map((rule) => ({
        id: rule.id,
        type: rule.type,
        operator: rule.operator,
        value: rule.value as AdminCouponFormState["rules"][number]["value"],
      })),
    };

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("[GET_COUPON_BY_ID]", error);
    return NextResponse.json(
      { success: false, message: "Failed to fetch coupon" },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const adminId = await getAuthenticatedAdminIdFromCookies();
    if (!adminId) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const { id } = await params;
    const body = await req.json();
    const payload = normalizeCouponPayload(body);

    await prisma.$transaction(async tx => {
      const existingActive = await tx.coupon.findFirst({
        where: {
          code: payload.code,
          isDeleted: false,
          id: { not: id },
        },
        select: { id: true },
      });

      if (existingActive) {
        throw new CouponCodeConflictError();
      }

      const deletedWithSameCode = await tx.coupon.findMany({
        where: {
          code: payload.code,
          isDeleted: true,
          id: { not: id },
        },
        select: {
          id: true,
          code: true,
        },
      });

      for (const deletedCoupon of deletedWithSameCode) {
        await tx.coupon.update({
          where: { id: deletedCoupon.id },
          data: {
            code: buildArchivedCouponCode(deletedCoupon.code, deletedCoupon.id),
            modifiedBy: "ADMIN",
            modifiedAt: new Date(),
          },
        });
      }

      // 1️⃣ Update coupon core fields
      await tx.coupon.update({
        where: { id },
        data: {
          code: payload.code,
          discountType: payload.discountType,
          discountValue: payload.discountValue,
          maxDiscount: payload.maxDiscount,
          scope: payload.scope,
          validFrom: payload.validFrom,
          validTill: payload.validTill,
          isStackable: payload.isStackable,
          stackableCouponIds: payload.stackableCouponIds.filter(
            (couponId) => couponId !== id
          ),
          usageLimit: payload.usageLimit,
          perUserUsageLimit: payload.perUserUsageLimit,
          minimumAmount: payload.minimumAmount,
          locationId: payload.locationId,
          isActive: payload.isActive,
          modifiedBy: "ADMIN",
          modifiedAt: new Date(),
        },
      });

      // 2️⃣ Replace rules (safe & deterministic)
      await tx.couponRule.deleteMany({
        where: { couponId: id },
      });

      if (payload.rules.length > 0) {
        await tx.couponRule.createMany({
          data: payload.rules.map((rule) => ({
            couponId: id,
            type: rule.type,
            operator: rule.operator,
            value: rule.value,
          })),
        });
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof CouponValidationError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 400 }
      );
    }

    if (error instanceof CouponCodeConflictError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 409 }
      );
    }

    console.error("[UPDATE_COUPON]", error);
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "P2002"
    ) {
      return NextResponse.json(
        { success: false, message: "Coupon code already exists" },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { success: false, message: "Failed to update coupon" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const adminId = await getAuthenticatedAdminIdFromCookies();
    if (!adminId) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const { id } = await params;

    const coupon = await prisma.coupon.findFirst({
      where: {
        id,
        isDeleted: false,
      },
      select: { id: true, code: true },
    });

    if (!coupon) {
      return NextResponse.json(
        { success: false, message: "Coupon not found" },
        { status: 404 }
      );
    }

    const openBookingUsageCount = await prisma.couponUsage.count({
      where: {
        couponId: id,
        booking: {
          bookingStatus: {
            in: [...OPEN_BOOKING_STATUSES],
          },
        },
      },
    });

    await prisma.coupon.update({
      where: { id },
      data: {
        code: buildArchivedCouponCode(coupon.code, coupon.id),
        isDeleted: true,
        isActive: false,
        modifiedBy: "ADMIN",
        modifiedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      message:
        openBookingUsageCount > 0
          ? `Coupon deleted. It is still linked to ${openBookingUsageCount} open booking${openBookingUsageCount === 1 ? "" : "s"} and will no longer apply there.`
          : "Coupon deleted successfully.",
    });
  } catch (error) {
    console.error("[DELETE_COUPON]", error);
    return NextResponse.json(
      { success: false, message: "Failed to delete coupon" },
      { status: 500 }
    );
  }
}
