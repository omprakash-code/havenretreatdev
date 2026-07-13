"use client";

import { useEffect, useRef, useState } from "react";
import ProductCard from "./ProductCard";
import type { Product } from "./types";
import type { BookingItemSnapshot } from "@/context/BookingContext";
import { useBooking } from "@/context/BookingContext";
import { ensurePackageIncludedProducts } from "@/lib/package-included-products";

type Props = {
  bookingCategorySlug: string;
  selectedProducts: BookingItemSnapshot[];
};

export default function ProductList({
  bookingCategorySlug,
  selectedProducts,
}: Props) {
  const { booking, setBookingItems } = useBooking();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const locationId = booking.location?.id ?? "";
  const selectedPackage = booking.package;
  const selectedPackageKey = selectedPackage
    ? `${selectedPackage.id}:${selectedPackage.capacity}:${selectedPackage.name}`
    : "";
  const selectedPackageRef = useRef(selectedPackage);
  const setBookingItemsRef = useRef(setBookingItems);

  useEffect(() => {
    selectedPackageRef.current = selectedPackage;
    setBookingItemsRef.current = setBookingItems;
  }, [selectedPackage, setBookingItems]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!locationId) {
        setProducts([]);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const params = new URLSearchParams({
          bookingCategory: bookingCategorySlug,
          locationId,
        });
        const res = await fetch(`/api/products?${params.toString()}`, {
          cache: "no-store",
        });
        const json = await res.json();

        if (!cancelled && json.success) {
          const nextProducts = json.data ?? [];
          setProducts(nextProducts);

          if (bookingCategorySlug === "add-ons") {
            setBookingItemsRef.current((currentItems) =>
              ensurePackageIncludedProducts({
                currentItems,
                products: nextProducts,
                selectedPackage: selectedPackageRef.current,
              })
            );
          }
        }
      } catch {
        if (!cancelled) setProducts([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [bookingCategorySlug, locationId, selectedPackageKey]);

  if (loading) {
    return <p className="text-sm text-gray-400">Loading add-ons…</p>;
  }

  if (!products.length) {
    return (
      <p className="bg-gray-50 px-4 py-3 text-sm text-gray-500">
        No add-ons are available in this category right now.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4">
      {products.map((product) => (
        <ProductCard
          key={product.id}
          product={product}
          selectedProducts={selectedProducts}
        />
      ))}
    </div>
  );
}
