// INACTIVE — SlotTemplate / Slot admin is not used in the active admin panel.
// Set FEATURE_DISABLED to false to re-enable.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";

const FEATURE_DISABLED = true;
function featureDisabled() {
  return NextResponse.json({ success: false, code: "FEATURE_DISABLED" }, { status: 404 });
}
import { timeToMinutes, addMinutesToTime } from "@/lib/time";
import { isSlotExpiredInIST, type SlotExpiryConfig } from "@/lib/slot-time";
import type { Slot, SlotTemplate, Theatre, Booking, SlotStatus } from "@prisma/client";
import { resolveSlotExpiryConfig } from "@/services/booking/slot-expiry-config.service";
import { getAuthenticatedAdminIdFromCookies } from "@/services/auth/adminAuth.server";
import { formatInTimeZone } from "date-fns-tz";
import {
  ADMIN_SOFT_DELETE_REASON,
  IST_TIMEZONE,
  MANUAL_SLOT_REASON_MARKER,
  calculateDuration,
  findSlotTimingConflict,
  isManualSlotReason,
  isValidTimeInput,
} from "../_shared";

type SlotWithRelations = Slot & {
  theatre: Theatre;
  template: SlotTemplate | null;
  bookings?: Booking[];
  _count?: {
    bookings: number;
  };
};

const patchSlotPayloadSchema = z
  .object({
    timing: z
      .object({
        startTime: z.string().trim(),
        endTime: z.string().trim(),
      })
      .optional(),
    pricing: z
      .object({
        regularPrice: z.coerce.number().finite(),
        salePrice: z.preprocess(
          (value) => (value === "" || value == null ? null : value),
          z.coerce.number().finite().nullable()
        ),
      })
      .optional(),
    status: z
      .object({
        value: z.enum(["AVAILABLE", "DISABLED"]),
        discountText: z.string().nullable().optional(),
      })
      .optional(),
    overrideReason: z.string().trim().optional(),
  })
  .superRefine((payload, context) => {
    if (!payload.timing && !payload.pricing && !payload.status) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "At least one of timing, pricing, or status is required",
        path: ["timing"],
      });
    }
  });
/* ---------------------------------
   Helpers
---------------------------------- */
function normalizeAdminSlot(slot: SlotWithRelations) {
  const activeConfirmedBookings = (slot.bookings ?? []).filter(
    (booking) =>
      booking.bookingStatus === "CONFIRMED" &&
      booking.cancelledReason !== ADMIN_SOFT_DELETE_REASON
  );
  const bookingHistoryCount = slot._count?.bookings ?? 0;
  const isCustomSlot = isManualSlotReason(slot.overrideReason);
  const isLocked = slot.status === "LOCKED";
  const isBooked = slot.status === "BOOKED";
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
    id: slot.id,
    date: formatInTimeZone(slot.date, IST_TIMEZONE, "yyyy-MM-dd"),
    startTime: slot.startTime,
    endTime: slot.endTime,
    durationMin: slot.durationMin,
    theatre: {
      id: slot.theatre.id,
      name: slot.theatre.name,
    },

    pricing: {
      regular: slot.regularPrice,
      sale: slot.salePrice,
      final: slot.finalPrice,
      discountText: slot.discountText,
      isSpecial: slot.isSpecial,
    },

    template: slot.template
      ? {
        ...slot.template,
        endTime: addMinutesToTime(
          slot.template.startTime,
          slot.template.durationMin
        ),
      }
      : null,

    bookingCount: activeConfirmedBookings.length,
    bookings: activeConfirmedBookings.map((booking) => ({
      id: booking.id,
      bookingRef: booking.bookingRef,
      bookingStatus: booking.bookingStatus,
    })),
    status: slot.status,
    isOverridden: slot.isOverridden,
    isCustomSlot: isManualSlotReason(slot.overrideReason),
    canDelete,
    deleteDisabledReason,
    isTimingOverridden: slot.isTimingOverridden,
    isPricingOverridden: slot.isPricingOverridden,
    isStatusOverridden: slot.isStatusOverridden,
    overrideReason: slot.overrideReason,
    slotModifiedAt: slot.slotModifiedAt?.toISOString() ?? null,
    slotModifiedBy: slot.slotModifiedBy ?? null,
    createdAt: slot.createdAt.toISOString(),
    updatedAt: slot.updatedAt.toISOString(),
  };
}

function isPastSlotForApi(slot: {
  date: Date;
  startTime: string;
  endTime: string;
}, config: SlotExpiryConfig) {
  return isSlotExpiredInIST(
    { startTime: slot.startTime, endTime: slot.endTime },
    slot.date,
    config
  );
}




/* ---------------------------------
    GET /api/admin/slots/:id
---------------------------------- */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (FEATURE_DISABLED) return featureDisabled();
  try {
    const adminId = await getAuthenticatedAdminIdFromCookies();
    if (!adminId) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const { id } = await params;

    const slot = await prisma.slot.findUnique({
      where: { id },
      include: {
        theatre: true,
        template: true,
        bookings: {
          where: {
            bookingStatus: "CONFIRMED",
            OR: [
              { cancelledReason: null },
              { cancelledReason: { not: ADMIN_SOFT_DELETE_REASON } },
            ],
          },
        },
        _count: {
          select: {
            bookings: true,
          },
        },
      },
    });

    if (!slot) {
      return NextResponse.json(
        { success: false, message: "Slot not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: normalizeAdminSlot(slot),
    });
  } catch (error) {
    console.error("SLOT_GET_ERROR", error);
    return NextResponse.json(
      { success: false, message: "Failed to fetch slot" },
      { status: 500 }
    );
  }
}



/* ---------------------------------
   PATCH /api/admin/slots/:id
---------------------------------- */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (FEATURE_DISABLED) return featureDisabled();
  try {
    const adminId = await getAuthenticatedAdminIdFromCookies();
    if (!adminId) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const { id: slotId } = await params;
    const payloadResult = patchSlotPayloadSchema.safeParse(await request.json());
    if (!payloadResult.success) {
      return NextResponse.json(
        {
          success: false,
          code: "INVALID_REQUEST",
          message: "Invalid slot update payload",
          errors: payloadResult.error.flatten(),
        },
        { status: 400 }
      );
    }

    const { timing, pricing, status } = payloadResult.data;
    const overrideReason = payloadResult.data.overrideReason ?? "";

    const hasAnyOverride = Boolean(timing || pricing || status);

    if (hasAnyOverride && (!overrideReason || overrideReason.trim().length < 10)) {
      return NextResponse.json(
        {
          success: false,
          code: "INVALID_OVERRIDE_REASON",
          message: "Override reason must be at least 10 characters",
        },
        { status: 400 }
      );
    }



    const slot = await prisma.slot.findUnique({
      where: { id: slotId },
      include: {
        bookings: {
          where: {
            bookingStatus: "CONFIRMED",
            OR: [
              { cancelledReason: null },
              { cancelledReason: { not: ADMIN_SOFT_DELETE_REASON } },
            ],
          },
          select: { id: true },
        },
        _count: {
          select: {
            bookings: true,
          },
        },
      },
    });

    if (!slot) {
      return NextResponse.json(
        { success: false, message: "Slot not found" },
        { status: 404 }
      );
    }

    if (slot.status === "LOCKED") {
      return NextResponse.json(
        { success: false, message: "Locked slot cannot be modified" },
        { status: 409 }
      );
    }

    const slotExpiryConfig = await resolveSlotExpiryConfig();
    if (
      isPastSlotForApi(slot, slotExpiryConfig) &&
      slot.status === "AVAILABLE" &&
      slot.bookings.length === 0
    ) {
      return NextResponse.json(
        {
          success: false,
          code: "PAST_SLOT",
          message: "Past slots without bookings cannot be modified",
        },
        { status: 409 }
      );
    }



    const hasBooking = slot.bookings.length > 0;
    const keepManualMarker = isManualSlotReason(slot.overrideReason);

    /* ---------------- TIMING ---------------- */
    let startTime = slot.startTime;
    let endTime = slot.endTime;
    let durationMin = slot.durationMin;

    if (timing) {
      if (!isValidTimeInput(timing.startTime) || !isValidTimeInput(timing.endTime)) {
        return NextResponse.json(
          {
            success: false,
            code: "INVALID_TIME_FORMAT",
            message: "Time must be in HH:mm format",
          },
          { status: 400 }
        );
      }

      const duration = calculateDuration(timing.startTime, timing.endTime);

      if (duration < 30) {
        return NextResponse.json(
          { success: false, message: "Slot duration too short" },
          { status: 400 }
        );
      }

      if (
        timeToMinutes(timing.endTime) < timeToMinutes(timing.startTime) &&
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

      if (hasBooking) {
        return NextResponse.json(
          { success: false, message: "Timing cannot be changed for booked slots" },
          { status: 409 }
        );
      }


      //-------------------------------------------------------------------------
      //  Check for overlaps with other slots in the same theatre (excluding current slot)
      // We need to check slots on the same day, as well as the previous and next day to account for overnight slots
      //-------------------------------------------------------------------------
      const overlapConflict = await findSlotTimingConflict({
        theatreId: slot.theatreId,
        slotDate: slot.date,
        startTime: timing.startTime,
        endTime: timing.endTime,
        excludeSlotId: slot.id,
      });

      if (overlapConflict) {
        return NextResponse.json(
          {
            success: false,
            code: "SLOT_OVERLAP",
            message: "Slot timing overlaps with an existing slot",
            details: {
              conflictingSlot: overlapConflict.conflictingSlot,
              attemptedSlot: {
                date: formatInTimeZone(slot.date, IST_TIMEZONE, "yyyy-MM-dd"),
                startTime: timing.startTime,
                endTime: timing.endTime,
              },
              reason: overlapConflict.reason,
            },
          },
          { status: 409 }
        );
      }


      startTime = timing.startTime;
      endTime = timing.endTime;
      durationMin = duration;
    }

    /* ---------------- PRICING ---------------- */
    let regularPrice = slot.regularPrice;
    let salePrice = slot.salePrice;
    let finalPrice = slot.finalPrice;

    if (pricing) {
      if (!Number.isFinite(pricing.regularPrice) || pricing.regularPrice <= 0) {
        return NextResponse.json(
          {
            success: false,
            code: "INVALID_REGULAR_PRICE",
            message: "Regular price must be greater than zero",
          },
          { status: 400 }
        );
      }

      if (
        pricing.salePrice != null &&
        (!Number.isFinite(pricing.salePrice) || pricing.salePrice <= 0)
      ) {
        return NextResponse.json(
          {
            success: false,
            code: "INVALID_SALE_PRICE",
            message: "Sale price must be greater than zero",
          },
          { status: 400 }
        );
      }

      if (
        pricing.salePrice != null &&
        pricing.salePrice >= pricing.regularPrice
      ) {
        return NextResponse.json(
          {
            success: false,
            code: "INVALID_SALE_PRICE",
            message: "Sale price must be less than regular price",
          },
          { status: 400 }
        );
      }

      regularPrice = pricing.regularPrice;
      salePrice = pricing.salePrice ?? null;
      finalPrice = salePrice ?? regularPrice;
    }


    /* ---------------- STATUS ---------------- */
    let slotStatus: SlotStatus = slot.status;
    let discountText = slot.discountText;

    if (status) {
      const { value, discountText: text } = status;

      if (hasBooking && value === "DISABLED") {
        return NextResponse.json(
          { success: false, message: "Booked slot cannot be disabled" },
          { status: 409 }
        );
      }

      slotStatus = value;

      if (typeof text === "string") {
        discountText = text.trim() || null;
      } else if (text === null) {
        discountText = null;
      }
    }

    const isReEnablingSlot = status?.value === "AVAILABLE" && slot.status === "DISABLED";
    if (isReEnablingSlot) {
      const overlapConflict = await findSlotTimingConflict({
        theatreId: slot.theatreId,
        slotDate: slot.date,
        startTime,
        endTime,
        excludeSlotId: slot.id,
      });

      if (overlapConflict) {
        return NextResponse.json(
          {
            success: false,
            code: "SLOT_OVERLAP",
            message: "Slot timing overlaps with an existing slot",
            details: {
              conflictingSlot: overlapConflict.conflictingSlot,
              attemptedSlot: {
                date: formatInTimeZone(slot.date, IST_TIMEZONE, "yyyy-MM-dd"),
                startTime,
                endTime,
              },
              reason: overlapConflict.reason,
            },
          },
          { status: 409 }
        );
      }
    }



    /* ---------------- UPDATE ---------------- */
    const updateData: {
      status: SlotStatus;
      isOverridden: boolean;
      overrideReason: string | null;
      slotModifiedAt: Date | null;
      slotModifiedBy: string | null;
      startTime?: string;
      endTime?: string;
      durationMin?: number;
      isTimingOverridden?: boolean;
      regularPrice?: number;
      salePrice?: number | null;
      finalPrice?: number;
      discountText?: string | null;
      isPricingOverridden?: boolean;
      isStatusOverridden?: boolean;
    } = {
      status: slotStatus as SlotStatus,
      isOverridden: hasAnyOverride,
      overrideReason: hasAnyOverride
        ? keepManualMarker
          ? `${MANUAL_SLOT_REASON_MARKER} | ${overrideReason}`
          : overrideReason
        : keepManualMarker
          ? slot.overrideReason
          : null,
      slotModifiedAt: hasAnyOverride ? new Date() : null,
      slotModifiedBy: hasAnyOverride ? "Admin" : null,
    };


    /* Timing override */
    if (timing) {
      updateData.startTime = startTime;
      updateData.endTime = endTime;
      updateData.durationMin = durationMin;
      updateData.isTimingOverridden = true;
    }

    /* Pricing override */
    if (pricing) {
      updateData.regularPrice = regularPrice;
      updateData.salePrice = salePrice;
      updateData.finalPrice = finalPrice;
      updateData.isPricingOverridden = true;
    }

    /* Status override */
    if (status) {
      updateData.isStatusOverridden = true;
      updateData.discountText = discountText;
    }

    await prisma.slot.update({
      where: { id: slotId },
      data: updateData,
    });



    const updatedFull = await prisma.slot.findUnique({
      where: { id: slotId },
      include: {
        theatre: true,
        template: true,
        bookings: {
          where: {
            bookingStatus: "CONFIRMED",
            OR: [
              { cancelledReason: null },
              { cancelledReason: { not: ADMIN_SOFT_DELETE_REASON } },
            ],
          },
        },
        _count: {
          select: {
            bookings: true,
          },
        },
      },
    });

    if (!updatedFull) {
      return NextResponse.json(
        { success: false, message: "Slot not found after update" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: normalizeAdminSlot(updatedFull),
    });


  } catch (error) {
    console.error("SLOT_PATCH_ERROR", error);
    return NextResponse.json(
      { success: false, message: "Failed to update slot" },
      { status: 500 }
    );
  }
}

/* ---------------------------------
   DELETE /api/admin/slots/:id
---------------------------------- */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (FEATURE_DISABLED) return featureDisabled();
  try {
    const adminId = await getAuthenticatedAdminIdFromCookies();
    if (!adminId) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const { id: slotId } = await params;

    const slot = await prisma.slot.findUnique({
      where: { id: slotId },
      select: {
        id: true,
        status: true,
        overrideReason: true,
        _count: {
          select: {
            bookings: true,
          },
        },
      },
    });

    if (!slot) {
      return NextResponse.json(
        { success: false, message: "Slot not found" },
        { status: 404 }
      );
    }

    const isCustomSlot = isManualSlotReason(slot.overrideReason);
    if (!isCustomSlot) {
      return NextResponse.json(
        {
          success: false,
          code: "SLOT_DELETE_NOT_ALLOWED",
          message: "Only custom slots can be deleted.",
        },
        { status: 409 }
      );
    }

    if (slot._count.bookings > 0) {
      return NextResponse.json(
        {
          success: false,
          code: "SLOT_DELETE_NOT_ALLOWED",
          message: "This slot has booking history and cannot be deleted.",
        },
        { status: 409 }
      );
    }

    if (slot.status === "LOCKED") {
      return NextResponse.json(
        {
          success: false,
          code: "SLOT_DELETE_NOT_ALLOWED",
          message: "Locked slot cannot be deleted.",
        },
        { status: 409 }
      );
    }

    if (slot.status === "BOOKED") {
      return NextResponse.json(
        {
          success: false,
          code: "SLOT_DELETE_NOT_ALLOWED",
          message: "Booked slot cannot be deleted.",
        },
        { status: 409 }
      );
    }

    await prisma.slot.delete({
      where: { id: slotId },
    });

    return NextResponse.json({
      success: true,
      message: "Slot deleted successfully.",
    });
  } catch (error) {
    console.error("SLOT_DELETE_ERROR", error);
    return NextResponse.json(
      { success: false, message: "Failed to delete slot" },
      { status: 500 }
    );
  }
}
