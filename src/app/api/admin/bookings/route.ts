// src/app/api/admin/bookings/route.ts

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  derivePaymentLifecycle,
  getBookingStatusLabel,
  getPaymentStatusLabel,
} from "@/lib/booking-status";
import {
  Prisma,
  BookingStatus,
} from "@prisma/client";
import { getAuthenticatedAdminIdFromCookies } from "@/services/auth/adminAuth.server";
import { presentReportingSchedule } from "@/lib/admin/reporting-schedule-presenter";

import { ADMIN_SOFT_DELETE_REASON } from "@/lib/booking-policy";
const DEFAULT_PAGE_SIZE = 40;
const MAX_PAGE_SIZE = 200;

/**
 * GET /api/admin/bookings
 * Query:
 * - type=active|live|abandoned
 * - page, pageSize (optional; enables server pagination)
 * - search, package, timeRange (optional server filters)
 * - dateFrom, dateTo (optional event-date range on startsAtUtc: [dateFrom, dateTo))
 */
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
    const type = searchParams.get("type") ?? "active";
    const search = String(searchParams.get("search") ?? "").trim();
    const packageName = String(searchParams.get("package") ?? "").trim();
    const timeRange = String(searchParams.get("timeRange") ?? "").trim();
    const dateFromRaw = String(searchParams.get("dateFrom") ?? "").trim();
    const dateToRaw = String(searchParams.get("dateTo") ?? "").trim();

    const pageParam = Number(searchParams.get("page") ?? "");
    const pageSizeParam = Number(searchParams.get("pageSize") ?? "");
    const paginationRequested =
      Number.isInteger(pageParam) && pageParam > 0;
    const page = paginationRequested ? pageParam : 1;
    const pageSize = paginationRequested
      ? Math.min(
          Math.max(Number.isInteger(pageSizeParam) ? pageSizeParam : DEFAULT_PAGE_SIZE, 1),
          MAX_PAGE_SIZE
        )
      : 0;


    const liveBookingWhere: Prisma.BookingWhereInput = {
      bookingStatus: {
        in: [
          BookingStatus.INCOMPLETE,
          BookingStatus.AWAITING_PAYMENT,
          BookingStatus.PAYMENT_PROCESSING,
        ],
      },
    };

    // Booking requests waiting for an admin decision.
    const pendingReviewWhere: Prisma.BookingWhereInput = {
      bookingStatus: BookingStatus.PENDING_REVIEW,
    };

    // Main tab: accepted bookings (APPROVED, plus legacy CONFIRMED) and
    // paid-expired payment incidents.
    const decidedTabWhere: Prisma.BookingWhereInput = {
      bookingStatus: {
        in: [
          BookingStatus.APPROVED,
          BookingStatus.CONFIRMED,
          BookingStatus.PAID_EXPIRED,
        ],
      },
    };

    const abandonedTabWhere: Prisma.BookingWhereInput = {
      AND: [
        {
          bookingStatus: {
            notIn: [
              BookingStatus.APPROVED,
              BookingStatus.CONFIRMED,
              BookingStatus.PAID_EXPIRED,
              BookingStatus.PENDING_REVIEW,
            ],
          },
        },
        {
          NOT: liveBookingWhere,
        },
      ],
    };

    const baseWhere: Prisma.BookingWhereInput =
      type === "live"
        // LIVE bookings
        ? liveBookingWhere
        : type === "pending"
          // Pending review tab: customer submitted, admin must decide.
          ? pendingReviewWhere
          : type === "abandoned"
            // Abandonment tab: everything that is not live, decided, or pending.
            ? abandonedTabWhere
            : decidedTabWhere;

    const whereAnd: Prisma.BookingWhereInput[] = [
      baseWhere,
      {
        OR: [
          { cancelledReason: null },
          { cancelledReason: { not: ADMIN_SOFT_DELETE_REASON } },
        ],
      },
    ];

    if (search) {
      whereAnd.push({
        OR: [
          { bookingRef: { contains: search, mode: "insensitive" } },
          { contactName: { contains: search, mode: "insensitive" } },
          { contactPhone: { contains: search } },
          { venue: { name: { contains: search, mode: "insensitive" } } },
          { eventPackage: { name: { contains: search, mode: "insensitive" } } },
        ],
      });
    }

    if (packageName) {
      whereAnd.push({
        eventPackage: { name: packageName },
      });
    }

    if (timeRange) {
      const [startTime = "", endTime = ""] = timeRange
        .split(" - ")
        .map((value) => value.trim());
      if (startTime && endTime) {
        whereAnd.push({
          eventStartTime: startTime,
          eventEndTime: endTime,
        });
      }
    }

    const dateFrom = dateFromRaw ? new Date(dateFromRaw) : null;
    const dateTo = dateToRaw ? new Date(dateToRaw) : null;
    if (
      dateFrom &&
      dateTo &&
      !Number.isNaN(dateFrom.getTime()) &&
      !Number.isNaN(dateTo.getTime())
    ) {
      // Filter by the event (venue booked) date, not the booking creation date.
      whereAnd.push({
        startsAtUtc: {
          gte: dateFrom,
          lt: dateTo,
        },
      });
    }

    const where: Prisma.BookingWhereInput = {
      AND: whereAnd,
    };

    const bookingSelect = {
      id: true,
      bookingRef: true,
      contactName: true,
      contactPhone: true,
      contactEmail: true,
      guestCount: true,
      baseAmount: true,
      extrasAmount: true,
      productsAmount: true,
      decorationAmount: true,
      discountAmount: true,
      totalAmount: true,
      advancePaid: true,
      remainingPayable: true,
      paymentStatus: true,
      bookingStatus: true,
      reviewSubmittedAt: true,
      reviewedAt: true,
      rejectionReason: true,
      cancelledReason: true,
      createdAt: true,
      eventDate: true,
      eventStartTime: true,
      eventEndTime: true,
      startsAtUtc: true,
      endsAtUtc: true,
      timezone: true,
      packageSnapshot: true,
      pricingSnapshot: true,
      venue: {
        select: {
          id: true,
          name: true,
        },
      },
      eventPackage: {
        select: {
          id: true,
          name: true,
        },
      },
      // Admins must see whether the agreement is signed before approving.
      signedAgreements: {
        select: { id: true },
        take: 1,
      },
    } satisfies Prisma.BookingSelect;

    const filterOptionWhere: Prisma.BookingWhereInput = {
      AND: [
        baseWhere,
        {
          OR: [
            { cancelledReason: null },
            { cancelledReason: { not: ADMIN_SOFT_DELETE_REASON } },
          ],
        },
      ],
    };

    // Filter dropdown options are derived from the unfiltered base set, so they
    // never change between pages. Only compute them on the first page (or when
    // pagination is off) to avoid re-scanning on every page change / search.
    const includeFilterOptions = !paginationRequested || page === 1;

    const [total, bookings] = await prisma.$transaction([
      prisma.booking.count({ where }),
      prisma.booking.findMany({
        where,
        orderBy: { createdAt: "desc" },
        ...(paginationRequested
          ? { skip: (page - 1) * pageSize, take: pageSize }
          : {}),
        select: bookingSelect,
      }),
    ]);

    let packageOptions: string[] = [];
    let timeRangeOptions: string[] = [];
    if (includeFilterOptions) {
      const [packageRows, timeRangeRows] = await prisma.$transaction([
        prisma.eventPackage.findMany({
          where: { isActive: true, venue: { isActive: true } },
          select: { name: true },
          orderBy: { sortOrder: "asc" },
        }),
        // groupBy returns only distinct time-range combos (DB-deduped) instead
        // of every matching booking row.
        prisma.booking.groupBy({
          by: ["eventStartTime", "eventEndTime"],
          where: filterOptionWhere,
          orderBy: [{ eventStartTime: "asc" }, { eventEndTime: "asc" }],
        }),
      ]);

      packageOptions = Array.from(
        new Set(packageRows.map((row) => row.name.trim()).filter(Boolean))
      );
      timeRangeOptions = Array.from(
        new Set(
          timeRangeRows
            .map((row) =>
              row.eventStartTime && row.eventEndTime
                ? `${row.eventStartTime} - ${row.eventEndTime}`
                : ""
            )
            .filter(Boolean)
        )
      );
    }

    const data = bookings.map((b, index) => {
      const packageSnapshot =
        b.packageSnapshot &&
        typeof b.packageSnapshot === "object" &&
        !Array.isArray(b.packageSnapshot)
          ? b.packageSnapshot
          : null;
      const snapshotPackageName =
        packageSnapshot && typeof packageSnapshot.name === "string"
          ? packageSnapshot.name
          : null;
      const pricingSnap =
        b.pricingSnapshot &&
        typeof b.pricingSnapshot === "object" &&
        !Array.isArray(b.pricingSnapshot)
          ? (b.pricingSnapshot as Record<string, unknown>)
          : null;
      const rangePackageAmount = pricingSnap ? Math.max(0, Number(pricingSnap.packageAmount ?? 0)) : 0;
      const rangeExtraDurationAmount = pricingSnap ? Math.max(0, Number(pricingSnap.extraDurationAmount ?? 0)) : 0;
      const effectivePackageAmount = rangePackageAmount > 0 ? rangePackageAmount : null;
      const effectiveExtraDurationAmount = rangeExtraDurationAmount > 0 ? rangeExtraDurationAmount : null;
      const schedule = presentReportingSchedule({
        eventDate: b.eventDate,
        eventStartTime: b.eventStartTime,
        eventEndTime: b.eventEndTime,
        startsAtUtc: b.startsAtUtc,
        endsAtUtc: b.endsAtUtc,
        timezone: b.timezone,
      });
      return {
        srNo: index + 1,

        id: b.id,
        bookingRef: b.bookingRef,

        customer: {
          name: b.contactName,
          phone: b.contactPhone,
          email: b.contactEmail ?? null,
        },

        theatre: {
          id: b.venue?.id ?? "",
          name: b.venue?.name ?? (b.packageSnapshot as { name?: string } | null)?.name ?? "Haven Retreat",
          timezone: 'America/New_York' as string | null,
          locationName: 'Miami' as string | null,
        },
        package: {
          id: b.eventPackage?.id ?? null,
          name:
            b.eventPackage?.name ??
            snapshotPackageName ??
            "Package unavailable",
        },
        eventDate: b.eventDate?.toISOString().slice(0, 10) ?? null,
        eventStartTime: b.eventStartTime,
        eventEndTime: b.eventEndTime,
        startsAtUtc: b.startsAtUtc?.toISOString() ?? null,
        endsAtUtc: b.endsAtUtc?.toISOString() ?? null,
        timezone: b.timezone,
        schedule,

        slot: {
          date: schedule.date,
          startTime: schedule.startTime,
          endTime: schedule.endTime,
          status: b.bookingStatus,
        },

        guestCount: b.guestCount,

        pricing: {
          base: b.baseAmount,
          extras: b.extrasAmount,
          products: b.productsAmount,
          decoration: b.decorationAmount,
          discount: b.discountAmount,
          total: b.totalAmount,
          advancePaid: b.advancePaid,
          remainingPayable: b.remainingPayable,
          packageAmount: effectivePackageAmount,
          extraDurationAmount: effectiveExtraDurationAmount,
        },

        paymentStatus: b.paymentStatus,
        bookingStatus: b.bookingStatus,
        bookingStatusLabel: getBookingStatusLabel(b.bookingStatus),
        // Payment is reported independently of approval.
        paymentLifecycle: derivePaymentLifecycle({
          paymentStatus: b.paymentStatus,
          advancePaid: b.advancePaid,
          remainingPayable: b.remainingPayable,
        }),
        paymentStatusLabel: getPaymentStatusLabel({
          paymentStatus: b.paymentStatus,
          advancePaid: b.advancePaid,
          remainingPayable: b.remainingPayable,
        }),
        reviewSubmittedAt: b.reviewSubmittedAt?.toISOString() ?? null,
        reviewedAt: b.reviewedAt?.toISOString() ?? null,
        rejectionReason: b.rejectionReason,
        agreementSigned: Boolean(b.signedAgreements?.length),
        cancelledReason: b.cancelledReason,
        createdAt: b.createdAt.toISOString(),
      };
    });

    return NextResponse.json({
      success: true,
      data,
      meta: {
        pagination: {
          enabled: paginationRequested,
          page,
          pageSize: paginationRequested ? pageSize : data.length,
          total,
          totalPages: paginationRequested ? Math.max(Math.ceil(total / pageSize), 1) : 1,
          hasPrev: paginationRequested ? page > 1 : false,
          hasNext: paginationRequested
            ? page < Math.max(Math.ceil(total / pageSize), 1)
            : false,
        },
        ...(includeFilterOptions
          ? {
              filterOptions: {
                packages: packageOptions,
                timeRanges: timeRangeOptions,
              },
            }
          : {}),
      },
    });
  } catch (error) {
    console.error("ADMIN_BOOKINGS_ERROR", error);
    return NextResponse.json(
      { success: false, message: "Failed to fetch bookings" },
      { status: 500 }
    );
  }
}
