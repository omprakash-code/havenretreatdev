"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { calculateBookingPricing } from "@/lib/booking-pricing";
import {
  ADVANCE_PAYMENT_AMOUNT_KEY,
  parseAdvancePaymentAmount,
} from "@/lib/app-settings";
import { resolveCouponIdentityGate } from "@/lib/coupon-identity-gate";
import { isNumberDecorationProduct } from "@/lib/product-numbering";
import { ensureRazorpayCheckoutLoaded, openRazorpayModal } from "@/lib/razorpay/checkout-client";
import {
  discardPendingOnlineCreateBooking,
  handlePendingOnlineCreateRetry,
  type PendingOnlineCreateBooking,
} from "@/components/admin/bookings/add/admin-online-create-retry";
import { BookingSummarySection } from "@/components/admin/bookings/add/sections/BookingSummarySection";
import { CustomerInfoSection } from "@/components/admin/bookings/add/sections/CustomerInfoSection";
import { OccasionSection } from "@/components/admin/bookings/add/sections/OccasionSection";
import { PaymentModeSection } from "@/components/admin/bookings/add/sections/PaymentModeSection";
import { ProductsExtrasSection } from "@/components/admin/bookings/add/sections/ProductsExtrasSection";
import { ScheduleSection } from "@/components/admin/bookings/add/sections/ScheduleSection";
import ConfirmActionModal from "@/components/admin/drawer/ConfirmActionModal";
import {  isValidPhone, normalizePhone,} from "@/lib/phone";
import {
  getSelectionKey,
  getSlotConflictMessage,
  getVariantPrice,
  isValidEmail,
  toTitleStatus,
  type ActiveVariantMap,
  type LedDraftMap,
  type LocationOption,
  type OccasionOption,
  type PricingSummary,
  type ProductLineSelection,
  type ProductOption,
  type ProductSelectionMap,
  type SelectedProductSummaryItem,
  type SlotOption,
  type SlotStatus,
  type TheatreOption,
} from "@/components/admin/bookings/add/shared";
import { getSubmitBlockerMessage } from "@/components/admin/bookings/add/sections/bookingSummary.helpers";
import {
  getDateHoverHint,
  getSlotHoverHint,
  getTheatreHoverHint,
} from "@/components/admin/bookings/add/sections/scheduleSection.helpers";

type AdminAddBookingFormProps = {
  embedded?: boolean;
  mode?: "create" | "edit";
  bookingId?: string | null;
  onCreated?: (bookingRef: string) => void;
  onUpdated?: (bookingId: string) => void;
};

type EditBookingResponse = {
  id: string;
  bookingRef: string;
  bookingStatus: string;
  paymentStatus:
    | "INITIALIZED"
    | "AWAITING_PAYMENT"
    | "PAID"
    | "FAILED"
    | "CANCELLED"
    | "EXPIRED"
    | "OFFLINE";
  customer: {
    userId: string | null;
    name: string;
    phone: string;
    email: string;
  };
  locationId: string;
  date: string;
  theatreId: string;
  slotId: string;
  guestCount: number;
  decorationRequired: boolean;
  occasionKey: string;
  occasionData: Record<string, unknown>;
  couponCode?: string;
  couponCodes?: string[];
  appliedCoupons?: Array<{
    couponId: string;
    code: string;
    discountAmount: number;
  }>;
  items: Array<{
    id?: string;
    productId: string;
    variantId: string;
    productName?: string;
    variantLabel?: string;
    category?: "CAKE" | "DECORATION" | "GIFT";
    quantity: number;
    unitPrice?: number;
    totalPrice?: number;
    ledNumber: string | null;
  }>;
  payment: {
    type: "OFFLINE" | "ONLINE";
    amountMode: "ADVANCE" | "FULL";
    advanceAmount: number;
    offlineMethod: string;
    offlineReference: string;
    status:
      | "INITIALIZED"
      | "AWAITING_PAYMENT"
      | "PAID"
      | "FAILED"
      | "CANCELLED"
      | "EXPIRED"
      | "OFFLINE";
  };
  pricing: {
    baseAmount: number;
    extrasAmount: number;
    productsAmount: number;
    decorationAmount: number;
    discountAmount: number;
    totalAmount: number;
    advancePaid: number;
    remainingPayable: number;
  };
};

type AppliedAdminCoupon = {
  couponId: string;
  code: string;
  discountAmount: number;
};

type AdminBookingMutationRequest = {
  mode: "create" | "edit";
  bookingId?: string | null;
  commonPayload: Record<string, unknown>;
};

type SlotOverrideLockContext = "same_session" | "other_session";

const EMPTY_PRODUCT_SELECTION: ProductLineSelection = {
  quantity: 0,
  ledNumber: "",
};

function extractLedNumbersFromOccasionData(data: Record<string, unknown> | null | undefined) {
  if (!data) return [];

  const directKeys = ["ledNumber", "led_number", "ledNo", "ledno", "led"];
  const values: unknown[] = [];

  directKeys.forEach((key) => {
    if (key in data) {
      values.push(data[key]);
    }
  });

  if (values.length === 0) {
    Object.entries(data).forEach(([key, value]) => {
      const normalized = key.trim().toLowerCase();
      if (normalized.includes("led") && normalized.includes("number")) {
        values.push(value);
      }
    });
  }

  return values
    .flatMap((value) => {
      if (typeof value === "string") return [value.trim()];
      if (typeof value === "number" && Number.isFinite(value)) return [String(value)];
      if (Array.isArray(value)) {
        return value.map((entry) => String(entry ?? "").trim());
      }
      return [];
    })
    .filter((value) => value.length > 0);
}

export function AdminAddBookingForm({
  embedded = false,
  mode = "create",
  bookingId = null,
  onCreated,
  onUpdated,
}: AdminAddBookingFormProps) {
  const router = useRouter();

  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [theatres, setTheatres] = useState<TheatreOption[]>([]);
  const [occasions, setOccasions] = useState<OccasionOption[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);

  const [loadingBootData, setLoadingBootData] = useState(true);
  const [loadingTheatres, setLoadingTheatres] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [lookingUpUser, setLookingUpUser] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [locationId, setLocationId] = useState("");
  const [date, setDate] = useState("");
  const [theatreId, setTheatreId] = useState("");
  const [slotId, setSlotId] = useState("");

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [existingUserId, setExistingUserId] = useState<string | null>(null);
  const [existingUserName, setExistingUserName] = useState<string | null>(null);

  const [extraGuestCount, setExtraGuestCount] = useState(0);
  const [decorationRequired, setDecorationRequired] = useState(false);

  const [occasionKey, setOccasionKey] = useState("");
  const [occasionData, setOccasionData] = useState<Record<string, string>>({});

  const [activeVariants, setActiveVariants] = useState<ActiveVariantMap>({});
  const [productSelections, setProductSelections] = useState<ProductSelectionMap>({});
  const [ledDrafts, setLedDrafts] = useState<LedDraftMap>({});

  const isEditMode = mode === "edit";

  const [paymentType, setPaymentType] = useState<"OFFLINE" | "ONLINE">("OFFLINE");
  const [paymentAmountMode, setPaymentAmountMode] = useState<"ADVANCE" | "FULL" | "REMAINING">("ADVANCE");
  const [offlineMethod, setOfflineMethod] = useState<"CASH" | "UPI" | "BANK">("CASH");
  const [offlineReference, setOfflineReference] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupons, setAppliedCoupons] = useState<AppliedAdminCoupon[]>([]);
  const [showCouponInput, setShowCouponInput] = useState(true);
  const [couponDiscount, setCouponDiscount] = useState(0);
  const [couponApplying, setCouponApplying] = useState(false);
  const [couponError, setCouponError] = useState<string | null>(null);
  const lastCouponAutoRefreshKeyRef = useRef("");
  const couponAutoRefreshRequestIdRef = useRef(0);

  const [defaultAdvanceAmount, setDefaultAdvanceAmount] = useState(0);
  const [customAdvanceAmount, setCustomAdvanceAmount] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [paymentStatus, setPaymentStatus] = useState<
    "INITIALIZED" | "AWAITING_PAYMENT" | "PAID" | "FAILED" | "CANCELLED" | "EXPIRED" | "OFFLINE"
  >("AWAITING_PAYMENT");
  const [loadingEditData, setLoadingEditData] = useState(false);
  const [editPrefill, setEditPrefill] = useState<EditBookingResponse | null>(null);
  const [editProductsHydrated, setEditProductsHydrated] = useState(false);
  const [initialSlotId, setInitialSlotId] = useState<string | null>(null);
  const [initialFullPaid, setInitialFullPaid] = useState(false);
  const [initialAdvancePaid, setInitialAdvancePaid] = useState(0);
  const [slotOverrideModalOpen, setSlotOverrideModalOpen] = useState(false);
  const [slotOverridePendingRequest, setSlotOverridePendingRequest] =
    useState<AdminBookingMutationRequest | null>(null);
  const [slotOverrideLockContext, setSlotOverrideLockContext] =
    useState<SlotOverrideLockContext>("other_session");
  const [pendingOnlineCreateBooking, setPendingOnlineCreateBooking] =
    useState<PendingOnlineCreateBooking | null>(null);
  const [discardingPendingOnlineCreateBooking, setDiscardingPendingOnlineCreateBooking] =
    useState(false);

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      try {
        setLoadingBootData(true);
        const [locationsRes, occasionsRes, settingsRes] = await Promise.all([
          fetch("/api/locations"),
          fetch("/api/occasions"),
          fetch("/api/settings"),
        ]);

        const locationsJson = await locationsRes.json().catch(() => null);
        const occasionsJson = await occasionsRes.json().catch(() => null);
        const settingsJson = await settingsRes.json().catch(() => null);

        if (cancelled) return;

        if (locationsJson?.success && Array.isArray(locationsJson.data)) {
          setLocations(locationsJson.data);
        } else {
          toast.error("Failed to load locations.");
        }

        if (Array.isArray(occasionsJson)) {
          const normalized: OccasionOption[] = occasionsJson
            .filter((row) => row?.isActive)
            .map((row) => ({
              id: String(row.id),
              key: String(row.key),
              label: String(row.label),
              fields: Array.isArray(row.fields)
                ? row.fields.map((field: Record<string, unknown>) => ({
                    key: String(field.fieldKey),
                    label: String(field.label),
                    isRequired: Boolean(field.isRequired),
                    placeholder: field.placeholder ? String(field.placeholder) : "",
                  }))
                : [],
            }));
          setOccasions(normalized);
        } else {
          toast.error("Failed to load occasions.");
        }

        const parsed = parseAdvancePaymentAmount(
          settingsJson?.data?.[ADVANCE_PAYMENT_AMOUNT_KEY]
        );
        if (parsed !== null) {
          setDefaultAdvanceAmount(parsed);
          setCustomAdvanceAmount(parsed);
        } else {
          toast.error("Advance payment setting is missing or invalid.");
        }
      } finally {
        if (!cancelled) setLoadingBootData(false);
      }
    }

    void boot();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (mode !== "edit") return;
    if (!bookingId) return;

    let cancelled = false;

    async function loadBookingForEdit() {
      try {
        setLoadingEditData(true);
        const res = await fetch(`/api/admin/bookings/${bookingId}`);
        const json = await res.json().catch(() => null);
        if (cancelled) return;

        if (!res.ok || !json?.success || !json?.data) {
          toast.error(json?.message || "Failed to load booking details.");
          return;
        }

        const booking = json.data as EditBookingResponse;
        const normalizedOccasionData = Object.entries(booking.occasionData ?? {}).reduce(
          (acc, [key, value]) => {
            acc[key] = String(value ?? "");
            return acc;
          },
          {} as Record<string, string>
        );

        setEditPrefill(booking);
        setEditProductsHydrated(false);
        setInitialSlotId(booking.slotId);
        setInitialFullPaid(booking.payment.status === "PAID" && booking.pricing.remainingPayable <= 0);
        setInitialAdvancePaid(Math.max(Number(booking.pricing.advancePaid ?? 0), 0));

        setLocationId(booking.locationId);
        setDate(booking.date);
        setTheatreId(booking.theatreId);
        setSlotId(booking.slotId);

        setName(booking.customer.name ?? "");
        setPhone(normalizePhone(booking.customer.phone ?? ""));
        setEmail(booking.customer.email ?? "");
        setExistingUserId(booking.customer.userId ?? null);
        setExistingUserName(booking.customer.name ?? null);

        setDecorationRequired(Boolean(booking.decorationRequired));
        setOccasionKey(booking.occasionKey ?? "");
        setOccasionData(normalizedOccasionData);
        const prefilledCoupons = Array.isArray(booking.appliedCoupons)
          ? booking.appliedCoupons
              .map((coupon) => ({
                couponId: String(coupon.couponId),
                code: String(coupon.code).trim().toUpperCase(),
                discountAmount: Math.max(Number(coupon.discountAmount ?? 0), 0),
              }))
              .filter((coupon) => Boolean(coupon.code))
          : Array.isArray(booking.couponCodes)
          ? booking.couponCodes
              .map((code) => String(code).trim().toUpperCase())
              .filter(Boolean)
              .map((code) => ({
                couponId: code,
                code,
                discountAmount: 0,
              }))
          : String(booking.couponCode ?? "").trim()
          ? [
              {
                couponId: String(booking.couponCode ?? "").trim().toUpperCase(),
                code: String(booking.couponCode ?? "").trim().toUpperCase(),
                discountAmount: 0,
              },
            ]
          : [];
        setCouponCode("");
        setAppliedCoupons(prefilledCoupons);
        setShowCouponInput(prefilledCoupons.length === 0);
        setCouponDiscount(Math.max(Number(booking.pricing.discountAmount ?? 0), 0));
        setCouponError(null);

        setPaymentType(booking.payment.type);
        const mappedAmountMode: "ADVANCE" | "REMAINING" =
          booking.pricing.remainingPayable > 0 &&
          booking.payment.amountMode === "ADVANCE"
            ? "ADVANCE"
            : "REMAINING";
        setPaymentAmountMode(mappedAmountMode);
        setCustomAdvanceAmount(0);

        const normalizedOfflineMethod = booking.payment.offlineMethod;
        setOfflineMethod(
          normalizedOfflineMethod === "UPI" || normalizedOfflineMethod === "BANK"
            ? normalizedOfflineMethod
            : "CASH"
        );
        setOfflineReference(booking.payment.offlineReference ?? "");
        setPaymentStatus(booking.payment.status);
      } catch {
        if (!cancelled) {
          toast.error("Failed to load booking details.");
        }
      } finally {
        if (!cancelled) {
          setLoadingEditData(false);
        }
      }
    }

    void loadBookingForEdit();
    return () => {
      cancelled = true;
    };
  }, [mode, bookingId]);

  useEffect(() => {
    if (!locationId) {
      setProducts([]);
      setActiveVariants({});
      setProductSelections({});
      setLedDrafts({});
      setCouponCode("");
      setAppliedCoupons([]);
      setShowCouponInput(true);
      setCouponDiscount(0);
      setCouponError(null);
      return;
    }

    let cancelled = false;

    async function loadProducts() {
      try {
        setLoadingProducts(true);
        const prefillItems = mode === "edit" ? editPrefill?.items ?? [] : [];
        const selectedProductIds = new Set(prefillItems.map((item) => item.productId));
        const selectedVariantIds = new Set(prefillItems.map((item) => item.variantId));
        const isCreateMode = mode === "create";
        const query = new URLSearchParams({
          locationId,
          limit: "1000",
          ...(isCreateMode ? { isActive: "true" } : {}),
        });
        const res = await fetch(
          `/api/admin/products?${query.toString()}`
        );
        const json = await res.json().catch(() => null);
        if (cancelled) return;

        if (!res.ok || !json?.success || !Array.isArray(json.data)) {
          setProducts([]);
          toast.error("Failed to load products for selected location.");
          return;
        }

        const mappedRaw = json.data
          .map((product: Record<string, unknown>) => {
            const variants = Array.isArray(product.variants)
              ? product.variants
                  .filter((variant) => {
                    if (!variant) return false;
                    const variantId = String(variant.id);
                    if (isCreateMode) return Boolean(variant.isActive);
                    return Boolean(variant.isActive) || selectedVariantIds.has(variantId);
                  })
                  .map((variant) => ({
                    id: String(variant.id),
                    label: String(variant.label),
                    regularPrice: Number(variant.regularPrice ?? 0),
                    salePrice: variant.salePrice == null ? null : Number(variant.salePrice),
                    stock: Math.max(Number(variant.stock ?? 0), 0),
                    isDefault: Boolean(variant.isDefault),
                  }))
              : [];

            if (!isCreateMode) {
              const productId = String(product.id);
              const fallbackVariants = prefillItems
                .filter((item) => item.productId === productId)
                .filter((item) => !variants.some((variant) => variant.id === item.variantId))
                .map((item) => ({
                  id: item.variantId,
                  label: item.variantLabel ?? "Saved Variant",
                  regularPrice: Number(item.unitPrice ?? 0),
                  salePrice: null,
                  stock: 0,
                  isDefault: false,
                }));

              variants.push(...fallbackVariants);
            }

            return {
              id: String(product.id),
              name: String(product.name),
              slug: String(product.slug ?? ""),
              image: String(product.image ?? ""),
              category: String(product.category) as ProductOption["category"],
              isActive: Boolean(product.isActive),
              variants,
            };
          })
          .filter((product: { id: string; isActive: boolean; variants: ProductOption["variants"] }) => {
            if (isCreateMode) {
              return product.variants.length > 0;
            }
            return product.variants.length > 0 && (product.isActive || selectedProductIds.has(product.id));
          });

        if (!isCreateMode) {
          const existingProductIds = new Set(
            mappedRaw.map((product: { id: string }) => product.id)
          );

          const syntheticProducts = prefillItems
            .filter((item) => !existingProductIds.has(item.productId))
            .map((item) => ({
              id: item.productId,
              name: item.productName ?? "Saved Product",
              slug: `saved-${item.productId}`,
              image: "",
              category: item.category ?? "GIFT",
              isActive: false,
              variants: [
                {
                  id: item.variantId,
                  label: item.variantLabel ?? "Saved Variant",
                  regularPrice: Number(item.unitPrice ?? 0),
                  salePrice: null,
                  stock: 0,
                  isDefault: true,
                },
              ],
            }));

          mappedRaw.push(...syntheticProducts);
        }

        const dedupeVariants = (
          variants: Array<{
            id: string;
            label: string;
            regularPrice: number;
            salePrice: number | null;
            stock: number;
            isDefault: boolean;
          }>
        ) => {
          const variantByLabel = new Map<string, (typeof variants)[number]>();
          variants.forEach((variant) => {
            const labelKey = variant.label.trim().toLowerCase();
            const current = variantByLabel.get(labelKey);
            if (!current) {
              variantByLabel.set(labelKey, variant);
              return;
            }

            const currentIsSelected = selectedVariantIds.has(current.id);
            const nextIsSelected = selectedVariantIds.has(variant.id);
            if (!currentIsSelected && nextIsSelected) {
              variantByLabel.set(labelKey, variant);
            }
          });

          return Array.from(variantByLabel.values());
        };

        type MappedProduct = {
          id: string;
          name: string;
          slug: string;
          image: string;
          category: ProductOption["category"];
          isActive: boolean;
          variants: ProductOption["variants"];
        };

        const mergedRaw: MappedProduct[] = Array.from(
          mappedRaw.reduce(
            (
              acc: Map<string, MappedProduct>,
              product: MappedProduct
            ) => {
              const existing = acc.get(product.id);
              if (!existing) {
                acc.set(product.id, {
                  ...product,
                  variants: dedupeVariants([...product.variants]),
                });
                return acc;
              }

              const variantById = new Map(
                existing.variants.map((variant) => [variant.id, variant])
              );
              product.variants.forEach((variant) => {
                if (!variantById.has(variant.id)) {
                  variantById.set(variant.id, variant);
                }
              });

              existing.variants = dedupeVariants(Array.from(variantById.values()));
              existing.isActive = existing.isActive || product.isActive;
              if (!existing.image && product.image) existing.image = product.image;
              if (existing.name === "Saved Product" && product.name) existing.name = product.name;
              if (existing.slug.startsWith("saved-") && !product.slug.startsWith("saved-")) {
                existing.slug = product.slug;
              }

              acc.set(product.id, existing);
              return acc;
            },
            new Map<string, MappedProduct>()
          )
            .values()
        );

        const mapped: ProductOption[] = mergedRaw.map((product: MappedProduct) => {
          const { isActive, ...normalizedProduct } = product;
          void isActive;
          return normalizedProduct;
        });

        setProducts(mapped);
      } catch {
        if (!cancelled) {
          setProducts([]);
          toast.error("Failed to load products.");
        }
      } finally {
        if (!cancelled) setLoadingProducts(false);
      }
    }

    void loadProducts();
    return () => {
      cancelled = true;
    };
  }, [locationId, mode, editPrefill]);

  useEffect(() => {
    if (!locationId || !date) {
      setTheatres([]);
      return;
    }

    let cancelled = false;

    async function loadTheatres() {
      try {
        setLoadingTheatres(true);
        const res = await fetch(
          `/api/theatres?locationId=${encodeURIComponent(locationId)}&date=${encodeURIComponent(date)}`,
          { credentials: "include" }
        );
        const json = await res.json().catch(() => null);
        if (cancelled) return;

        const apiTheatres = json?.data?.theatres;
        if (!res.ok || !Array.isArray(apiTheatres)) {
          setTheatres([]);
          toast.error("Failed to load theatres for selected date.");
          return;
        }

        const normalized: TheatreOption[] = apiTheatres.map((theatre: Record<string, unknown>) => {
          const rawSlots = Array.isArray(theatre.slots) ? theatre.slots : [];
          const slots: SlotOption[] = rawSlots.map((slot) => {
            const startTime = String(slot.startTime ?? "");
            const endTime = String(slot.endTime ?? "");
            const rawStatus = String(slot.status ?? "DISABLED") as "AVAILABLE" | "LOCKED" | "BOOKED" | "DISABLED";
            const expired = Boolean(slot.isExpired);

            const status: SlotStatus = expired ? "EXPIRED" : rawStatus;
            const statusLabel =
              typeof slot.statusLabel === "string" && slot.statusLabel.length > 0
                ? String(slot.statusLabel)
                : toTitleStatus(status);

            return {
              id: String(slot.id),
              startTime,
              endTime,
              basePrice: Number(slot.basePrice ?? 0),
              finalPrice: Number(slot.finalPrice ?? slot.basePrice ?? 0),
              decorationMandatory: Boolean(slot.decorationMandatory),
              status,
              statusLabel: expired ? "Expired" : statusLabel,
            };
          });

          return {
            id: String(theatre.id),
            name: String(theatre.name),
            capacity: Number(theatre.capacity ?? 0),
            baseGuests: Number(theatre.baseGuests ?? 0),
            extraPersonPrice: Number(theatre.extraPersonPrice ?? 0),
            decorationPrice: Number(theatre.decorationPrice ?? 0),
            slots,
          };
        });

        setTheatres(normalized);
      } catch {
        if (!cancelled) {
          setTheatres([]);
          toast.error("Failed to load theatres.");
        }
      } finally {
        if (!cancelled) setLoadingTheatres(false);
      }
    }

    void loadTheatres();
    return () => {
      cancelled = true;
    };
  }, [locationId, date, defaultAdvanceAmount]);

  useEffect(() => {
    if (!theatreId) return;
    if (loadingTheatres) return;
    if (theatres.length === 0) return;
    if (!theatres.some((theatre) => theatre.id === theatreId)) {
      setTheatreId("");
      setSlotId("");
    }
  }, [theatreId, theatres, loadingTheatres]);

  const selectedTheatre = useMemo(
    () => theatres.find((theatre) => theatre.id === theatreId) ?? null,
    [theatreId, theatres]
  );
  const selectedLocation = useMemo(
    () => locations.find((location) => location.id === locationId) ?? null,
    [locations, locationId]
  );
  const theatreSlots = useMemo(() => selectedTheatre?.slots ?? [], [selectedTheatre]);
  const selectedSlot = useMemo(
    () => theatreSlots.find((slot) => slot.id === slotId) ?? null,
    [slotId, theatreSlots]
  );
  const slotConflictMessage = useMemo(() => {
    const conflict = getSlotConflictMessage(selectedSlot);
    if (!conflict) return null;

    if (mode === "edit" && initialSlotId && slotId === initialSlotId) {
      return null;
    }
    return conflict;
  }, [selectedSlot, mode, initialSlotId, slotId]);
  const dateHoverHint = useMemo(() => getDateHoverHint(locationId), [locationId]);
  const theatreHoverHint = useMemo(
    () => getTheatreHoverHint(locationId, date),
    [locationId, date]
  );
  const slotHoverHint = useMemo(
    () =>
      getSlotHoverHint({
        locationId,
        date,
        theatreId,
        slotId,
        slotConflictMessage,
      }),
    [locationId, date, theatreId, slotId, slotConflictMessage]
  );

  const selectedOccasion = useMemo(
    () => occasions.find((occasion) => occasion.key === occasionKey) ?? null,
    [occasionKey, occasions]
  );

  useEffect(() => {
    if (mode !== "edit") return;
    if (!editPrefill) return;
    if (!selectedTheatre) return;

    const maxExtraGuests = Math.max(selectedTheatre.capacity - selectedTheatre.baseGuests, 0);
    const desiredExtraGuests = Math.max(editPrefill.guestCount - selectedTheatre.baseGuests, 0);
    setExtraGuestCount(Math.min(desiredExtraGuests, maxExtraGuests));
  }, [mode, editPrefill, selectedTheatre]);

  useEffect(() => {
    if (mode !== "edit") return;
    if (!editPrefill) return;
    if (editProductsHydrated) return;
    if (!locationId) return;

    const nextSelections: ProductSelectionMap = {};
    const nextActiveVariants: ActiveVariantMap = {};
    const nextLedDrafts: LedDraftMap = {};
    const fallbackLedNumbers = extractLedNumbersFromOccasionData(editPrefill.occasionData);
    let fallbackLedIndex = 0;

    editPrefill.items.forEach((item) => {
      if (!item.productId || !item.variantId || item.quantity <= 0) return;
      const key = getSelectionKey(item.productId, item.variantId);
      const itemLooksLikeLed = isNumberDecorationProduct({
        slug: undefined,
        name: `${item.productName ?? ""} ${item.variantLabel ?? ""}`,
      });
      const ledNumber =
        item.ledNumber ??
        (itemLooksLikeLed && fallbackLedNumbers.length > 0
          ? fallbackLedNumbers[Math.min(fallbackLedIndex++, fallbackLedNumbers.length - 1)]
          : "");
      nextSelections[key] = {
        quantity: item.quantity,
        ledNumber,
      };
      nextActiveVariants[item.productId] = item.variantId;
      if (ledNumber) {
        nextLedDrafts[key] = ledNumber;
      }
    });

    setProductSelections(nextSelections);
    setActiveVariants((prev) => ({
      ...prev,
      ...nextActiveVariants,
    }));
    setLedDrafts(nextLedDrafts);
    setEditProductsHydrated(true);
  }, [mode, editPrefill, editProductsHydrated, locationId]);

  const productsByCategory = useMemo(
    () => ({
      CAKE: products.filter((product) => product.category === "CAKE"),
      DECORATION: products.filter((product) => product.category === "DECORATION"),
      GIFT: products.filter((product) => product.category === "GIFT"),
    }),
    [products]
  );

  const minimumAdvanceAmount = useMemo(
    () => defaultAdvanceAmount,
    [defaultAdvanceAmount]
  );

  useEffect(() => {
    if (isEditMode) return;
    setCustomAdvanceAmount((prev) => Math.max(prev, minimumAdvanceAmount));
  }, [minimumAdvanceAmount, isEditMode]);

  const isDecorationMandatory = Boolean(selectedSlot?.decorationMandatory);

  useEffect(() => {
    if (isDecorationMandatory) {
      setDecorationRequired(true);
    }
  }, [isDecorationMandatory]);

  const guestCount = useMemo(() => {
    if (!selectedTheatre) return 0;
    return selectedTheatre.baseGuests + Math.max(extraGuestCount, 0);
  }, [selectedTheatre, extraGuestCount]);
  const guestsForControl = useMemo(() => {
    if (!selectedTheatre) return 0;
    return Math.min(
      Math.max(guestCount, selectedTheatre.baseGuests),
      selectedTheatre.capacity
    );
  }, [selectedTheatre, guestCount]);
  const canDecreaseGuests = useMemo(() => {
    if (!selectedTheatre) return false;
    return guestsForControl > selectedTheatre.baseGuests;
  }, [selectedTheatre, guestsForControl]);
  const canIncreaseGuests = useMemo(() => {
    if (!selectedTheatre) return false;
    return guestsForControl < selectedTheatre.capacity;
  }, [selectedTheatre, guestsForControl]);

  const productById = useMemo(() => {
    return new Map(products.map((product) => [product.id, product]));
  }, [products]);

  const prefillItemByKey = useMemo(() => {
    const map = new Map<
      string,
      {
        productId: string;
        variantId: string;
        productName?: string;
        variantLabel?: string;
        category?: ProductOption["category"];
        unitPrice?: number;
        quantity: number;
        ledNumber?: string | null;
      }
    >();

    if (mode !== "edit" || !editPrefill) return map;

    editPrefill.items.forEach((item) => {
      const key = getSelectionKey(item.productId, item.variantId);
      map.set(key, item);
    });

    return map;
  }, [mode, editPrefill]);

  useEffect(() => {
    setActiveVariants((prev) => {
      let changed = false;
      const next: ActiveVariantMap = { ...prev };
      const validProductIds = new Set(products.map((product) => product.id));

      products.forEach((product) => {
        const defaultVariant =
          product.variants.find((variant) => variant.isDefault) ?? product.variants[0];
        if (!defaultVariant) return;

        const current = next[product.id];
        const isValidCurrent = product.variants.some((variant) => variant.id === current);
        if (!isValidCurrent) {
          next[product.id] = defaultVariant.id;
          changed = true;
        }
      });

      Object.keys(next).forEach((productId) => {
        if (!validProductIds.has(productId)) {
          delete next[productId];
          changed = true;
        }
      });

      return changed ? next : prev;
    });
  }, [products]);

  const selectedProductItems = useMemo(() => {
    const items: SelectedProductSummaryItem[] = [];

    Object.entries(productSelections).forEach(([key, selection]) => {
      if (selection.quantity <= 0) return;
      const [productId, variantId] = key.split(":");
      if (!productId || !variantId) return;

      const product = productById.get(productId);
      if (!product) {
        const fallback = prefillItemByKey.get(key);
        if (!fallback) return;

        const fallbackUnitPrice = Number(fallback.unitPrice ?? 0);
        items.push({
          key,
          productId,
          variantId,
          category: fallback.category ?? "GIFT",
          productName: fallback.productName ?? "Saved Product",
          variantLabel: fallback.variantLabel ?? "Saved Variant",
          quantity: selection.quantity,
          unitPrice: fallbackUnitPrice,
          totalPrice: fallbackUnitPrice * selection.quantity,
          ledNumber: selection.ledNumber ?? fallback.ledNumber ?? undefined,
        });
        return;
      }

      const variant = product.variants.find((entry) => entry.id === variantId);
      if (!variant) {
        const fallback = prefillItemByKey.get(key);
        if (!fallback) return;

        const fallbackUnitPrice = Number(fallback.unitPrice ?? 0);
        items.push({
          key,
          productId,
          variantId,
          category: fallback.category ?? product.category,
          productName: fallback.productName ?? product.name,
          variantLabel: fallback.variantLabel ?? "Saved Variant",
          quantity: selection.quantity,
          unitPrice: fallbackUnitPrice,
          totalPrice: fallbackUnitPrice * selection.quantity,
          ledNumber: selection.ledNumber ?? fallback.ledNumber ?? undefined,
        });
        return;
      }

      const unitPrice = getVariantPrice(variant);
      items.push({
        key,
        productId,
        variantId,
        category: product.category,
        productName: product.name,
        variantLabel: variant.label,
        quantity: selection.quantity,
        unitPrice,
        totalPrice: unitPrice * selection.quantity,
        ledNumber: selection.ledNumber,
      });
    });

    return items;
  }, [productSelections, productById, prefillItemByKey]);

  const productsAmount = useMemo(() => {
    return selectedProductItems.reduce((sum, item) => sum + item.totalPrice, 0);
  }, [selectedProductItems]);

  const pricingBase = useMemo<PricingSummary | null>(() => {
    if (!selectedTheatre || !selectedSlot) return null;

    return calculateBookingPricing({
      slotBasePrice: selectedSlot.basePrice,
      slotFinalPrice: selectedSlot.finalPrice,
      guestCount,
      theatreBaseGuests: selectedTheatre.baseGuests,
      theatreExtraPersonPrice: selectedTheatre.extraPersonPrice,
      theatreDecorationPrice: selectedTheatre.decorationPrice,
      slotDecorationMandatory: isDecorationMandatory,
      decorationRequired,
      productsAmount,
      discountAmount: 0,
      advancePaid: 0,
    });
  }, [
    selectedTheatre,
    selectedSlot,
    isDecorationMandatory,
    guestCount,
    decorationRequired,
    productsAmount,
  ]);

  const totalAfterDiscount = useMemo(() => {
    if (!pricingBase) return 0;
    return Math.max(pricingBase.totalAmount - couponDiscount, 0);
  }, [pricingBase, couponDiscount]);

  const editAdvancePaidAlready = useMemo(() => {
    if (!isEditMode) return 0;
    return Math.min(initialAdvancePaid, totalAfterDiscount);
  }, [isEditMode, initialAdvancePaid, totalAfterDiscount]);

  const editRemainingBeforeCollection = useMemo(() => {
    if (!isEditMode) return 0;
    return Math.max(totalAfterDiscount - editAdvancePaidAlready, 0);
  }, [isEditMode, totalAfterDiscount, editAdvancePaidAlready]);

  const pricing = useMemo<PricingSummary | null>(() => {
    if (!selectedTheatre || !selectedSlot || !pricingBase) return null;

    const normalizedAdvanceInput = Math.max(customAdvanceAmount, 0);
    let desiredAdvance: number;

    if (isEditMode) {
      const additionalToCollect =
        paymentAmountMode === "REMAINING"
          ? editRemainingBeforeCollection
          : normalizedAdvanceInput;
      desiredAdvance = Math.min(
        editAdvancePaidAlready + additionalToCollect,
        totalAfterDiscount
      );
    } else {
      desiredAdvance =
        paymentAmountMode === "FULL"
          ? totalAfterDiscount
          : normalizedAdvanceInput;
    }

    return calculateBookingPricing({
      slotBasePrice: selectedSlot.basePrice,
      slotFinalPrice: selectedSlot.finalPrice,
      guestCount,
      theatreBaseGuests: selectedTheatre.baseGuests,
      theatreExtraPersonPrice: selectedTheatre.extraPersonPrice,
      theatreDecorationPrice: selectedTheatre.decorationPrice,
      slotDecorationMandatory: isDecorationMandatory,
      decorationRequired,
      productsAmount,
      discountAmount: couponDiscount,
      advancePaid: desiredAdvance,
    });
  }, [
    pricingBase,
    selectedTheatre,
    selectedSlot,
    isDecorationMandatory,
    guestCount,
    decorationRequired,
    productsAmount,
    isEditMode,
    totalAfterDiscount,
    editAdvancePaidAlready,
    editRemainingBeforeCollection,
    paymentAmountMode,
    customAdvanceAmount,
    couponDiscount,
  ]);

  const amountPayNow = useMemo(() => {
    const normalizedAdvanceInput = Math.max(customAdvanceAmount, 0);
    if (isEditMode) {
      if (!pricing) return normalizedAdvanceInput;
      return Math.max(pricing.advancePaid - editAdvancePaidAlready, 0);
    }
    if (paymentAmountMode === "FULL") return pricing?.totalAmount ?? 0;
    return normalizedAdvanceInput;
  }, [
    isEditMode,
    paymentAmountMode,
    pricing,
    customAdvanceAmount,
    editAdvancePaidAlready,
  ]);

  const effectiveDecorationRequired = isDecorationMandatory ? true : decorationRequired;

  const hasPriceImpactingChanges = useMemo(() => {
    if (!isEditMode || !editPrefill) return false;

    const slotChanged = slotId !== editPrefill.slotId;
    const guestChanged = guestCount !== editPrefill.guestCount;
    const decorationChanged =
      effectiveDecorationRequired !== Boolean(editPrefill.decorationRequired);

    const initialProductQty = new Map<string, number>();
    editPrefill.items.forEach((item) => {
      if (!item.productId || !item.variantId) return;
      if (!Number.isFinite(item.quantity) || item.quantity <= 0) return;
      const key = `${item.productId}:${item.variantId}`;
      initialProductQty.set(key, (initialProductQty.get(key) ?? 0) + item.quantity);
    });

    const currentProductQty = new Map<string, number>();
    selectedProductItems.forEach((item) => {
      const key = `${item.productId}:${item.variantId}`;
      currentProductQty.set(key, (currentProductQty.get(key) ?? 0) + item.quantity);
    });

    let productsChanged = initialProductQty.size !== currentProductQty.size;
    if (!productsChanged) {
      for (const [key, qty] of currentProductQty.entries()) {
        if ((initialProductQty.get(key) ?? 0) !== qty) {
          productsChanged = true;
          break;
        }
      }
    }

    const initialCoupons = (
      Array.isArray(editPrefill.appliedCoupons)
        ? editPrefill.appliedCoupons.map((coupon) => String(coupon.code).trim().toUpperCase())
        : Array.isArray(editPrefill.couponCodes)
        ? editPrefill.couponCodes.map((code) => String(code).trim().toUpperCase())
        : String(editPrefill.couponCode ?? "").trim()
        ? [String(editPrefill.couponCode ?? "").trim().toUpperCase()]
        : []
    )
      .filter(Boolean)
      .sort();

    const currentCoupons = appliedCoupons
      .map((coupon) => coupon.code.trim().toUpperCase())
      .filter(Boolean)
      .sort();

    const couponsChanged =
      initialCoupons.length !== currentCoupons.length ||
      initialCoupons.some((coupon, index) => coupon !== currentCoupons[index]);

    return slotChanged || guestChanged || decorationChanged || productsChanged || couponsChanged;
  }, [
    isEditMode,
    editPrefill,
    slotId,
    guestCount,
    effectiveDecorationRequired,
    selectedProductItems,
    appliedCoupons,
  ]);

  const hasCollectionAmountChange = isEditMode && amountPayNow > 0;
  const hasPaymentPreviewChanges = hasPriceImpactingChanges || hasCollectionAmountChange;
  const isEditFullyPaidForCurrentPricing =
    isEditMode && editAdvancePaidAlready >= totalAfterDiscount;
  const isPaymentSectionLocked =
    isEditMode && isEditFullyPaidForCurrentPricing && !hasPriceImpactingChanges;

  const appliedCouponCodes = useMemo(
    () =>
      appliedCoupons
        .map((coupon) => coupon.code.trim().toUpperCase())
        .filter(Boolean),
    [appliedCoupons]
  );
  const couponIdentityGate = useMemo(
    () =>
      resolveCouponIdentityGate({
        phone,
        email,
        userId: existingUserId,
      }),
    [phone, email, existingUserId]
  );

  const pricingCouponRefreshKey = useMemo(() => {
    const normalizedPhone = normalizePhone(phone);
    const productSignature = selectedProductItems
      .map((item) => `${item.productId}:${item.variantId}:${item.quantity}:${item.totalPrice}`)
      .sort()
      .join("|");

    return [
      selectedSlot?.id ?? "",
      existingUserId ?? "",
      normalizedPhone,
      String(pricingBase?.totalAmount ?? 0),
      String(pricingBase?.productsAmount ?? 0),
      String(pricingBase?.extrasAmount ?? 0),
      productSignature,
    ].join("::");
  }, [selectedSlot?.id, existingUserId, phone, pricingBase, selectedProductItems]);

  function clearAppliedCouponState() {
    setCouponCode("");
    setAppliedCoupons([]);
    setShowCouponInput(true);
    setCouponDiscount(0);
    setCouponApplying(false);
    setCouponError(null);
  }

  const previewCoupons = useCallback(async (couponCodes: string[]) => {
    if (!selectedSlot || !pricingBase) {
      setCouponError("Select location, theatre and slot before applying coupon.");
      return { success: false, appliedCodes: new Set<string>() };
    }

    const normalizedCodes = couponCodes
      .map((code) => code.trim().toUpperCase())
      .filter(Boolean);

    if (normalizedCodes.length === 0) {
      setAppliedCoupons([]);
      setCouponDiscount(0);
      setCouponError(null);
      return { success: true, appliedCodes: new Set<string>() };
    }

    const res = await fetch("/api/admin/bookings/coupon-preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        couponCodes: normalizedCodes,
        slotId: selectedSlot.id,
        userId: existingUserId,
        userPhone: normalizePhone(phone),
        decorationRequired: effectiveDecorationRequired,
        items: selectedProductItems.map((item) => ({
          productId: item.productId,
          category: item.category,
          totalPrice: item.totalPrice,
        })),
        amounts: {
          bookingSubtotal: pricingBase.totalAmount,
          slotAmount: pricingBase.baseAmount,
          nonSlotAmount:
            pricingBase.extrasAmount +
            pricingBase.decorationAmount +
            pricingBase.productsAmount,
          productsTotal: pricingBase.productsAmount,
          extrasTotal: pricingBase.extrasAmount,
        },
      }),
    });

    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.success) {
      setCouponError(json?.message ?? "Unable to apply coupon.");
      return { success: false, appliedCodes: new Set<string>() };
    }

    const discountAmount = Math.max(Number(json.data?.discountAmount ?? 0), 0);
    const nextAppliedCoupons = Array.isArray(json.data?.appliedCoupons)
      ? json.data.appliedCoupons
          .map((coupon: Record<string, unknown>) => ({
            couponId: String(coupon.couponId ?? coupon.code ?? ""),
            code: String(coupon.code ?? "").trim().toUpperCase(),
            discountAmount: Math.max(Number(coupon.discountAmount ?? 0), 0),
          }))
          .filter((coupon: AppliedAdminCoupon) => Boolean(coupon.code))
      : [];

    setAppliedCoupons(nextAppliedCoupons);
    setCouponDiscount(discountAmount);
    setCouponError(null);
    return {
      success: true,
      appliedCodes: new Set(nextAppliedCoupons.map((coupon: AppliedAdminCoupon) => coupon.code)),
    };
  }, [
    selectedSlot,
    pricingBase,
    existingUserId,
    phone,
    selectedProductItems,
    effectiveDecorationRequired,
  ]);

  async function applyCouponCode() {
    const normalizedCode = couponCode.trim().toUpperCase();
    if (couponIdentityGate.locked) {
      setCouponError(null);
      return;
    }
    if (!normalizedCode) {
      setCouponError("Enter coupon code.");
      return;
    }

    if (appliedCoupons.some((coupon) => coupon.code === normalizedCode)) {
      setCouponError("This coupon is already applied.");
      return;
    }

    try {
      setCouponApplying(true);
      setCouponError(null);

      const result = await previewCoupons([
        ...appliedCoupons.map((coupon) => coupon.code),
        normalizedCode,
      ]);
      if (!result.success) return;
      if (!result.appliedCodes.has(normalizedCode)) {
        setCouponError("This coupon is not applicable for the current booking details.");
        return;
      }
      setCouponCode("");
      setShowCouponInput(false);
      toast.success(`Coupon ${normalizedCode} applied.`);
    } catch {
      setCouponError("Unable to apply coupon.");
    } finally {
      setCouponApplying(false);
    }
  }

  useEffect(() => {
    if (appliedCouponCodes.length === 0) {
      lastCouponAutoRefreshKeyRef.current = "";
      setCouponApplying(false);
      return;
    }
    if (!selectedSlot || !pricingBase) return;
    if (couponApplying) return;

    const autoRefreshKey = `${appliedCouponCodes.join("|")}::${pricingCouponRefreshKey}`;
    if (lastCouponAutoRefreshKeyRef.current === autoRefreshKey) return;
    lastCouponAutoRefreshKeyRef.current = autoRefreshKey;

    const requestId = ++couponAutoRefreshRequestIdRef.current;
    setCouponApplying(true);
    void previewCoupons(appliedCouponCodes).finally(() => {
      if (couponAutoRefreshRequestIdRef.current === requestId) {
        setCouponApplying(false);
      }
    });
  }, [
    appliedCouponCodes,
    pricingCouponRefreshKey,
    selectedSlot,
    pricingBase,
    couponApplying,
    previewCoupons,
  ]);

  function handleLocationDateChange(nextLocationId: string, nextDate: string) {
    clearAppliedCouponState();
    if (nextLocationId !== locationId) {
      const resolvedNextDate = nextLocationId ? nextDate : "";
      setLocationId(nextLocationId);
      setDate(resolvedNextDate);
      setTheatreId("");
      setSlotId("");
      setTheatres([]);
      setProducts([]);
      setActiveVariants({});
      setProductSelections({});
      setLedDrafts({});
      setExtraGuestCount(0);
      setEditProductsHydrated(false);
      return;
    }

    setDate(nextDate);
    setTheatreId("");
    setSlotId("");
    setExtraGuestCount(0);
    setEditProductsHydrated(false);
  }

  function handleTheatreSlotChange(nextTheatreId: string, nextSlotId: string) {
    clearAppliedCouponState();
    if (nextTheatreId !== theatreId) {
      setTheatreId(nextTheatreId);
      setSlotId(nextSlotId);
      setExtraGuestCount(0);
      return;
    }
    setSlotId(nextSlotId);
  }

  function incrementGuests() {
    if (!selectedTheatre) return;
    if (!canIncreaseGuests) return;
    const nextTotalGuests = guestsForControl + 1;
    setExtraGuestCount(nextTotalGuests - selectedTheatre.baseGuests);
  }

  function decrementGuests() {
    if (!selectedTheatre) return;
    if (!canDecreaseGuests) return;
    const nextTotalGuests = guestsForControl - 1;
    setExtraGuestCount(nextTotalGuests - selectedTheatre.baseGuests);
  }

  function handleDecorationRequiredChange(value: boolean) {
    setDecorationRequired(value);
    if (!value) {
      setOccasionKey("");
      setOccasionData({});
    }
  }

  function handlePaymentAmountModeChange(nextMode: "ADVANCE" | "FULL" | "REMAINING") {
    setPaymentAmountMode(nextMode);
    if (!isEditMode) return;

    if (nextMode === "REMAINING") {
      setCustomAdvanceAmount(editRemainingBeforeCollection);
      return;
    }

    setCustomAdvanceAmount(0);
  }

  function onOccasionChange(nextOccasionKey: string) {
    setOccasionKey(nextOccasionKey);
    const occasion = occasions.find((entry) => entry.key === nextOccasionKey);
    if (!occasion) {
      setOccasionData({});
      return;
    }
    setOccasionData((prev) => {
      const next: Record<string, string> = {};
      occasion.fields.forEach((field) => {
        next[field.key] = prev[field.key] ?? "";
      });
      return next;
    });
  }

  function updateOccasionField(key: string, value: string) {
    setOccasionData((prev) => ({ ...prev, [key]: value }));
  }

  const getActiveVariantId = useCallback((product: ProductOption) => {
    const configured = activeVariants[product.id];
    if (configured && product.variants.some((variant) => variant.id === configured)) {
      return configured;
    }

    const selectedVariantId = Object.entries(productSelections).find(
      ([selectionKey, selection]) => {
        if (selection.quantity <= 0) return false;
        const [selectedProductId, selectedVariantIdFromKey] = selectionKey.split(":");
        if (selectedProductId !== product.id || !selectedVariantIdFromKey) return false;
        return product.variants.some((variant) => variant.id === selectedVariantIdFromKey);
      }
    )?.[0]?.split(":")[1];

    if (selectedVariantId) {
      return selectedVariantId;
    }

    const defaultVariant =
      product.variants.find((variant) => variant.isDefault) ?? product.variants[0];
    return defaultVariant?.id ?? "";
  }, [activeVariants, productSelections]);

  const getVariantSelection = useCallback((productId: string, variantId: string): ProductLineSelection => {
    if (!variantId) {
      return EMPTY_PRODUCT_SELECTION;
    }
    return productSelections[getSelectionKey(productId, variantId)] ?? EMPTY_PRODUCT_SELECTION;
  }, [productSelections]);

  const getLedDraftValue = useCallback((productId: string, variantId: string, savedValue?: string) => {
    const key = getSelectionKey(productId, variantId);
    return ledDrafts[key] ?? savedValue ?? "";
  }, [ledDrafts]);

  const setLedDraftValue = useCallback((productId: string, variantId: string, value: string) => {
    const key = getSelectionKey(productId, variantId);
    const clean = value.replace(/\D/g, "").slice(0, 3);
    setLedDrafts((prev) => ({
      ...prev,
      [key]: clean,
    }));
  }, []);

  const upsertProductSelection = useCallback((
    productId: string,
    variantId: string,
    next: ProductLineSelection
  ) => {
    const key = getSelectionKey(productId, variantId);
    setProductSelections((prev) => {
      if (!variantId || next.quantity <= 0) {
        const clone = { ...prev };
        delete clone[key];
        return clone;
      }
      return {
        ...prev,
        [key]: {
          ...next,
          ledNumber: next.ledNumber?.replace(/\D/g, "").slice(0, 3) ?? "",
        },
      };
    });
  }, []);

  const onVariantChange = useCallback((product: ProductOption, variantId: string) => {
    setActiveVariants((prev) => ({
      ...prev,
      [product.id]: variantId,
    }));
  }, []);

  const getVariantMaxAllowed = useCallback((product: ProductOption, variantId: string) => {
    const variant = product.variants.find((entry) => entry.id === variantId);
    if (!variant) return 0;

    const stockCap = Math.max(Number(variant.stock ?? 0), 0);
    if (stockCap <= 0) return 0;

    if (product.category === "DECORATION") {
      return Math.min(stockCap, 1);
    }
    return stockCap;
  }, []);

  const incrementQuantity = useCallback((product: ProductOption) => {
    const variantId = getActiveVariantId(product);
    if (!variantId) return;
    const maxAllowed = getVariantMaxAllowed(product, variantId);
    if (maxAllowed <= 0) {
      toast.error("This item is currently out of stock.");
      return;
    }

    if (product.category === "DECORATION") {
      const current = getVariantSelection(product.id, variantId);
      if (current.quantity >= maxAllowed) {
        toast.error("Only one unit can be added for this decoration.");
        return;
      }
      upsertProductSelection(product.id, variantId, {
        ...current,
        quantity: 1,
      });
      return;
    }
    const current = getVariantSelection(product.id, variantId);
    if (current.quantity >= maxAllowed) {
      toast.error(`You can add up to ${maxAllowed} units for this item.`);
      return;
    }
    upsertProductSelection(product.id, variantId, {
      ...current,
      quantity: current.quantity + 1,
    });
  }, [getActiveVariantId, getVariantMaxAllowed, getVariantSelection, upsertProductSelection]);

  const decrementQuantity = useCallback((product: ProductOption) => {
    const variantId = getActiveVariantId(product);
    if (!variantId) return;
    if (product.category === "DECORATION") return;
    const current = getVariantSelection(product.id, variantId);
    upsertProductSelection(product.id, variantId, {
      ...current,
      quantity: Math.max(current.quantity - 1, 0),
    });
  }, [getActiveVariantId, getVariantSelection, upsertProductSelection]);

  const toggleDecoration = useCallback((product: ProductOption) => {
    const variantId = getActiveVariantId(product);
    if (!variantId) return;
    const current = getVariantSelection(product.id, variantId);
    if (current.quantity <= 0) {
      const maxAllowed = getVariantMaxAllowed(product, variantId);
      if (maxAllowed <= 0) {
        toast.error("This item is currently out of stock.");
        return;
      }
    }
    upsertProductSelection(product.id, variantId, {
      ...current,
      quantity: current.quantity > 0 ? 0 : 1,
    });
  }, [getActiveVariantId, getVariantMaxAllowed, getVariantSelection, upsertProductSelection]);

  const setLedNumber = useCallback((product: ProductOption, value: string) => {
    const variantId = getActiveVariantId(product);
    if (!variantId) return;
    const current = getVariantSelection(product.id, variantId);
    const clean = value.replace(/\D/g, "").slice(0, 3);
    upsertProductSelection(product.id, variantId, {
      ...current,
      ledNumber: clean,
    });
    setLedDraftValue(product.id, variantId, clean);
  }, [getActiveVariantId, getVariantSelection, setLedDraftValue, upsertProductSelection]);

  function removeSelectedProduct(selectionKey: string) {
    setProductSelections((prev) => {
      const next = { ...prev };
      delete next[selectionKey];
      return next;
    });
    setLedDrafts((prev) => {
      const next = { ...prev };
      delete next[selectionKey];
      return next;
    });
  }

  async function handlePhoneBlur() {
    const normalized = normalizePhone(phone);
    setPhone(normalized);
    setExistingUserId(null);
    setExistingUserName(null);

    if (!isValidPhone(normalized)) return;

    try {
      setLookingUpUser(true);
      const res = await fetch("/api/admin/bookings/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "LOOKUP_USER",
          phone: normalized,
        }),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) return;

      if (json.data?.exists && json.data?.user) {
        const user = json.data.user as {
          id: string;
          name: string;
          email: string | null;
        };
        setExistingUserId(user.id);
        setExistingUserName(user.name);
        if (!name.trim()) setName(user.name ?? "");
        if (!email.trim() && user.email) setEmail(user.email);
      }
    } finally {
      setLookingUpUser(false);
    }
  }

  function buildFormErrors(options?: { enforceAdvanceNumeric?: boolean }) {
    const { enforceAdvanceNumeric = true } = options ?? {};
    const nextErrors: Record<string, string> = {};

    if (!locationId) nextErrors.locationId = "Location is required.";
    if (!date) nextErrors.date = "Date is required.";
    if (!theatreId) nextErrors.theatreId = "Theatre is required.";
    if (!slotId) nextErrors.slotId = "Slot is required.";
    if (slotConflictMessage) nextErrors.slotStatus = slotConflictMessage;
    if (!name.trim()) nextErrors.name = "Name is required.";

    const normalized = normalizePhone(phone);
    if (!isValidPhone(normalized)) {
      nextErrors.phone = "Enter a valid 10-digit phone number.";
    }
    if (email.trim() && !isValidEmail(email.trim())) {
      nextErrors.email = "Enter a valid email address.";
    }

    if (!Number.isInteger(extraGuestCount) || extraGuestCount < 0) {
      nextErrors.extraGuestCount = "Extra guests must be 0 or more.";
    }

    if (selectedTheatre && guestCount > selectedTheatre.capacity) {
      nextErrors.extraGuestCount = `Total guests cannot exceed ${selectedTheatre.capacity}.`;
    }

    if (selectedOccasion) {
      selectedOccasion.fields.forEach((field) => {
        if (field.isRequired && !occasionData[field.key]?.trim()) {
          nextErrors[`occasion.${field.key}`] = `${field.label} is required.`;
        }
      });
    }

    if (!isPaymentSectionLocked && paymentAmountMode === "ADVANCE") {
      if (isEditMode) {
        if (enforceAdvanceNumeric && (!Number.isFinite(amountPayNow) || amountPayNow < 0)) {
          nextErrors.amountPayNow = "Enter a valid amount to collect.";
        } else if (amountPayNow > editRemainingBeforeCollection) {
          nextErrors.amountPayNow = "Amount to collect cannot exceed remaining amount.";
        }
      } else {
        if (enforceAdvanceNumeric && (!Number.isFinite(amountPayNow) || amountPayNow <= 0)) {
          nextErrors.amountPayNow = "Enter a valid advance amount.";
        } else if (amountPayNow < minimumAdvanceAmount) {
          nextErrors.amountPayNow = `Advance cannot be lower than Rs ${minimumAdvanceAmount}.`;
        } else if (pricing && amountPayNow > pricing.totalAmount) {
          nextErrors.amountPayNow = "Advance cannot exceed total amount.";
        }
      }
    }

    if (mode === "edit" && initialFullPaid && paymentStatus !== "PAID") {
      nextErrors.paymentStatus = "Fully paid booking cannot be downgraded.";
    }

    if (
      !isPaymentSectionLocked &&
      paymentType === "OFFLINE" &&
      (offlineMethod === "UPI" || offlineMethod === "BANK") &&
      !offlineReference.trim()
    ) {
      nextErrors.offlineReference = "Reference ID is required for this method.";
    }

    const normalizedCoupon = couponCode.trim().toUpperCase();
    if (normalizedCoupon && !appliedCoupons.some((coupon) => coupon.code === normalizedCoupon)) {
      nextErrors.couponCode = "Apply coupon or clear the coupon code.";
    }

    return nextErrors;
  }

  function validateForm() {
    const nextErrors = buildFormErrors({ enforceAdvanceNumeric: true });
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  const readinessErrors = buildFormErrors({ enforceAdvanceNumeric: false });
  const isFormReady = Object.keys(readinessErrors).length === 0;
  const summaryBlockerMessage = getSubmitBlockerMessage(readinessErrors);

  const dismissCouponFeedback = useCallback(() => {
    setCouponError(null);
    setErrors((prev) => {
      if (!prev.couponCode) return prev;
      const rest = { ...prev };
      delete rest.couponCode;
      return rest;
    });
  }, []);

  const collectOnlinePayment = useCallback(
    async (params: {
      orderId: string;
      amountInPaise: number;
      description: string;
      verifyEndpoint: string;
      verifyToastId: string;
      verifyFailureHint: string;
      verifySuccessMessage: string;
      buildVerifyPayload: (response: {
        razorpay_payment_id: string;
        razorpay_order_id: string;
        razorpay_signature: string;
      }) => Record<string, unknown>;
    }) => {
      const {
        orderId,
        amountInPaise,
        description,
        verifyEndpoint,
        verifyToastId,
        verifyFailureHint,
        verifySuccessMessage,
        buildVerifyPayload,
      } = params;

      if (!process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID) {
        toast.error("Razorpay key is missing. Please check payment configuration.");
        return false;
      }

      const isLoaded = await ensureRazorpayCheckoutLoaded();
      if (!isLoaded) {
        toast.error("Razorpay is not ready. Please try again.");
        return false;
      }

      return new Promise<boolean>((resolve) => {
        let settled = false;
        const settle = (value: boolean) => {
          if (settled) return;
          settled = true;
          resolve(value);
        };

        const opened = openRazorpayModal({
          orderId,
          amountInPaise,
          name: "Haven Retreat",
          description,
          prefill: {
            name: name.trim() || undefined,
            email: email.trim() || undefined,
            contact: normalizePhone(phone) || undefined,
          },
          onDismiss: () => {
            toast.error("Payment cancelled. You can retry safely.");
            settle(false);
          },
          onSuccess: async (response) => {
            toast.loading("Verifying payment...", { id: verifyToastId });

            try {
              const verifyRes = await fetch(verifyEndpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(buildVerifyPayload(response)),
              });
              const verifyJson = (await verifyRes.json().catch(() => null)) as
                | { success?: boolean; message?: string }
                | null;

              if (!verifyRes.ok || !verifyJson?.success) {
                toast.error(verifyJson?.message || "Payment verification failed.", {
                  id: verifyToastId,
                });
                toast.info(verifyFailureHint);
                settle(false);
                return;
              }

              toast.success(verifySuccessMessage, {
                id: verifyToastId,
              });
              settle(true);
            } catch {
              toast.error("Payment verification failed.", { id: verifyToastId });
              toast.info(verifyFailureHint);
              settle(false);
            }
          },
          onOpenFailed: () => {
            settle(false);
          },
        });

        if (!opened) {
          toast.error("Unable to open Razorpay checkout.");
          settle(false);
        }
      });
    },
    [email, name, phone]
  );

  const collectOnlinePaymentForEdit = useCallback(
    async (params: {
      bookingId: string;
      orderId: string;
      amountInPaise: number;
    }) => {
      const { bookingId: targetBookingId, orderId, amountInPaise } = params;
      return collectOnlinePayment({
        orderId,
        amountInPaise,
        description: "Booking Update Payment",
        verifyEndpoint: `/api/admin/bookings/${encodeURIComponent(targetBookingId)}/collect-online/verify`,
        verifyToastId: "admin-edit-verify",
        verifyFailureHint: "Retry payment to continue this booking update.",
        verifySuccessMessage: "Payment collected successfully.",
        buildVerifyPayload: (response) => ({
          razorpay_payment_id: response.razorpay_payment_id,
          razorpay_order_id: response.razorpay_order_id,
          razorpay_signature: response.razorpay_signature,
        }),
      });
    },
    [collectOnlinePayment]
  );

  const collectOnlinePaymentForCreate = useCallback(
    async (params: {
      bookingId: string;
    }) => {
      const { bookingId: targetBookingId } = params;

      const orderRes = await fetch("/api/payments/razorpay/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId: targetBookingId }),
      });

      const orderJson = (await orderRes.json().catch(() => null)) as
        | { success?: boolean; orderId?: string; amount?: number; message?: string }
        | null;

      if (!orderRes.ok || !orderJson?.success) {
        toast.error(orderJson?.message || "Unable to initialize online payment.");
        toast.info("Retry payment to continue this booking creation.");
        return false;
      }

      const orderId = String(orderJson.orderId ?? "");
      const amountInPaise = Number(orderJson.amount ?? 0);
      if (!orderId || !Number.isFinite(amountInPaise) || amountInPaise <= 0) {
        toast.error("Online payment initialization failed for this booking.");
        toast.info("Retry payment to continue this booking creation.");
        return false;
      }

      return collectOnlinePayment({
        orderId,
        amountInPaise,
        description: "Booking Payment",
        verifyEndpoint: "/api/payments/razorpay/verify",
        verifyToastId: "admin-create-verify",
        verifyFailureHint: "Retry payment to continue this booking creation.",
        verifySuccessMessage: "Payment collected and booking confirmed.",
        buildVerifyPayload: (response) => ({
          bookingId: targetBookingId,
          razorpay_payment_id: response.razorpay_payment_id,
          razorpay_order_id: response.razorpay_order_id,
          razorpay_signature: response.razorpay_signature,
        }),
      });
    },
    [collectOnlinePayment]
  );

  const performBookingMutation = useCallback(
    async (
      request: AdminBookingMutationRequest,
      allowLockedSlotOverride: boolean
    ) => {
      try {
        setSubmitting(true);

        const endpoint =
          request.mode === "edit"
            ? `/api/admin/bookings/${request.bookingId}`
            : "/api/admin/bookings/create";
        const method = request.mode === "edit" ? "PATCH" : "POST";
        const payload =
          request.mode === "edit"
            ? {
                ...request.commonPayload,
                allowLockedSlotOverride,
              }
            : {
                mode: "CREATE",
                ...request.commonPayload,
                allowLockedSlotOverride,
              };

        const res = await fetch(endpoint, {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const json = await res.json().catch(() => null);
        if (!res.ok || !json?.success) {
          if (
            !allowLockedSlotOverride &&
            json?.code === "SLOT_LOCKED_ACTIVE_SESSION"
          ) {
            const lockContext =
              json?.lockContext === "same_session"
                ? "same_session"
                : "other_session";
            setSlotOverrideLockContext(lockContext);
            setSlotOverridePendingRequest(request);
            setSlotOverrideModalOpen(true);
            return;
          }

          toast.error(
            json?.message ||
              (request.mode === "edit"
                ? "Failed to update booking."
                : "Failed to create booking.")
          );
          return;
        }

        if (request.mode === "edit") {
          const onlineCollectionRequired = Boolean(
            json.data?.onlineCollectionRequired
          );
          if (onlineCollectionRequired) {
            const nextBookingId = String(json.data?.id ?? request.bookingId ?? "");
            const orderId = String(json.data?.orderId ?? "");
            const amountInPaise = Number(json.data?.amount ?? 0);

            if (!nextBookingId || !orderId || !Number.isFinite(amountInPaise) || amountInPaise <= 0) {
              toast.error("Online payment initialization failed for this booking update.");
              return;
            }

            toast.success("Booking updated. Opening Razorpay to collect payment...");
            const collected = await collectOnlinePaymentForEdit({
              bookingId: nextBookingId,
              orderId,
              amountInPaise,
            });

            if (!collected) return;

            toast.success(`Booking ${json.data?.bookingRef ?? ""} updated successfully.`);
            if (onUpdated) {
              onUpdated(nextBookingId);
              return;
            }
            router.refresh();
            return;
          }

          const slotReassigned = Boolean(json.data?.slotReassigned);
          if (slotReassigned) {
            const reassignedSummary = json.data?.slotReassignedSummary;
            const description =
              reassignedSummary &&
              typeof reassignedSummary.theatreName === "string" &&
              typeof reassignedSummary.dateLabel === "string" &&
              typeof reassignedSummary.timeRangeLabel === "string"
                ? `${reassignedSummary.theatreName} · ${reassignedSummary.dateLabel} · ${String(
                    reassignedSummary.timeRangeLabel
                  ).replace(" - ", " – ")}`
                : undefined;

            toast.success("Slot reassigned successfully.", {
              ...(description ? { description } : {}),
            });
          } else {
            toast.success(`Booking ${json.data?.bookingRef ?? ""} updated successfully.`);
            if (json.data?.adminNotification?.message) {
              toast.info(String(json.data.adminNotification.message), {
                duration: 7000,
              });
            }
          }
          if (onUpdated) {
            onUpdated(String(json.data?.id ?? request.bookingId ?? ""));
            return;
          }
          router.refresh();
          return;
        }

        const redirectUrl = String(json.data?.redirectUrl ?? "");
        const nextBookingId = String(json.data?.bookingId ?? "");
        const paymentFlowType = String(json.data?.paymentType ?? "");
        const bookingRef = String(json.data?.bookingRef ?? "");
        const successToken = String(json.data?.successToken ?? "");

        if (paymentFlowType === "ONLINE") {
          if (!nextBookingId || !bookingRef) {
            toast.error("Online payment initialization failed for this booking.");
            return;
          }

          setPendingOnlineCreateBooking({
            bookingId: nextBookingId,
            bookingRef,
          });

          toast.success("Booking initialized. Opening Razorpay to collect payment...");
          const collected = await collectOnlinePaymentForCreate({
            bookingId: nextBookingId,
          });
          if (!collected) {
            toast.info(`Booking ${bookingRef} is awaiting payment. Retry from this form.`);
            return;
          }

          setPendingOnlineCreateBooking(null);
          toast.success(`Booking ${bookingRef} confirmed successfully.`);
          if (onCreated) {
            onCreated(bookingRef);
            return;
          }
          router.push(`/admin/bookings?ref=${encodeURIComponent(bookingRef)}`);
          return;
        }

        if (paymentFlowType === "OFFLINE") {
          setPendingOnlineCreateBooking(null);
          toast.success(`Booking ${bookingRef} confirmed successfully.`);
          const successUrl =
            redirectUrl ||
            (successToken
              ? `/booking/success?t=${encodeURIComponent(successToken)}`
              : `/admin/bookings?ref=${encodeURIComponent(bookingRef)}`);

          try {
            window.location.assign(successUrl);
          } catch {
            toast.error("Redirect to booking success failed. Please open booking confirmation manually.");
            router.push(successUrl);
          }
          return;
        }

        setPendingOnlineCreateBooking(null);
        toast.success(`Booking ${bookingRef} created successfully.`);
        if (onCreated) {
          onCreated(bookingRef);
          return;
        }
        router.push(
          redirectUrl || `/admin/bookings?ref=${encodeURIComponent(bookingRef)}`
        );
      } catch {
        toast.error(
          request.mode === "edit"
            ? "Failed to update booking. Please try again."
            : "Failed to create booking. Please try again."
        );
      } finally {
        setSubmitting(false);
      }
    },
    [collectOnlinePaymentForCreate, collectOnlinePaymentForEdit, onCreated, onUpdated, router]
  );

  const handleDiscardPendingOnlineBooking = useCallback(async () => {
    if (!pendingOnlineCreateBooking || submitting || discardingPendingOnlineCreateBooking) {
      return;
    }

    setDiscardingPendingOnlineCreateBooking(true);
    try {
      await discardPendingOnlineCreateBooking({
        pendingOnlineCreateBooking,
        confirmDiscard: (pendingBookingRef) =>
          window.confirm(
            `Discard pending booking ${pendingBookingRef}? This will release its slot and reserved coupons.`
          ),
        deletePendingBooking: async (pendingBookingId) => {
          const res = await fetch(
            `/api/admin/bookings/${encodeURIComponent(pendingBookingId)}`,
            { method: "DELETE" }
          );
          const json = (await res.json().catch(() => null)) as
            | { success?: boolean; message?: string }
            | null;
          if (!res.ok || !json?.success) {
            toast.error(json?.message || "Failed to discard pending booking.");
            return false;
          }
          return true;
        },
        clearPendingOnlineCreateBooking: () => {
          setPendingOnlineCreateBooking(null);
        },
        onDiscardSuccess: (pendingBookingRef) => {
          toast.success(
            `Pending booking ${pendingBookingRef} discarded. You can now update details and create again.`
          );
        },
        onDiscardFailure: () => {
          // Error toast is emitted in deletePendingBooking for server/network failures.
        },
      });
    } catch {
      toast.error("Failed to discard pending booking.");
    } finally {
      setDiscardingPendingOnlineCreateBooking(false);
    }
  }, [
    pendingOnlineCreateBooking,
    submitting,
    discardingPendingOnlineCreateBooking,
  ]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting || discardingPendingOnlineCreateBooking) return;

    const pendingRetryHandled = await handlePendingOnlineCreateRetry({
      isEditMode,
      pendingOnlineCreateBooking,
      paymentType,
      collectOnlinePaymentForCreate,
      setSubmitting,
      clearPendingOnlineCreateBooking: () => {
        setPendingOnlineCreateBooking(null);
      },
      onModeMismatch: (pendingBookingRef) => {
        toast.error(
          `Online payment is pending for ${pendingBookingRef}. Complete it before changing payment mode.`
        );
      },
      onRetryPending: (pendingBookingRef) => {
        toast.info(
          `Booking ${pendingBookingRef} is awaiting payment. Retry from this form.`
        );
      },
      onCollectedSuccess: (pendingBookingRef) => {
        toast.success(`Booking ${pendingBookingRef} confirmed successfully.`);
      },
      onError: () => {
        toast.error("Failed to collect booking payment. Please try again.");
      },
      onSettledCreated: (pendingBookingRef) => {
        if (onCreated) {
          onCreated(pendingBookingRef);
          return;
        }
        router.push(`/admin/bookings?ref=${encodeURIComponent(pendingBookingRef)}`);
      },
    });

    if (pendingRetryHandled) {
      return;
    }

    if (!validateForm()) {
      toast.error("Please fix the highlighted fields.");
      return;
    }

    try {
      setSubmitting(true);
      const paymentAmountModeForApi =
        paymentAmountMode === "REMAINING" ||
        (isEditMode && (pricing?.remainingPayable ?? 0) <= 0)
          ? "FULL"
          : paymentAmountMode;
      const advanceAmountForApi = isEditMode
        ? pricing?.advancePaid ?? editAdvancePaidAlready
        : amountPayNow;

      const commonPayload = {
        locationId,
        date,
        theatreId,
        slotId,
        customer: {
          name: name.trim(),
          phone: normalizePhone(phone),
          email: email.trim() || undefined,
          userId: existingUserId ?? undefined,
        },
        guestCount,
        decorationRequired: effectiveDecorationRequired,
        occasionKey: occasionKey || undefined,
        occasionData,
        couponCodes: appliedCoupons.map((coupon) => coupon.code),
        items: Object.entries(productSelections)
          .map(([selectionKey, selection]) => {
            const [productId, variantId] = selectionKey.split(":");
            return {
              productId,
              variantId,
              quantity: selection.quantity,
              ledNumber: selection.ledNumber,
            };
          })
          .filter((item) => Boolean(item.productId && item.variantId))
          .filter((item) => item.quantity > 0),
        payment: {
          type: paymentType,
          amountMode: paymentAmountModeForApi,
          advanceAmount: advanceAmountForApi,
          offlineMethod: paymentType === "OFFLINE" ? offlineMethod : undefined,
          offlineReference:
            paymentType === "OFFLINE" ? offlineReference.trim() || undefined : undefined,
          paymentStatus,
        },
      };

      if (mode === "edit") {
        if (!bookingId) {
          toast.error("Booking ID is missing for edit.");
          return;
        }

        await performBookingMutation(
          {
            mode: "edit",
            bookingId,
            commonPayload,
          },
          false
        );
        return;
      }

      const createPayload = {
        ...commonPayload,
        payment: {
          type: paymentType,
          amountMode: paymentAmountModeForApi,
          advanceAmount: advanceAmountForApi,
          offlineMethod: paymentType === "OFFLINE" ? offlineMethod : undefined,
          offlineReference:
            paymentType === "OFFLINE" ? offlineReference.trim() || undefined : undefined,
        },
      };

      await performBookingMutation(
        {
          mode: "create",
          commonPayload: createPayload,
        },
        false
      );
    } catch {
      toast.error("Failed to submit booking. Please try again.");
    }
  }

  const handleCloseSlotOverrideModal = useCallback(() => {
    if (submitting) return;
    setSlotOverrideModalOpen(false);
    setSlotOverridePendingRequest(null);
    setSlotOverrideLockContext("other_session");
  }, [submitting]);

  const handleConfirmSlotOverride = useCallback(async () => {
    if (!slotOverridePendingRequest) return;
    setSlotOverrideModalOpen(false);
    const pendingRequest = slotOverridePendingRequest;
    setSlotOverridePendingRequest(null);
    setSlotOverrideLockContext("other_session");
    await performBookingMutation(pendingRequest, true);
  }, [slotOverridePendingRequest, performBookingMutation]);

  if (mode === "edit" && !bookingId) {
    return <div className="py-10 text-sm text-red-600">Booking ID is required for edit mode.</div>;
  }

  if (loadingBootData || loadingEditData) {
    return <div className="py-10 text-sm text-slate-500">Loading admin booking form...</div>;
  }

  return (
    <>
      <form
        onSubmit={handleSubmit}
        autoComplete="on"
        className={`${embedded ? "" : "mt-6"} grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]`}
      >
        <div className="space-y-5">
        {!isEditMode && pendingOnlineCreateBooking ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            <p>
              Booking <span className="font-semibold">{pendingOnlineCreateBooking.bookingRef}</span> is already
              created and awaiting online payment. Use submit to retry payment for this booking.
            </p>
            <button
              type="button"
              onClick={() => {
                void handleDiscardPendingOnlineBooking();
              }}
              disabled={submitting || discardingPendingOnlineCreateBooking}
              className="mt-2 inline-flex items-center rounded-md border border-amber-300 bg-white px-2 py-1 text-[11px] font-semibold text-amber-700 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {discardingPendingOnlineCreateBooking ? "Discarding..." : "Discard Pending Booking"}
            </button>
          </div>
        ) : null}
        <ScheduleSection
          locationId={locationId}
          date={date}
          theatreId={theatreId}
          slotId={slotId}
          locations={locations}
          loadingTheatres={loadingTheatres}
          theatres={theatres}
          theatreSlots={theatreSlots}
          errors={errors}
          dateHoverHint={dateHoverHint}
          theatreHoverHint={theatreHoverHint}
          slotHoverHint={slotHoverHint}
          onLocationDateChange={handleLocationDateChange}
          onTheatreSlotChange={handleTheatreSlotChange}
        />

        <CustomerInfoSection
          name={name}
          phone={phone}
          email={email}
          errors={errors}
          lookingUpUser={lookingUpUser}
          existingUserId={existingUserId}
          existingUserName={existingUserName}
          selectedTheatre={selectedTheatre}
          guestsForControl={guestsForControl}
          canDecreaseGuests={canDecreaseGuests}
          canIncreaseGuests={canIncreaseGuests}
          onNameChange={setName}
          onPhoneChange={(value) => setPhone(normalizePhone(value))}
          onPhoneBlur={handlePhoneBlur}
          onEmailChange={setEmail}
          onDecrementGuests={decrementGuests}
          onIncrementGuests={incrementGuests}
        />

        <OccasionSection
          occasionKey={occasionKey}
          occasions={occasions}
          selectedOccasion={selectedOccasion}
          selectedSlot={selectedSlot}
          decorationRequired={decorationRequired}
          occasionData={occasionData}
          errors={errors}
          onOccasionChange={onOccasionChange}
          onOccasionFieldChange={updateOccasionField}
          onDecorationRequiredChange={handleDecorationRequiredChange}
        />

        <ProductsExtrasSection
          loadingProducts={loadingProducts}
          products={products}
          productsByCategory={productsByCategory}
          getActiveVariantId={getActiveVariantId}
          getVariantSelection={getVariantSelection}
          getLedDraftValue={getLedDraftValue}
          onVariantChange={onVariantChange}
          onIncrementQuantity={incrementQuantity}
          onDecrementQuantity={decrementQuantity}
          onToggleDecoration={toggleDecoration}
          onLedDraftValueChange={setLedDraftValue}
          onLedNumberSubmit={setLedNumber}
        />

        <PaymentModeSection
          mode={mode}
          paymentType={paymentType}
          paymentAmountMode={paymentAmountMode}
          amountPayNow={amountPayNow}
          minimumAdvanceAmount={minimumAdvanceAmount}
          offlineMethod={offlineMethod}
          offlineReference={offlineReference}
          couponCode={couponCode}
          appliedCoupons={appliedCoupons}
          showCouponInput={showCouponInput}
          couponDiscount={couponDiscount}
          couponApplying={couponApplying}
          couponLocked={couponIdentityGate.locked}
          couponLockMessage={couponIdentityGate.message}
          couponError={couponError}
          disablePaymentAmountMode={initialFullPaid && !hasPriceImpactingChanges}
          lockPaymentSection={isPaymentSectionLocked}
          errors={errors}
          onPaymentTypeChange={setPaymentType}
          onPaymentAmountModeChange={handlePaymentAmountModeChange}
          onAmountPayNowChange={setCustomAdvanceAmount}
          onOfflineMethodChange={setOfflineMethod}
          onOfflineReferenceChange={setOfflineReference}
          onCouponCodeChange={(value) => {
            const normalized = value.toUpperCase();
            setCouponCode(normalized);
            setCouponError(null);
          }}
          onShowCouponInput={() => {
            setShowCouponInput(true);
            setCouponCode("");
            setCouponError(null);
          }}
          onApplyCoupon={() => void applyCouponCode()}
          onDismissCouponFeedback={dismissCouponFeedback}
          onRemoveCoupon={(couponCodeToRemove) => {
            const remainingCodes = appliedCoupons
              .map((coupon) => coupon.code)
              .filter((code) => code !== couponCodeToRemove);

            setShowCouponInput(true);
            setCouponCode("");
            setCouponError(null);

            if (remainingCodes.length === 0) {
              clearAppliedCouponState();
              return;
            }

            setCouponApplying(true);
            void previewCoupons(remainingCodes).finally(() => {
              setCouponApplying(false);
            });
          }}
        />
      </div>

        <BookingSummarySection
          mode={mode}
          bookingRef={mode === "edit" ? editPrefill?.bookingRef ?? null : null}
          pendingOnlineBookingRef={
            !isEditMode ? pendingOnlineCreateBooking?.bookingRef ?? null : null
          }
          selectedLocation={selectedLocation}
          locationId={locationId}
          date={date}
          selectedTheatre={selectedTheatre}
          theatreId={theatreId}
          selectedSlot={selectedSlot}
          pricing={pricing}
          selectedProductItems={selectedProductItems}
          paymentAmountMode={paymentAmountMode}
          paymentStatus={paymentStatus}
          alreadyPaidAmount={isEditMode ? editAdvancePaidAlready : undefined}
          amountToCollectNow={isEditMode ? amountPayNow : undefined}
          wasInitiallyFullyPaid={isEditMode ? initialFullPaid : false}
          hasPriceImpactingChanges={isEditMode ? hasPaymentPreviewChanges : false}
          guidanceMessage={
            !isEditMode && Boolean(pendingOnlineCreateBooking)
              ? null
              : summaryBlockerMessage
          }
          isFormReady={
            !isEditMode && Boolean(pendingOnlineCreateBooking)
              ? true
              : isFormReady
          }
          submitting={submitting || discardingPendingOnlineCreateBooking}
          onRemoveSelectedProduct={removeSelectedProduct}
        />
      </form>

      <ConfirmActionModal
        open={slotOverrideModalOpen}
        title={
          slotOverrideLockContext === "same_session"
            ? "Override Your Active Session?"
            : "Override Active Customer Lock?"
        }
        description={
          slotOverrideLockContext === "same_session"
            ? "This slot is currently reserved in your active booking session. Do you want to override the existing session and proceed with admin booking?"
            : "This slot is currently locked by another customer session. Do you want to override and proceed with admin booking?"
        }
        confirmLabel={
          slotOverrideLockContext === "same_session"
            ? "Override & Book"
            : "Force Book"
        }
        loadingLabel="Overriding..."
        cancelLabel="Cancel"
        loading={submitting}
        onClose={handleCloseSlotOverrideModal}
        onConfirm={() => {
          void handleConfirmSlotOverride();
        }}
      />
    </>
  );
}
