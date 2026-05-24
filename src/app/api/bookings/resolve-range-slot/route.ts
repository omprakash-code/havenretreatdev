import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { Prisma } from "@prisma/client";
import { toDate } from "date-fns-tz";
import { prisma } from "@/lib/db";
import { parseTimeValue } from "@/lib/booking-time-range";
import { verifyBookingSessionToken } from "@/services/booking/bookingSession.server";

const IST_TIMEZONE = "Asia/Kolkata";
const DYNAMIC_RANGE_SLOT_REASON = "DYNAMIC_RANGE_SLOT_CREATED";

const ACTIVE_BLOCKING_STATUSES = [
  "INCOMPLETE",
  "AWAITING_PAYMENT",
  "PAYMENT_PROCESSING",
  "CONFIRMED",
] as const;

function errorResponse(status: number, code: string, message: string) {
  return NextResponse.json(
    { success: false, code, message },
    { status }
  );
}

function isValidDateKey(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const theatreId = typeof body?.theatreId === "string" ? body.theatreId : "";
    const date = body?.date;
    const startTime = typeof body?.startTime === "string" ? body.startTime : "";
    const endTime = typeof body?.endTime === "string" ? body.endTime : "";

    const startMinutes = parseTimeValue(startTime);
    const endMinutes = parseTimeValue(endTime);

    if (!theatreId || !isValidDateKey(date) || startMinutes === null || endMinutes === null) {
      return errorResponse(400, "INVALID_REQUEST", "Missing package, date, or time range.");
    }

    if (endMinutes <= startMinutes) {
      return errorResponse(400, "INVALID_TIME_RANGE", "End time must be after start time.");
    }

    const cookieStore = await cookies();
    const guestToken = cookieStore.get("ds_lock_owner")?.value ?? null;
    const bookingSessionToken = cookieStore.get("ds_booking_session")?.value ?? null;
    const sessionPayload = bookingSessionToken
      ? verifyBookingSessionToken(bookingSessionToken)
      : null;
    const currentBookingId =
      guestToken && sessionPayload?.lockOwner === guestToken
        ? sessionPayload.bookingId
        : null;

    const slotDate = toDate(`${date}T00:00:00+05:30`, {
      timeZone: IST_TIMEZONE,
    });
    const durationMin = endMinutes - startMinutes;

    const slot = await prisma.$transaction(async (tx) => {
      const exactSlot = await tx.slot.findFirst({
        where: {
          theatreId,
          date: slotDate,
          startTime,
          endTime,
        },
      });

      if (exactSlot) return exactSlot;

      const conflictingBooking = await tx.booking.findFirst({
        where: {
          theatreId,
          bookingStatus: { in: [...ACTIVE_BLOCKING_STATUSES] },
          ...(currentBookingId ? { id: { not: currentBookingId } } : {}),
          slot: {
            date: slotDate,
            startTime: { lt: endTime },
            endTime: { gt: startTime },
            ...(guestToken
              ? {
                  OR: [
                    { lockedBy: null },
                    { lockedBy: { not: guestToken } },
                  ],
                }
              : {}),
          },
        },
        select: { id: true },
      });

      if (conflictingBooking) {
        throw new Error("RANGE_ALREADY_RESERVED");
      }

      const theatre = await tx.theatre.findUnique({
        where: { id: theatreId },
        select: {
          id: true,
          baseGuests: true,
          slotTemplates: {
            where: { isActive: true },
            orderBy: { startTime: "asc" },
            take: 1,
            select: {
              regularPrice: true,
              salePrice: true,
              decorationMandatory: true,
            },
          },
        },
      });

      if (!theatre) throw new Error("THEATRE_NOT_FOUND");

      const baseTemplate = theatre.slotTemplates[0];
      if (!baseTemplate) throw new Error("PACKAGE_PRICING_NOT_CONFIGURED");

      const regularPrice = baseTemplate.regularPrice;
      const salePrice = baseTemplate.salePrice;
      const finalPrice = salePrice ?? regularPrice;

      let template = await tx.slotTemplate.findFirst({
        where: { theatreId, startTime, endTime },
        orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
        select: { id: true, decorationMandatory: true },
      });

      if (!template) {
        try {
          template = await tx.slotTemplate.create({
            data: {
              theatreId,
              startTime,
              endTime,
              durationMin,
              bufferMin: 0,
              regularPrice,
              salePrice,
              decorationMandatory: baseTemplate.decorationMandatory,
              isActive: false,
              isCustomTemplate: true,
            },
            select: { id: true, decorationMandatory: true },
          });
        } catch (error) {
          if (
            error instanceof Prisma.PrismaClientKnownRequestError &&
            error.code === "P2002"
          ) {
            template = await tx.slotTemplate.findFirst({
              where: { theatreId, startTime, endTime },
              orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
              select: { id: true, decorationMandatory: true },
            });
          } else {
            throw error;
          }
        }
      }

      if (!template) throw new Error("SLOT_TEMPLATE_NOT_RESOLVED");

      try {
        return await tx.slot.create({
          data: {
            theatreId,
            slotTemplateId: template.id,
            date: slotDate,
            startTime,
            endTime,
            durationMin,
            basePrice: finalPrice,
            baseGuests: theatre.baseGuests,
            regularPrice,
            salePrice,
            finalPrice,
            isSpecial: salePrice != null,
            discountText: null,
            decorationMandatory: template.decorationMandatory,
            status: "AVAILABLE",
            overrideReason: DYNAMIC_RANGE_SLOT_REASON,
          },
        });
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002"
        ) {
          const resolvedSlot = await tx.slot.findFirst({
            where: {
              theatreId,
              date: slotDate,
              startTime,
              endTime,
            },
          });
          if (resolvedSlot) return resolvedSlot;
        }

        throw error;
      }
    });

    return NextResponse.json({
      success: true,
      data: {
        slot: {
          id: slot.id,
          startTime: slot.startTime,
          endTime: slot.endTime,
          basePrice: slot.basePrice,
          finalPrice: slot.finalPrice,
          decorationMandatory: slot.decorationMandatory,
          status: slot.status,
        },
      },
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "RANGE_ALREADY_RESERVED") {
        return errorResponse(
          409,
          "RANGE_ALREADY_RESERVED",
          "This time range is currently reserved. Choose another time range."
        );
      }

      if (error.message === "THEATRE_NOT_FOUND") {
        return errorResponse(404, "THEATRE_NOT_FOUND", "Package not found.");
      }

      if (error.message === "PACKAGE_PRICING_NOT_CONFIGURED") {
        return errorResponse(
          409,
          "PACKAGE_PRICING_NOT_CONFIGURED",
          "Package pricing is not configured yet."
        );
      }
    }

    console.error("RESOLVE_RANGE_SLOT_ERROR", error);
    return errorResponse(500, "RANGE_SLOT_FAILED", "Unable to reserve this time range.");
  }
}
