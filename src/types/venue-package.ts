export type GroupedPackageFeatureItem = {
  id: string;
  label: string;
  value?: string | null;
  icon?: string | null;
  sortOrder: number;
};

export type GroupedPackageFeatures = {
  included: GroupedPackageFeatureItem[];
  decoration: GroupedPackageFeatureItem[];
  cleaning: GroupedPackageFeatureItem[];
  priceBreakdown: GroupedPackageFeatureItem[];
};

export type VenueSummary = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
  country?: string | null;
  phone?: string | null;
  email?: string | null;
  images: string[];
  maxGuests?: number | null;
  cleaningFee?: number | null;
  setupBufferMinutes: number;
  isActive: boolean;
};

export type EventAddonSummary = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  price: number;
  category: string;
  image?: string | null;
  isActive: boolean;
  sortOrder: number;
};

export type EventPackageSummary = {
  id: string;
  venueId: string;
  name: string;
  slug: string;
  shortDescription?: string | null;
  guestLimit: number;
  eventDurationHours: number;
  complimentarySetupHours: number;
  rentalAmount: number;
  decorationAmount: number;
  cleaningAmount: number;
  subtotalAmount: number;
  savingsAmount: number;
  finalAmount: number;
  isPopular: boolean;
  sortOrder: number;
  isActive: boolean;
  venue: VenueSummary;
  features: GroupedPackageFeatureItem[];
  featureGroups: GroupedPackageFeatures;
  addons: EventAddonSummary[];
};
