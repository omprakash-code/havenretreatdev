import type { CouponScopeUi } from "@/lib/coupon-scope";

export type AdminCouponListItem = {
  id: string;
  code: string;
  discountType: "FLAT" | "PERCENTAGE";
  discountValue: number;
  maxDiscount: number | null;
  scope: CouponScopeUi;
  validFrom: string;
  validTill: string | null;
  isStackable: boolean;
  stackableCouponIds?: string[];
  usageLimit: number | null;
  perUserUsageLimit: number | null;
  locationId: string | null;
  isActive: boolean;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
  confirmedUsageCount: number;
};

export type CouponActivityFilter = "ALL" | "LIVE" | "UPCOMING" | "EXPIRED";

export type CouponListKpis = {
  total: number;
  active: number;
  scheduled: number;
  expired: number;
};

export type AdminCouponListResponse = {
  items: AdminCouponListItem[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  kpis: CouponListKpis;
};
