export type CouponLocationOption = {
  id: string;
  name: string;
};

export type CouponProductOption = {
  id: string;
  name: string;
  category: "CAKE" | "DECORATION" | "GIFT";
  locationId: string;
  locationName: string;
};

export type CouponSlotDurationOption = {
  value: number;
  label: string;
};

export type CouponRuleOptions = {
  locations: CouponLocationOption[];
  products: CouponProductOption[];
  slotDurations: CouponSlotDurationOption[];
  coupons: {
    id: string;
    code: string;
    isActive: boolean;
  }[];
};

export type CouponRuleOptionInclude =
  | "locations"
  | "slotDurations"
  | "products"
  | "coupons";
