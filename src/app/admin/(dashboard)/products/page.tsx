"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import PageHeader from "@/components/admin/page/PageHeader";
import ProductFilters from "@/components/admin/products/ProductFilters";
import ProductTable from "@/components/admin/products/ProductTable";
import ProductDrawer from "@/components/admin/products/drawer/ProductDrawer";
import ConfirmActionModal from "@/components/admin/drawer/ConfirmActionModal";
import type {
  AdminProduct,
  ProductDrawerMode,
  ProductLocationOption,
} from "@/types/admin/product";
import { Package, Plus, Search } from "@/components/icons";
import { toast } from "sonner";
import AdminEmptyState from "@/components/admin/shared/AdminEmptyState";

type BlockedBooking = {
  bookingRef: string;
  bookingStatus: string;
};

const LIVE_BOOKING_STATUSES = new Set([
  "INCOMPLETE",
  "AWAITING_PAYMENT",
  "PAYMENT_PROCESSING",
]);
const ALL_LOCATIONS_OPTION: ProductLocationOption = {
  id: "__ALL__",
  name: "All Locations",
};

export default function AdminProductsPage() {
  const router = useRouter();
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [locations, setLocations] = useState<ProductLocationOption[]>([]);
  const [loading, setLoading] = useState(true);

  // filters
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [location, setLocation] = useState("");
  const [status, setStatus] = useState("");

  // drawer
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<ProductDrawerMode>("create");
  const [activeProduct, setActiveProduct] =
    useState<AdminProduct | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminProduct | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [blockedBookings, setBlockedBookings] = useState<BlockedBooking[]>([]);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/products");
      const json = await res.json();
      if (json.success) {
        setProducts(json.data);
      }
    } catch (err) {
      console.error("Failed to load admin products", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchProducts();
  }, [fetchProducts]);

  useEffect(() => {
    let cancelled = false;

    async function fetchLocations() {
      try {
        const res = await fetch("/api/locations");
        const json = await res.json();
        if (!cancelled && json.success) {
          setLocations(Array.isArray(json.data) ? json.data : []);
        }
      } catch (error) {
        console.error("Failed to load locations for products drawer", error);
      }
    }

    void fetchLocations();

    return () => {
      cancelled = true;
    };
  }, []);

  const drawerLocations = useMemo(() => {
    const map = new Map<string, ProductLocationOption>();

    map.set(ALL_LOCATIONS_OPTION.id, ALL_LOCATIONS_OPTION);

    locations.forEach((location) => {
      map.set(location.id, location);
    });

    products.forEach((product) => {
      map.set(product.location.id, product.location);
    });

    return Array.from(map.values());
  }, [locations, products]);

  /* -----------------------------
     Client-side filters
  ------------------------------ */
  const filtered = useMemo(() => {
    return products.filter((p) => {
      if (search) {
        const q = search.toLowerCase();
        if (
          !p.name.toLowerCase().includes(q) &&
          !p.slug.toLowerCase().includes(q)
        )
          return false;
      }

      if (category && p.category !== category) return false;
      if (location && p.location.id !== location) return false;
      if (status && String(p.isActive) !== status) return false;

      return true;
    });
  }, [products, search, category, location, status]);

  const hasActiveFilters =
    search.trim().length > 0 ||
    category.trim().length > 0 ||
    location.trim().length > 0 ||
    status.trim().length > 0;

  function openDeleteModal(product: AdminProduct) {
    setDeleteError(null);
    setBlockedBookings([]);
    setDeleteTarget(product);
  }

  function closeDeleteModal() {
    if (deleting) return;
    setDeleteError(null);
    setBlockedBookings([]);
    setDeleteTarget(null);
  }

  async function handleDeleteProduct() {
    if (!deleteTarget) return;

    try {
      setDeleting(true);
      setDeleteError(null);

      const res = await fetch(`/api/admin/products?id=${deleteTarget.id}`, {
        method: "DELETE",
      });
      const json = (await res.json().catch(() => null)) as
        | {
            success?: boolean;
            message?: string;
            bookingRefs?: string[];
            blockedBookings?: BlockedBooking[];
          }
        | null;

      if (!res.ok || !json?.success) {
        const bookingsFromResponse = Array.isArray(json?.blockedBookings)
          ? json.blockedBookings.filter(
              (booking): booking is BlockedBooking =>
                typeof booking?.bookingRef === "string" &&
                booking.bookingRef.trim().length > 0 &&
                typeof booking?.bookingStatus === "string"
            )
          : [];
        const refsFromResponse = Array.isArray(json?.bookingRefs)
          ? json.bookingRefs.filter(
              (bookingRef): bookingRef is string =>
                typeof bookingRef === "string" && bookingRef.trim().length > 0
            )
          : [];
        const refsFromMessage =
          typeof json?.message === "string"
            ? Array.from(json.message.matchAll(/\bDS[A-Za-z0-9]+\b/g)).map(
                (match) => match[0]
              )
            : [];
        const mergedByRef = new Map<string, BlockedBooking>();
        bookingsFromResponse.forEach((booking) => {
          mergedByRef.set(booking.bookingRef, booking);
        });
        [...refsFromResponse, ...refsFromMessage].forEach((bookingRef) => {
          if (!mergedByRef.has(bookingRef)) {
            mergedByRef.set(bookingRef, {
              bookingRef,
              bookingStatus: "UNKNOWN",
            });
          }
        });
        setBlockedBookings(Array.from(mergedByRef.values()));
        setDeleteError(json?.message ?? "Failed to delete product");
        return;
      }

      setBlockedBookings([]);
      toast.success("Product deleted successfully");
      await fetchProducts();
      setDeleteTarget(null);
    } catch (error) {
      setBlockedBookings([]);
      setDeleteError(error instanceof Error ? error.message : "Failed to delete product");
    } finally {
      setDeleting(false);
    }
  }

  function openBlockedBooking(booking: BlockedBooking) {
    closeDeleteModal();
    const normalizedStatus = booking.bookingStatus.trim().toUpperCase();
    const targetPath = LIVE_BOOKING_STATUSES.has(normalizedStatus)
      ? "/admin/bookings/live"
      : normalizedStatus === "ABANDONED"
        ? "/admin/bookings/abandoned"
        : "/admin/bookings";
    router.push(`${targetPath}?ref=${encodeURIComponent(booking.bookingRef)}`);
  }

  return (
    <>
      <PageHeader
        title="Products"
        description="Manage cakes, decorations, and gift catalog."
        inlineActions
        actions={
          <button
            onClick={() => {
              setActiveProduct(null);
              setDrawerMode("create");
              setDrawerOpen(true);
            }}
            className="inline-flex cursor-pointer items-center gap-2 rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-800 active:scale-[0.98]"
          >
            <Plus size={16} />
            Add Product
          </button>
        }
      />

      <ProductFilters
        search={search}
        setSearch={setSearch}
        category={category}
        setCategory={setCategory}
        location={location}
        setLocation={setLocation}
        status={status}
        setStatus={setStatus}
        products={products}
      />

      {loading ? (
        <div className="py-10 text-sm text-neutral-500">
          Loading products…
        </div>
      ) : filtered.length === 0 ? (
        <AdminEmptyState
          title={hasActiveFilters ? "No products match your filters" : "No products found"}
          description={
            hasActiveFilters
              ? "Try clearing filters or search to view available products."
              : "Add your first product to start managing catalogue items."
          }
          icon={hasActiveFilters ? <Search size={18} /> : <Package size={18} />}
          actionLabel={hasActiveFilters ? "Clear Filters" : "Add Product"}
          onAction={
            hasActiveFilters
              ? () => {
                  setSearch("");
                  setCategory("");
                  setLocation("");
                  setStatus("");
                }
              : () => {
                  setActiveProduct(null);
                  setDrawerMode("create");
                  setDrawerOpen(true);
                }
          }
        />
      ) : (
        <ProductTable
          data={filtered}
          onView={(product) => {
            setActiveProduct(product);
            setDrawerMode("view");
            setDrawerOpen(true);
          }}
          onEdit={(product) => {
            setActiveProduct(product);
            setDrawerMode("edit");
            setDrawerOpen(true);
          }}
          onDelete={(product) => {
            openDeleteModal(product);
          }}
        />
      )}

      <ProductDrawer
        open={drawerOpen}
        mode={drawerMode}
        product={activeProduct}
        locations={drawerLocations}
        onClose={() => setDrawerOpen(false)}
        onSaved={() => void fetchProducts()}
        onModeChange={setDrawerMode}
      />

      <ConfirmActionModal
        open={Boolean(deleteTarget)}
        title="Confirm Product Deletion"
        description={
          <>
            You are about to permanently delete{" "}
            <strong>{deleteTarget?.name ?? "this product"}</strong>. This action
            cannot be undone.
          </>
        }
        confirmLabel="Yes, Delete Product"
        loadingLabel="Deleting..."
        loading={deleting}
        confirmDisabled={blockedBookings.length > 0}
        error={
          !deleteError ? null : blockedBookings.length > 0 ? (
            <span>
              Cannot delete this product because it is used in bookings{" "}
              {blockedBookings.map((booking, index) => (
                <span key={booking.bookingRef}>
                  {index > 0 ? ", " : null}
                  <button
                    type="button"
                    onClick={() => openBlockedBooking(booking)}
                    className="cursor-pointer font-semibold text-red-700 underline underline-offset-2 transition hover:text-red-800"
                  >
                    {booking.bookingRef}
                  </button>
                </span>
              ))}
              .
            </span>
          ) : (
            deleteError
          )
        }
        onClose={closeDeleteModal}
        onConfirm={() => void handleDeleteProduct()}
      />
    </>
  );
}
