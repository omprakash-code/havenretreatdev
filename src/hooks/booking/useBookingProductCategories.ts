"use client";

import { useEffect, useState } from "react";
import type { BookingProductCategory } from "@/lib/booking-product-categories";

type CategoriesResponse = {
  success?: boolean;
  data?: BookingProductCategory[];
};

export async function fetchBookingProductCategories(locationId?: string | null) {
  const params = new URLSearchParams();

  if (locationId?.trim()) {
    params.set("locationId", locationId.trim());
  }

  const query = params.toString();
  const res = await fetch(
    `/api/products/categories${query ? `?${query}` : ""}`,
    {
      cache: "no-store",
    }
  );

  const json = (await res.json().catch(() => null)) as CategoriesResponse | null;

  if (!res.ok || !json?.success || !Array.isArray(json.data)) {
    return [];
  }

  return json.data;
}

export function useBookingProductCategories(locationId?: string | null) {
  const [categories, setCategories] = useState<BookingProductCategory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!locationId?.trim()) {
        setCategories([]);
        setLoading(false);
        return;
      }

      setLoading(true);

      try {
        const next = await fetchBookingProductCategories(locationId);

        if (!cancelled) {
          setCategories(next);
        }
      } catch {
        if (!cancelled) {
          setCategories([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [locationId]);

  return { categories, loading };
}
