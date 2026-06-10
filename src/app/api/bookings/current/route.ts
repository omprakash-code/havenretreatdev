import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { verifyBookingSessionToken } from "@/services/booking/bookingSession.server";
import { RESERVATION_TIMED_OUT_MESSAGE } from "@/lib/booking-session-expiry";
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
            const { booking } = await requireActiveRangeBookingSession({
                bookingId,
                lockOwner,
                lockVersion: payload.lockVersion,
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
                        lockId: null,
                        lockExpiresAt: null,
                        lockVersion: booking.lockVersion,
                        maximumGuests: null,
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

    if (booking.bookingStatus === "CONFIRMED") {
        return NextResponse.json({
            success: false,
            alreadyConfirmed: true,
            bookingRef: booking.bookingRef,
        }, { status: 409 });
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
