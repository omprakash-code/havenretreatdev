// INACTIVE — SlotTemplate / Slot admin is not used in the active admin panel.
// Set FEATURE_DISABLED to false to re-enable.
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";

const FEATURE_DISABLED = true;
function featureDisabled() {
  return NextResponse.json({ success: false, code: "FEATURE_DISABLED" }, { status: 404 });
}
import { formatInTimeZone } from "date-fns-tz";
import { getAuthenticatedAdminIdFromCookies } from "@/services/auth/adminAuth.server";
import { timeToMinutes } from "@/lib/time";
import {
  ADMIN_SOFT_DELETE_REASON,
  DEFAULT_SLOT_BUFFER_MINUTES,
  IST_TIMEZONE,
  MANUAL_SLOT_REASON_MARKER,
  calculateDuration,
  findSlotTimingConflict,
  isManualSlotReason,
  isValidTimeInput,
  parseISTDateInput,
} from "./_shared";

const createSlotRequestSchema = z.object({
  theatreId: z.string().trim().min(1),
  date: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/),
  timing: z.object({
    startTime: z.string().trim(),
    endTime: z.string().trim(),
  }),
  pricing: z.object({
    regularPrice: z.coerce.number().finite(),
    salePrice: z.preprocess(
      (value) => (value === "" || value == null ? null : value),
      z.coerce.number().finite().nullable()
    ),
  }),
  status: z
    .object({
      value: z.enum(["AVAILABLE", "DISABLED"]).default("AVAILABLE"),
      discountText: z.string().nullable().optional(),
    })
    .optional(),
});

class SlotApiError extends Error {
  status: number;
  body: Record<string, unknown>;

  constructor(status: number, body: Record<string, unknown>) {
    super(String(body.message ?? "Slot request failed"));
    this.status = status;
    this.body = body;
  }
}

/**
 * GET /api/admin/slots
 * Returns all slots with theatre + template data for admin panel
 */
export async function GET(req: Request) {
  if (FEATURE_DISABLED) return featureDisabled();
  try {
    const adminId = await getAuthenticatedAdminIdFromCookies();
    if (!adminId) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const fromDateInput = searchParams.get("fromDate")?.trim() || null;
    const toDateInput = searchParams.get("toDate")?.trim() || null;

    const fromDate = fromDateInput ? parseISTDateInput(fromDateInput) : null;
    if (fromDateInput && !fromDate) {
      return NextResponse.json(
        {
          success: false,
          code: "INVALID_FROM_DATE",
          message: "fromDate must be in YYYY-MM-DD format",
        },
        { status: 400 }
      );
    }

    const toDate = toDateInput ? parseISTDateInput(toDateInput) : null;
    if (toDateInput && !toDate) {
      return NextResponse.json(
        {
          success: false,
          code: "INVALID_TO_DATE",
          message: "toDate must be in YYYY-MM-DD format",
        },
        { status: 400 }
      );
    }

    if (fromDate && toDate && fromDate > toDate) {
      return NextResponse.json(
        {
          success: false,
          code: "INVALID_DATE_RANGE",
          message: "fromDate cannot be later than toDate",
        },
        { status: 400 }
      );
    }

    const where: Prisma.SlotWhereInput = {
      ...(fromDate || toDate
        ? {
            date: {
              ...(fromDate ? { gte: fromDate } : {}),
              ...(toDate ? { lte: toDate } : {}),
            },
          }
        : {}),
    };

    const slots = await prisma.slot.findMany({
      where,
      orderBy: [
        { date: "asc" },
        { theatreId: "asc" },
        { startTime: "asc" },
      ],
      include: {
        theatre: {
          select: {
            id: true,
            name: true,
          },
        },
        template: {
          select: {
            id: true,
            startTime: true,
            endTime: true,
            durationMin: true,
            regularPrice: true,
            salePrice: true,
            isCustomTemplate: true,
          },
        },
        bookings: {
          where: {
            bookingStatus: "CONFIRMED",
            OR: [
              { cancelledReason: null },
              { cancelledReason: { not: ADMIN_SOFT_DELETE_REASON } },
            ],
          },
          select: {
            id: true,
            bookingRef: true,
            bookingStatus: true,
          },
        },
        _count: {
          select: {
            bookings: true,
          },
        },

      },
    });

    const data = slots.map((s) => {
      const activeConfirmedBookingCount = s.bookings.length;
      const bookingHistoryCount = s._count.bookings;
      const isCustomSlot = isManualSlotReason(s.overrideReason);
      const isLocked = s.status === "LOCKED";
      const isBooked = s.status === "BOOKED";
      const canDelete =
        isCustomSlot &&
        bookingHistoryCount === 0 &&
        !isLocked &&
        !isBooked;
      const deleteDisabledReason = canDelete
        ? null
        : !isCustomSlot
          ? "Only custom slots can be deleted."
          : bookingHistoryCount > 0
            ? "This slot has booking history and cannot be deleted."
            : isLocked
              ? "Locked slot cannot be deleted."
              : "Booked slot cannot be deleted.";

      return {
      id: s.id,

      date: formatInTimeZone(s.date, IST_TIMEZONE, "yyyy-MM-dd"), // YYYY-MM-DD in IST
      startTime: s.startTime,
      endTime: s.endTime,
      durationMin: s.durationMin,

      theatre: {
        id: s.theatre.id,
        name: s.theatre.name,
      },

      template: {
        id: s.template.id,
        startTime: s.template.startTime,
        endTime: s.template.endTime,
        durationMin: s.template.durationMin,
        regularPrice: s.template.regularPrice,
        salePrice: s.template.salePrice,
        isCustomTemplate: s.template.isCustomTemplate,
      },

      pricing: {
        regular: s.regularPrice,
        sale: s.salePrice,
        final: s.finalPrice,
        discountText: s.discountText,
        isSpecial: s.isSpecial,
      },

      status: s.status,

      bookingCount: activeConfirmedBookingCount,

      bookings: s.bookings.map((b) => ({
        id: b.id,
        bookingRef: b.bookingRef,
        bookingStatus: b.bookingStatus,
      })),

      isOverridden: s.isOverridden,
      isCustomSlot,
      canDelete,
      deleteDisabledReason,
      overrideReason: s.overrideReason,
      slotModifiedAt: s.slotModifiedAt?.toISOString() ?? null,
      slotModifiedBy: s.slotModifiedBy ?? null,

      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
      };
    });

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("ADMIN_SLOTS_ERROR", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to fetch slots",
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/slots
 * Creates a manual slot for a theatre/date with overlap + buffer checks.
 */
export async function POST(req: Request) {
  if (FEATURE_DISABLED) return featureDisabled();
  try {
    const adminId = await getAuthenticatedAdminIdFromCookies();
    if (!adminId) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const payloadResult = createSlotRequestSchema.safeParse(await req.json());
    if (!payloadResult.success) {
      return NextResponse.json(
        {
          success: false,
          code: "INVALID_REQUEST",
          message: "Invalid create slot payload",
          errors: payloadResult.error.flatten(),
        },
        { status: 400 }
      );
    }

    const body = payloadResult.data;
    const theatreId = body.theatreId.trim();
    const dateInput = body.date.trim();
    const startTime = body.timing.startTime.trim();
    const endTime = body.timing.endTime.trim();
    const regularPrice = body.pricing.regularPrice;
    const salePrice = body.pricing.salePrice;
    const statusValue = body.status?.value ?? "AVAILABLE";
    const discountTextRaw = body.status?.discountText;
    const discountText =
      typeof discountTextRaw === "string" ? discountTextRaw.trim() || null : null;

    if (!isValidTimeInput(startTime) || !isValidTimeInput(endTime)) {
      return NextResponse.json(
        {
          success: false,
          code: "INVALID_TIME_FORMAT",
          message: "Time must be in HH:mm format",
        },
        { status: 400 }
      );
    }

    const slotDate = parseISTDateInput(dateInput);
    if (!slotDate) {
      return NextResponse.json(
        {
          success: false,
          code: "INVALID_DATE",
          message: "Date must be in YYYY-MM-DD format",
        },
        { status: 400 }
      );
    }

    const todayKey = formatInTimeZone(new Date(), IST_TIMEZONE, "yyyy-MM-dd");
    if (dateInput < todayKey) {
      return NextResponse.json(
        {
          success: false,
          code: "PAST_DATE",
          message: "Cannot create slots for past dates",
        },
        { status: 409 }
      );
    }

    const duration = calculateDuration(startTime, endTime);
    if (duration < DEFAULT_SLOT_BUFFER_MINUTES) {
      return NextResponse.json(
        {
          success: false,
          code: "INVALID_DURATION",
          message: "Slot duration must be at least 30 minutes",
        },
        { status: 400 }
      );
    }

    if (
      timeToMinutes(endTime) < timeToMinutes(startTime) &&
      duration > 12 * 60
    ) {
      return NextResponse.json(
        {
          success: false,
          code: "INVALID_TIME_RANGE",
          message: "End time must be after start time for same-day slots",
        },
        { status: 400 }
      );
    }

    if (!Number.isFinite(regularPrice) || regularPrice <= 0) {
      return NextResponse.json(
        {
          success: false,
          code: "INVALID_REGULAR_PRICE",
          message: "Regular price must be greater than zero",
        },
        { status: 400 }
      );
    }

    if (salePrice != null && (!Number.isFinite(salePrice) || salePrice <= 0)) {
      return NextResponse.json(
        {
          success: false,
          code: "INVALID_SALE_PRICE",
          message: "Sale price must be greater than zero",
        },
        { status: 400 }
      );
    }

    if (salePrice != null && salePrice >= regularPrice) {
      return NextResponse.json(
        {
          success: false,
          code: "INVALID_SALE_PRICE",
          message: "Sale price must be less than regular price",
        },
        { status: 400 }
      );
    }

    if (statusValue !== "AVAILABLE" && statusValue !== "DISABLED") {
      return NextResponse.json(
        {
          success: false,
          code: "INVALID_STATUS",
          message: "Status must be AVAILABLE or DISABLED",
        },
        { status: 400 }
      );
    }

    const finalPrice = salePrice ?? regularPrice;
    const createdSlot = await prisma.$transaction(async (tx) => {
      const theatre = await tx.theatre.findUnique({
        where: { id: theatreId },
        select: {
          id: true,
          baseGuests: true,
        },
      });

      if (!theatre) {
        throw new SlotApiError(404, { success: false, message: "Theatre not found" });
      }

      const exactDuplicate = await tx.slot.findFirst({
        where: {
          theatreId,
          date: slotDate,
          startTime,
          endTime,
        },
        select: { id: true },
      });

      if (exactDuplicate) {
        throw new SlotApiError(409, {
          success: false,
          code: "SLOT_EXISTS",
          message: "A slot with this theatre/date/time already exists",
        });
      }

      const overlapConflict = await findSlotTimingConflict({
        theatreId,
        slotDate,
        startTime,
        endTime,
        dbClient: tx,
      });

      if (overlapConflict) {
        throw new SlotApiError(409, {
          success: false,
          code: "SLOT_OVERLAP",
          message: "Slot timing overlaps with an existing slot",
          details: {
            conflictingSlot: overlapConflict.conflictingSlot,
            attemptedSlot: {
              date: dateInput,
              startTime,
              endTime,
            },
            reason: overlapConflict.reason,
          },
        });
      }

      let slotTemplate = await tx.slotTemplate.findFirst({
        where: {
          theatreId,
          startTime,
          endTime,
        },
        select: {
          id: true,
          decorationMandatory: true,
          isCustomTemplate: true,
        },
        orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
      });

      if (!slotTemplate) {
        try {
          slotTemplate = await tx.slotTemplate.create({
            data: {
              theatreId,
              startTime,
              endTime,
              durationMin: duration,
              bufferMin: DEFAULT_SLOT_BUFFER_MINUTES,
              regularPrice,
              salePrice,
              decorationMandatory: false,
              isActive: false,
              isCustomTemplate: true,
            },
            select: {
              id: true,
              decorationMandatory: true,
              isCustomTemplate: true,
            },
          });
        } catch (error) {
          if (
            error instanceof Prisma.PrismaClientKnownRequestError &&
            error.code === "P2002"
          ) {
            slotTemplate = await tx.slotTemplate.findFirst({
              where: {
                theatreId,
                startTime,
                endTime,
              },
              select: {
                id: true,
                decorationMandatory: true,
                isCustomTemplate: true,
              },
              orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
            });
          } else {
            throw error;
          }
        }
      }

      if (!slotTemplate) {
        throw new SlotApiError(500, {
          success: false,
          message: "Failed to resolve slot template for requested time",
        });
      }

      try {
        return await tx.slot.create({
          data: {
            theatreId,
            slotTemplateId: slotTemplate.id,
            date: slotDate,
            startTime,
            endTime,
            durationMin: duration,
            basePrice: finalPrice,
            baseGuests: theatre.baseGuests,
            regularPrice,
            salePrice,
            finalPrice,
            isSpecial: salePrice != null,
            discountText,
            decorationMandatory: slotTemplate.decorationMandatory,
            status: statusValue,
            overrideReason: MANUAL_SLOT_REASON_MARKER,
          },
          include: {
            theatre: {
              select: {
                id: true,
                name: true,
              },
            },
            template: {
              select: {
                id: true,
                startTime: true,
                endTime: true,
                durationMin: true,
                regularPrice: true,
                salePrice: true,
                isCustomTemplate: true,
              },
            },
            bookings: {
              where: {
                bookingStatus: "CONFIRMED",
                OR: [
                  { cancelledReason: null },
                  { cancelledReason: { not: ADMIN_SOFT_DELETE_REASON } },
                ],
              },
              select: {
                id: true,
                bookingRef: true,
                bookingStatus: true,
              },
            },
          },
        });
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002"
        ) {
          throw new SlotApiError(409, {
            success: false,
            code: "SLOT_EXISTS",
            message: "A slot with this theatre/date/time already exists",
          });
        }
        throw error;
      }
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          id: createdSlot.id,
          date: formatInTimeZone(createdSlot.date, IST_TIMEZONE, "yyyy-MM-dd"),
          startTime: createdSlot.startTime,
          endTime: createdSlot.endTime,
          durationMin: createdSlot.durationMin,
          theatre: {
            id: createdSlot.theatre.id,
            name: createdSlot.theatre.name,
          },
          template: {
            id: createdSlot.template.id,
            startTime: createdSlot.template.startTime,
            endTime: createdSlot.template.endTime,
            durationMin: createdSlot.template.durationMin,
            regularPrice: createdSlot.template.regularPrice,
            salePrice: createdSlot.template.salePrice,
            isCustomTemplate: createdSlot.template.isCustomTemplate,
          },
          pricing: {
            regular: createdSlot.regularPrice,
            sale: createdSlot.salePrice,
            final: createdSlot.finalPrice,
            discountText: createdSlot.discountText,
            isSpecial: createdSlot.isSpecial,
          },
          status: createdSlot.status,
          bookingCount: createdSlot.bookings.length,
          bookings: createdSlot.bookings,
          isOverridden: createdSlot.isOverridden,
          isCustomSlot: true,
          canDelete: true,
          deleteDisabledReason: null,
          overrideReason: createdSlot.overrideReason,
          slotModifiedAt: createdSlot.slotModifiedAt?.toISOString() ?? null,
          slotModifiedBy: createdSlot.slotModifiedBy ?? null,
          createdAt: createdSlot.createdAt.toISOString(),
          updatedAt: createdSlot.updatedAt.toISOString(),
        },
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof SlotApiError) {
      return NextResponse.json(error.body, { status: error.status });
    }

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        {
          success: false,
          code: "SLOT_EXISTS",
          message: "A slot with this theatre/date/time already exists",
        },
        { status: 409 }
      );
    }

    console.error("ADMIN_SLOT_CREATE_ERROR", error);
    return NextResponse.json(
      { success: false, message: "Failed to create slot" },
      { status: 500 }
    );
  }
}
