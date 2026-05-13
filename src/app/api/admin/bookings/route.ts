// src/app/api/admin/bookings/route.ts

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { formatInTimeZone } from "date-fns-tz";
import {
  Prisma,
  BookingStatus,
} from "@prisma/client";
import { getAuthenticatedAdminIdFromCookies } from "@/services/auth/adminAuth.server";

const IST_TIMEZONE = "Asia/Kolkata";
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
          slot: {
            status: "LOCKED",
            lockExpiresAt: {
              gt: now,
            },
          },
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
          slot: {
            startTime,
            endTime,
          },
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
      theatre: {
        select: {
          id: true,
          name: true,
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
      slot: {
        select: {
          date: true,
          startTime: true,
          endTime: true,
          status: true,
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
      const scheduleDate = b.slot?.date ?? b.eventDate;
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
          locationName: b.theatre?.location?.name ?? b.venue?.name ?? null,
        },

        slot: {
          date: scheduleDate
            ? formatInTimeZone(scheduleDate, IST_TIMEZONE, "yyyy-MM-dd")
            : "",
          startTime: b.slot?.startTime ?? b.eventStartTime ?? "",
          endTime: b.slot?.endTime ?? b.eventEndTime ?? "",
          status: b.slot?.status ?? b.bookingStatus,
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
