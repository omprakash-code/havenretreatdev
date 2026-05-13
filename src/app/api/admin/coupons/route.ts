import type { CouponDiscountType, Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { toDbCouponScope, toUiCouponScope } from "@/lib/coupon-scope";
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

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

function parsePositiveInt(value: string | null, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export async function GET(req: Request) {
  try {
    const adminId = await getAuthenticatedAdminIdFromCookies();
    if (!adminId) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const page = parsePositiveInt(searchParams.get("page"), 1);
    const pageSize = Math.min(
      parsePositiveInt(searchParams.get("pageSize"), DEFAULT_PAGE_SIZE),
      MAX_PAGE_SIZE
    );
    const search = searchParams.get("search")?.trim() ?? "";
    const status = searchParams.get("status") ?? "ALL";
    const activity = searchParams.get("activity") ?? "ALL";
    const discountType = searchParams.get("discountType") ?? "ALL";
    const scope = searchParams.get("scope") ?? "ALL";
    const stackable = searchParams.get("stackable") ?? "ALL";
    const now = new Date();

    const where: Prisma.CouponWhereInput = {
      isDeleted: false,
      ...(search
        ? {
            code: {
              contains: search.toUpperCase(),
              mode: "insensitive" as const,
            },
          }
        : {}),
      ...(status === "ACTIVE"
        ? { isActive: true }
        : status === "INACTIVE"
        ? { isActive: false }
        : {}),
      ...(discountType === "FLAT" || discountType === "PERCENTAGE"
        ? { discountType: discountType as CouponDiscountType }
        : {}),
      ...(scope !== "ALL"
        ? (() => {
            const mappedScope = toDbCouponScope(scope);
            return mappedScope ? { scope: mappedScope } : {};
          })()
        : {}),
      ...(stackable === "YES"
        ? { isStackable: true }
        : stackable === "NO"
        ? { isStackable: false }
        : {}),
      ...(activity === "UPCOMING"
        ? {
            validFrom: { gt: now },
          }
        : activity === "EXPIRED"
        ? {
            validTill: { not: null, lt: now },
          }
        : activity === "LIVE"
        ? {
            validFrom: { lte: now },
            OR: [{ validTill: null }, { validTill: { gte: now } }],
          }
        : {}),
    };

    const totalCount = await prisma.coupon.count({ where });
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
    const safePage = Math.min(page, totalPages);

    const coupons = await prisma.coupon.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (safePage - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        code: true,
        discountType: true,
        discountValue: true,
        maxDiscount: true,
        scope: true,
        validFrom: true,
        validTill: true,
        isStackable: true,
        stackableCouponIds: true,
        usageLimit: true,
        perUserUsageLimit: true,
        minimumAmount: true,
        locationId: true,
        isActive: true,
        isDeleted: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const couponIds = coupons.map((coupon) => coupon.id);

    const usageCounts =
      couponIds.length > 0
        ? await prisma.couponUsage.groupBy({
            by: ["couponId"],
            where: {
              couponId: { in: couponIds },
              status: "CONFIRMED",
            },
            _count: {
              _all: true,
            },
          })
        : [];

    const usageCountByCouponId = new Map(
      usageCounts.map((item) => [item.couponId, item._count._all])
    );

    const items = coupons.map((coupon) => ({
      ...coupon,
      scope: toUiCouponScope(coupon.scope),
      confirmedUsageCount: usageCountByCouponId.get(coupon.id) ?? 0,
    }));

    const [totalCoupons, activeCoupons, scheduledCoupons, expiredCoupons] =
      await Promise.all([
        prisma.coupon.count({
          where: { isDeleted: false },
        }),
        prisma.coupon.count({
          where: { isDeleted: false, isActive: true },
        }),
        prisma.coupon.count({
          where: { isDeleted: false, validFrom: { gt: now } },
        }),
        prisma.coupon.count({
          where: { isDeleted: false, validTill: { not: null, lt: now } },
        }),
      ]);

    return NextResponse.json({
      success: true,
      data: {
        items,
        totalCount,
        page: safePage,
        pageSize,
        totalPages,
        kpis: {
          total: totalCoupons,
          active: activeCoupons,
          scheduled: scheduledCoupons,
          expired: expiredCoupons,
        },
      },
    });
  } catch (error) {
    console.error("[GET_ADMIN_COUPONS]", error);
    return NextResponse.json(
      { success: false, message: "Failed to fetch coupons" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const adminId = await getAuthenticatedAdminIdFromCookies();
    if (!adminId) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const payload = normalizeCouponPayload(body);

    const coupon = await prisma.$transaction(async (tx) => {
      const existingActive = await tx.coupon.findFirst({
        where: {
          code: payload.code,
          isDeleted: false,
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

      return tx.coupon.create({
        data: {
          code: payload.code,
          discountType: payload.discountType,
          discountValue: payload.discountValue,
          maxDiscount: payload.maxDiscount,
          scope: payload.scope,
          validFrom: payload.validFrom,
          validTill: payload.validTill,
          isStackable: payload.isStackable,
          stackableCouponIds: payload.stackableCouponIds,
          usageLimit: payload.usageLimit,
          perUserUsageLimit: payload.perUserUsageLimit,
          minimumAmount: payload.minimumAmount,
          locationId: payload.locationId,
          isActive: payload.isActive,
          isDeleted: false,
          createdBy: "ADMIN",

          rules: {
            create: payload.rules.map((rule) => ({
              type: rule.type,
              operator: rule.operator,
              value: rule.value,
            })),
          },
        },
      });
    });

    return NextResponse.json({
      success: true,
      couponId: coupon.id,
    });
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

    console.error("[CREATE_COUPON]", error);
    return NextResponse.json(
      { success: false, message: "Failed to create coupon" },
      { status: 500 }
    );
  }
}
