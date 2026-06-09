// src/app/api/admin/bookings/route.ts

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  Prisma,
  BookingStatus,
} from "@prisma/client";
import { getAuthenticatedAdminIdFromCookies } from "@/services/auth/adminAuth.server";
import { presentReportingSchedule } from "@/lib/admin/reporting-schedule-presenter";

const ADMIN_SOFT_DELETE_REASON = "ADMIN_SOFT_DELETED";
const DEFAULT_PAGE_SIZE = 40;
const MAX_PAGE_SIZE = 200;

/**
 * GET /api/admin/bookings
 * Query:
 * - type=active|live|abandoned
 * - page, pageSize (optional; enables server pagination)
 * - search, theatre, slot (optional server filters)
 * - dateFrom, dateTo (optional createdAt range: [dateFrom, dateTo))
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
    const theatre = String(searchParams.get("theatre") ?? "").trim();
    const slot = String(searchParams.get("slot") ?? "").trim();
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


    const now = new Date();

    const liveBookingWhere: Prisma.BookingWhereInput = {
      AND: [
        {
          bookingStatus: {
            in: [
              BookingStatus.INCOMPLETE,
              BookingStatus.AWAITING_PAYMENT,
              BookingStatus.PAYMENT_PROCESSING,
            ],
          },
        },
        {
          OR: [
            {
              slot: {
                status: "LOCKED",
                lockExpiresAt: {
                  gt: now,
                },
              },
            },
            {
              bookingLocks: {
                some: {
                  status: "ACTIVE",
                  expiresAt: {
                    gt: now,
                  },
                },
              },
            },
          ],
        },
      ],
    };

    const abandonedTabWhere: Prisma.BookingWhereInput = {
      AND: [
        {
          bookingStatus: {
            notIn: [BookingStatus.CONFIRMED, BookingStatus.PAID_EXPIRED],
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
        : type === "abandoned"
          // Abandonment tab: show everything except confirmed and live.
          ? abandonedTabWhere
          : {
              // Main bookings tab: confirmed bookings and paid-expired payment incidents.
              bookingStatus: {
                in: [BookingStatus.CONFIRMED, BookingStatus.PAID_EXPIRED],
              },
            };

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
          { theatre: { name: { contains: search, mode: "insensitive" } } },
          { venue: { name: { contains: search, mode: "insensitive" } } },
        ],
      });
    }

    if (theatre) {
      whereAnd.push({
        OR: [{ theatre: { name: theatre } }, { venue: { name: theatre } }],
      });
    }

    if (slot) {
      const [startTime = "", endTime = ""] = slot.split(" - ").map((value) => value.trim());
      if (startTime && endTime) {
        whereAnd.push({
          OR: [
            {
              eventStartTime: startTime,
              eventEndTime: endTime,
            },
            {
              slot: {
                startTime,
                endTime,
              },
            },
          ],
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
      whereAnd.push({
        createdAt: {
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
      theatre: {
        select: {
          id: true,
          name: true,
          timezone: true,
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
        },
      },
      eventPackage: {
        select: {
          id: true,
          name: true,
        },
      },
      slot: {
        select: {
          date: true,
          startTime: true,
          endTime: true,
          status: true,
          basePrice: true,
          finalPrice: true,
        },
      },
      bookingLocks: {
        where: {
          status: "ACTIVE",
          expiresAt: {
            gt: now,
          },
        },
        orderBy: { version: "desc" },
        take: 1,
        select: {
          status: true,
          version: true,
          expiresAt: true,
        },
      },
    } satisfies Prisma.BookingSelect;

    const [total, bookings] = paginationRequested
      ? await prisma.$transaction([
          prisma.booking.count({ where }),
          prisma.booking.findMany({
            where,
            orderBy: { createdAt: "desc" },
            skip: (page - 1) * pageSize,
            take: pageSize,
            select: bookingSelect,
          }),
        ])
      : await prisma.$transaction([
          prisma.booking.count({ where }),
          prisma.booking.findMany({
            where,
            orderBy: { createdAt: "desc" },
            select: bookingSelect,
          }),
        ]);

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
      const isRangeBooking = b.slot === null;
      const pricingSnap =
        isRangeBooking &&
        b.pricingSnapshot &&
        typeof b.pricingSnapshot === "object" &&
        !Array.isArray(b.pricingSnapshot)
          ? (b.pricingSnapshot as Record<string, unknown>)
          : null;
      const rangePackageAmount = pricingSnap ? Math.max(0, Number(pricingSnap.packageAmount ?? 0)) : 0;
      const rangeExtraDurationAmount = pricingSnap ? Math.max(0, Number(pricingSnap.extraDurationAmount ?? 0)) : 0;
      // For legacy slot bookings: derive extra hours from slot price vs baseAmount
      const legacySlotPrice = !isRangeBooking
        ? (b.slot?.finalPrice ?? b.slot?.basePrice ?? null)
        : null;
      const legacyExtraHoursAmount =
        legacySlotPrice !== null
          ? Math.max(0, b.baseAmount - legacySlotPrice)
          : 0;
      const effectivePackageAmount = rangePackageAmount > 0
        ? rangePackageAmount
        : legacySlotPrice ?? null;
      const effectiveExtraDurationAmount = rangeExtraDurationAmount > 0
        ? rangeExtraDurationAmount
        : legacyExtraHoursAmount > 0
        ? legacyExtraHoursAmount
        : null;
      const schedule = presentReportingSchedule({
        eventDate: b.eventDate,
        eventStartTime: b.eventStartTime,
        eventEndTime: b.eventEndTime,
        startsAtUtc: b.startsAtUtc,
        endsAtUtc: b.endsAtUtc,
        timezone: b.timezone,
        theatreTimezone: b.theatre?.timezone,
        slot: b.slot,
      });
      const activeRangeLock = b.bookingLocks?.[0] ?? null;
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
          id: b.theatre?.id ?? b.venue?.id ?? "",
          name: b.theatre?.name ?? b.venue?.name ?? "Haven Retreat",
          timezone: b.theatre?.timezone ?? null,
          locationName: b.theatre?.location?.name ?? b.venue?.name ?? null,
        },
        package: {
          id: b.eventPackage?.id ?? null,
          name:
            b.eventPackage?.name ??
            snapshotPackageName ??
            b.theatre?.name ??
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
          status: b.slot?.status ?? activeRangeLock?.status ?? b.bookingStatus,
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
