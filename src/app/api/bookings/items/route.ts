// src/app/api/bookings/items/route.ts
// Fetch booking items (extras) for summary & UI sync

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isNumberDecorationProduct } from "@/lib/product-numbering";

const EDITABLE_BOOKING_STATUSES = [
  "INCOMPLETE",
  "AWAITING_PAYMENT",
  "PAYMENT_PROCESSING",
] as const;

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const bookingId = searchParams.get("bookingId");

    if (!bookingId) {
      return NextResponse.json(
        { success: false, message: "bookingId is required" },
        { status: 400 }
      );
    }

    /* -----------------------------
      Validate booking
    ------------------------------ */
    const booking = await prisma.booking.findFirst({
      where: {
        id: bookingId,
        bookingStatus: {
          in: [...EDITABLE_BOOKING_STATUSES],
        },
      },
    });

    if (!booking) {
      return NextResponse.json(
        {
          success: false,
          message: "Booking not found or already completed",
        },
        { status: 404 }
      );
    }

    /* -----------------------------
       Fetch booking items (snapshot)
    ------------------------------ */
    const items = await prisma.bookingItem.findMany({
      where: { bookingId },
      orderBy: { createdAt: "asc" },
      include: {
        product: {
          select: {
            slug: true,
            image: true,
          },
        },
      },
    });

    const ledNumberRaw =
      booking.occasionData &&
      typeof booking.occasionData === "object" &&
      !Array.isArray(booking.occasionData) &&
      "ledNumber" in booking.occasionData
        ? booking.occasionData.ledNumber
        : null;
    const ledNumbers =
      typeof ledNumberRaw === "string"
        ? [ledNumberRaw.trim()].filter(Boolean)
        : Array.isArray(ledNumberRaw)
          ? ledNumberRaw
              .filter((value): value is string => typeof value === "string")
              .map((value) => value.trim())
              .filter(Boolean)
          : [];
    let ledNumberIndex = 0;

    /* -----------------------------
       Map → UI-safe shape
       (matches ProductSelection exactly)
    ------------------------------ */
    const mappedItems = items.map((item) => {
      const isNumberItem = isNumberDecorationProduct({
        slug: item.product?.slug,
        name: item.productName,
      });
      const ledNumber =
        isNumberItem && ledNumbers.length > 0
          ? ledNumbers[Math.min(ledNumberIndex++, ledNumbers.length - 1)]
          : undefined;

      return {
        id: item.id, // bookingItemId
        productId: item.productId,
        productImage: item.product?.image ?? undefined,
        productSlug: item.product?.slug ?? undefined,
        variantId: item.variantId,
        category: item.category,
        name: item.productName,
        variant: {
          label: item.variantLabel,
          price: item.unitPrice,
        },
        quantity: item.quantity,
        totalPrice: item.totalPrice,
        ledNumber,
      };
    });

    return NextResponse.json({
      success: true,
      items: mappedItems,
      booking: {
        occasionKey: booking.occasionKey,
        occasionData: booking.occasionData,
      },
    });
  } catch (error) {
    console.error("GET BOOKING ITEMS ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to fetch booking items",
      },
      { status: 500 }
    );
  }
}
