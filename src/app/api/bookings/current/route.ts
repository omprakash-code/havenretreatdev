import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { verifyBookingSessionToken } from "@/services/booking/bookingSession.server";
import {
    expireBookingLockSession,
    isStrictLockExpired,
    releaseSiblingSessionLocks,
} from "@/services/booking/booking-lock-lifecycle.service";
import { RESERVATION_TIMED_OUT_MESSAGE } from "@/lib/booking-session-expiry";
import { notifyAbandonedBookingsByIds } from "@/services/booking/booking-abandonment-email.service";
import { getCouponDisplayCode } from "@/lib/coupon-display";
import {
    RangeBookingSessionError,
    requireActiveRangeBookingSession,
} from "@/services/booking/range-booking-session.service";

function clearBookingSessionCookie(cookieStore: Awaited<ReturnType<typeof cookies>>) {
    cookieStore.set("ds_booking_session", "", {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: 0,
    });
}

export async function GET() {
    const cookieStore = await cookies();

    const sessionToken =
        cookieStore.get("ds_booking_session")?.value ?? null;

    if (!sessionToken) {
        return NextResponse.json({ success: false }, { status: 401 });
    }

    const payload = verifyBookingSessionToken(sessionToken);

    if (!payload) {
        clearBookingSessionCookie(cookieStore);
        return NextResponse.json({ success: false }, { status: 401 });
    }

    const { bookingId, lockOwner } = payload;

    if (typeof payload.lockVersion === "number") {
        try {
            const { booking, lock } = await requireActiveRangeBookingSession({
                bookingId,
                lockOwner,
                lockVersion: payload.lockVersion,
            });
            const settings = await prisma.bookingSettings.findUnique({
                where: { theatreId: booking.theatreId! },
                select: { maximumGuests: true },
            });
            if (booking.bookingStatus === "CONFIRMED") {
                return NextResponse.json({
                    success: false,
                    alreadyConfirmed: true,
                    bookingRef: booking.bookingRef,
                }, { status: 409 });
            }

            return NextResponse.json({
                success: true,
                data: {
                    ...booking,
                    slot: null,
                    rangeSchedule: {
                        eventDate: booking.eventDate,
                        startTime: booking.eventStartTime,
                        endTime: booking.eventEndTime,
                        startsAtUtc: booking.startsAtUtc,
                        endsAtUtc: booking.endsAtUtc,
                        occupiedUntilUtc: booking.occupiedUntilUtc,
                        timezone: booking.timezone,
                        lockId: lock.id,
                        lockExpiresAt: lock.expiresAt,
                        lockVersion: lock.version,
                        maximumGuests: settings?.maximumGuests ?? null,
                    },
                    appliedCoupons: booking.couponUsages.map((usage) => ({
                        id: usage.coupon.id,
                        code: getCouponDisplayCode(usage.coupon.code),
                        discountAmount: usage.discountAmount ?? 0,
                        status: usage.status,
                    })),
                },
            });
        } catch (error) {
            if (error instanceof RangeBookingSessionError) {
                clearBookingSessionCookie(cookieStore);
                return NextResponse.json(
                    {
                        success: false,
                        code: "SESSION_EXPIRED",
                        message: RESERVATION_TIMED_OUT_MESSAGE,
                    },
                    { status: error.code === "BOOKING_NOT_FOUND" ? 404 : 409 }
                );
            }
            throw error;
        }
    }

    const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
        include: {
            theatre: {
                include: { location: true }
            },
            slot: true,
            items: {
                include: {
                    product: {
                        select: {
                            image: true,
                            slug: true,
                        },
                    },
                },
            },
            couponUsages: {
                where: { status: { in: ["RESERVED", "CONFIRMED"] } },
                include: { coupon: true },
                orderBy: { reservedAt: "asc" },
            },
        },
    });

    if (!booking) {
        clearBookingSessionCookie(cookieStore);
        return NextResponse.json({ success: false }, { status: 404 });
    }

    if (!booking.slotId || !booking.slot) {
        clearBookingSessionCookie(cookieStore);
        return NextResponse.json(
            {
                success: false,
                code: "SESSION_EXPIRED",
                message: RESERVATION_TIMED_OUT_MESSAGE,
            },
            { status: 409 }
        );
    }

    const now = new Date();
    if (isStrictLockExpired(booking, now)) {
        const expireResult = await expireBookingLockSession(prisma, {
            bookingId: booking.id,
            slotId: booking.slotId,
            now,
            cancelledReason: "SESSION_EXPIRED",
        });
        if (expireResult.abandonedBookingIds.length > 0) {
            try {
                await notifyAbandonedBookingsByIds(expireResult.abandonedBookingIds);
            } catch (notifyError) {
                console.error("BOOKINGS_CURRENT_ABANDONMENT_NOTIFY_FAILED", notifyError);
            }
        }

        clearBookingSessionCookie(cookieStore);
        return NextResponse.json(
            {
                success: false,
                code: "SESSION_EXPIRED",
                message: RESERVATION_TIMED_OUT_MESSAGE,
            },
            { status: 409 }
        );
    }


    if (booking.bookingStatus === "CONFIRMED") {
        return NextResponse.json({
            success: false,
            alreadyConfirmed: true,
            bookingRef: booking.bookingRef,
        }, { status: 409 });
    }

    // SECURITY: verify slot still belongs to this user
    if (booking.slot.lockedBy !== lockOwner) {
        clearBookingSessionCookie(cookieStore);
        return NextResponse.json(
            {
                success: false,
                code: "SESSION_EXPIRED",
                message: RESERVATION_TIMED_OUT_MESSAGE,
            },
            { status: 409 }
        );

    }

    const siblingReleaseResult = await prisma.$transaction(async (tx) => {
        return releaseSiblingSessionLocks(tx, {
            lockOwner,
            keepSlotId: booking.slotId,
            now,
            cancelledReason: "SESSION_SLOT_SWITCHED",
        });
    });
    if (siblingReleaseResult.releasedBookingIds.length > 0) {
        try {
            await notifyAbandonedBookingsByIds(siblingReleaseResult.releasedBookingIds);
        } catch (notifyError) {
            console.error("BOOKINGS_CURRENT_SIBLING_NOTIFY_FAILED", notifyError);
        }
    }

    const items = booking.items.map((item) => ({
        id: item.id,
        bookingId: item.bookingId,
        productId: item.productId,
        variantId: item.variantId,
        productName: item.productName,
        variantLabel: item.variantLabel,
        unitPrice: item.unitPrice,
        quantity: item.quantity,
        totalPrice: item.totalPrice,
        category: item.category,
        createdAt: item.createdAt,
        productImage: item.product?.image ?? null,
        productSlug: item.product?.slug ?? null,
    }));

    const appliedCoupons = booking.couponUsages.map((usage) => ({
        id: usage.coupon.id,
        code: getCouponDisplayCode(usage.coupon.code),
        discountAmount: usage.discountAmount ?? 0,
        status: usage.status,
    }));

    return NextResponse.json({
        success: true,
        data: {
            ...booking,
            items,
            appliedCoupons,
        },
    });
}
