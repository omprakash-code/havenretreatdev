export type CouponLocationOption = {
  id: string;
  name: string;
};

export type CouponTheatreOption = {
  id: string;
  name: string;
  locationId: string;
  locationName: string;
};

export type CouponProductOption = {
  id: string;
  name: string;
  category: "CAKE" | "DECORATION" | "GIFT";
  locationId: string;
  locationName: string;
};

export type CouponSlotOption = {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  status?: string;
  theatreId?: string;
  theatreName?: string;
  locationId?: string;
  locationName?: string;
};

export type CouponSlotDurationOption = {
  value: number;
  label: string;
};

export type CouponRuleOptions = {
  locations: CouponLocationOption[];
  theatres: CouponTheatreOption[];
  products: CouponProductOption[];
  slots: CouponSlotOption[];
  slotDurations: CouponSlotDurationOption[];
  coupons: {
    id: string;
    code: string;
    isActive: boolean;
  }[];
};

export type CouponRuleOptionInclude =
  | "locations"
  | "theatres"
  | "slotDurations"
  | "products"
  | "coupons";
