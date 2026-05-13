"use client";

import { useEffect, useState } from "react";
import ProductCard from "./ProductCard";
import type { Product } from "./types";
import type { BookingItemSnapshot } from "@/context/BookingContext";
import { useBooking } from "@/context/BookingContext";

type Props = {
  bookingCategorySlug: string;
  selectedProducts: BookingItemSnapshot[];
};

export default function ProductList({
  bookingCategorySlug,
  selectedProducts,
}: Props) {
  const { booking } = useBooking();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const locationId = booking.location?.id ?? "";

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
          setProducts(json.data ?? []);
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
  }, [bookingCategorySlug, locationId]);

  if (loading) {
    return <p className="text-sm text-gray-400">Loading add-ons…</p>;
  }

  if (!products.length) {
    return (
      <p className="border border-[#d7e4e1] bg-[#f8fbfa] px-4 py-3 text-sm text-gray-500">
        No add-ons are available in this category right now.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 lg:gap-4">
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
