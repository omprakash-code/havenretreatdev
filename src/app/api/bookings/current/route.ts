import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { verifyBookingSessionToken } from "@/services/booking/bookingSession.server";
import { RESERVATION_TIMED_OUT_MESSAGE } from "@/lib/booking-session-expiry";
import { isReviewWorkflowBookingStatus } from "@/lib/booking-status";
import { getCouponDisplayCode } from "@/lib/coupon-display";
import {
    RangeBookingSessionError,
    requireActiveRangeBookingSession,
} from "@/services/booking/range-booking-session.service";
import { getVariantBaseUnitPriceMap } from "@/services/booking/variant-base-price.service";

type BookingItemWithProduct = {
    variantId: string;
    [key: string]: unknown;
};

// Snapshot items plus the variant's live base unit price, so the client can
// re-derive duration-adjusted prices from the current database price.
async function withVariantBaseUnitPrices<T extends BookingItemWithProduct>(
    items: T[]
) {
    const baseUnitPriceByVariantId = await getVariantBaseUnitPriceMap(
        prisma,
        items.map((item) => item.variantId)
    );
    return items.map((item) => ({
        ...item,
        baseUnitPrice: baseUnitPriceByVariantId.get(item.variantId) ?? null,
    }));
}

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
            if (booking.bookingStatus === "APPROVED") {
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
                    items: await withVariantBaseUnitPrices(booking.items),
                    rangeSchedule: {
                        eventDate: booking.eventDate,
                        startTime: booking.eventStartTime,
                        endTime: booking.eventEndTime,
                        startsAtUtc: booking.startsAtUtc,
                        endsAtUtc: booking.endsAtUtc,
                        occupiedUntilUtc: booking.occupiedUntilUtc,
                        timezone: booking.timezone,
                        lockId: null,
                        lockExpiresAt: booking.holdExpiresAt,
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

                // A booking that was submitted for review is finished, not expired.
                // Reporting SESSION_EXPIRED here would show the customer a
                // "reservation timed out" modal on their next visit; instead the
                // stale cookie is dropped and a fresh booking starts silently.
                if (error.code === "BOOKING_SUBMITTED") {
                    return NextResponse.json(
                        { success: false, code: "BOOKING_SUBMITTED" },
                        { status: 409 }
                    );
                }

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
            eventPackage: { include: { location: true } },
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

    if (booking.bookingStatus === "APPROVED") {
        return NextResponse.json({
            success: false,
            alreadyConfirmed: true,
            bookingRef: booking.bookingRef,
        }, { status: 409 });
    }

    // A submitted booking is not an editable draft; drop the stale session so a
    // new booking starts cleanly.
    if (isReviewWorkflowBookingStatus(booking.bookingStatus)) {
        clearBookingSessionCookie(cookieStore);
        return NextResponse.json(
            { success: false, code: "BOOKING_SUBMITTED" },
            { status: 409 }
        );
    }

    const items = await withVariantBaseUnitPrices(booking.items.map((item) => ({
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
    })));

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
