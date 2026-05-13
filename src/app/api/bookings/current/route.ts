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
