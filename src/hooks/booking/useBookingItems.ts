"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { useBooking } from "@/context/BookingContext";
import type { ProductSelection } from "@/components/booking/products/types";
import { handleBookingError } from "@/utils/handleBookingError";

export function useBookingItems() {
  const router = useRouter();
  const {
    booking,
    setBookingItems,
    setItemsHydrated,
    resetBooking,
  } = useBooking();

  const [items, setItems] = useState<ProductSelection[]>([]);
  const [loading, setLoading] = useState(false);

  /* -----------------------------
     Fetch booking items (MANUAL)
  ------------------------------ */
  const fetchItems = useCallback(async () => {
    if (!booking.bookingId) return;

    setLoading(true);
    try {
      const res = await fetch(
        `/api/bookings/items?bookingId=${booking.bookingId}`,
        { cache: "no-store" }
      );

      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        handleBookingError(data, router, {
          resetBooking,
          fallbackMessage: "Failed to fetch booking items.",
        });
        return;
      }

      if (Array.isArray(data.items)) {
        setItems(data.items);

        setBookingItems(
          data.items.map((i: ProductSelection) => ({
            id: i.id,
            productId: i.productId,
            productImage: i.productImage,
            variantId: i.variantId,
            category: i.category,
            productName: i.name,
            productSlug: i.productSlug,
            variantLabel: i.variant.label,
            unitPrice: i.variant.price,
            quantity: i.quantity,
            totalPrice: i.totalPrice,
            ledNumber: i.ledNumber,
          }))
        );

        setItemsHydrated(true);
      }
    } catch (err) {
      console.error("Failed to fetch booking items:", err);
    } finally {
      setLoading(false);
    }
  }, [
    booking.bookingId,
    router,
    resetBooking,
    setBookingItems,
    setItemsHydrated,
  ]);


  /* -----------------------------
     Remove item
  ------------------------------ */
  const removeItem = async (bookingItemId: string) => {
    if (!booking.bookingId) return;

    const res = await fetch("/api/bookings/items/remove", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bookingItemId }),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.success) {
      handleBookingError(json, router, {
        resetBooking,
        fallbackMessage: "Unable to remove item.",
      });
      return;
    }

    await fetchItems(); // MANUAL refresh
  };

  return {
    items,
    loading,
    fetchItems, // used after add/update
    removeItem,
  };
}
