import { EventAddonCategory, PackageFeatureGroup, VenueBusinessType } from "@prisma/client";

export type VenuePackageFeatureSeed = {
  group: PackageFeatureGroup;
  label: string;
  value?: string;
  icon?: string;
  sortOrder: number;
};

export type VenueAddonSeed = {
  name: string;
  slug: string;
  description?: string;
  price: number;
  category: EventAddonCategory;
  image?: string;
  sortOrder: number;
};

export type VenueEventPackageSeed = {
  name: string;
  slug: string;
  shortDescription: string;
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
  features: VenuePackageFeatureSeed[];
  addons?: VenueAddonSeed[];
};

export type VenueSeedConfig = {
  name: string;
  slug: string;
  businessType: VenueBusinessType;
  description: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  phone?: string;
  email?: string;
  images: string[];
  maxGuests: number;
  cleaningFee: number;
  setupBufferMinutes: number;
  isActive: boolean;
  packages: VenueEventPackageSeed[];
  addons?: VenueAddonSeed[];
};

function createPackageFeatures(input: {
  included: string[];
  decoration: string[];
  cleaning: string[];
  priceBreakdown: Array<{ label: string; value: string }>;
}) {
  let order = 1;

  const included = input.included.map((label) => ({
    group: PackageFeatureGroup.INCLUDED,
    label,
    sortOrder: order++,
  }));

  const decoration = input.decoration.map((label) => ({
    group: PackageFeatureGroup.DECORATION,
    label,
    sortOrder: order++,
  }));

  const cleaning = input.cleaning.map((label) => ({
    group: PackageFeatureGroup.CLEANING,
    label,
    sortOrder: order++,
  }));

  const priceBreakdown = input.priceBreakdown.map((row) => ({
    group: PackageFeatureGroup.PRICE_BREAKDOWN,
    label: row.label,
    value: row.value,
    sortOrder: order++,
  }));

  return [...included, ...decoration, ...cleaning, ...priceBreakdown];
}

export const HAVEN_RETREAT_VENUE_CONFIG: VenueSeedConfig = {
  name: "Haven Retreat Miami",
  slug: "haven-retreat-miami",
  businessType: VenueBusinessType.EVENT_VENUE,
  description:
    "Private event venue experience for celebrations, poolside gatherings, styled parties, and intimate outdoor events.",
  address: "Haven Retreat",
  city: "Miami",
  state: "Florida",
  zipCode: "33101",
  country: "USA",
  phone: undefined,
  email: undefined,
  images: [
    "/media/booking/theatres/theatre-1/theatre-1-1.png",
    "/media/booking/theatres/theatre-2/theatre-2-1.png",
    "/media/booking/theatres/theatre-3/theatre-3-1.png",
  ],
  maxGuests: 50,
  cleaningFee: 95,
  setupBufferMinutes: 60,
  isActive: true,
  packages: [
    {
      name: "Essential Package",
      slug: "essential-package",
      shortDescription:
        "Flexible event package for intimate gatherings and styled celebrations.",
      guestLimit: 30,
      eventDurationHours: 4,
      complimentarySetupHours: 1,
      rentalAmount: 500,
      decorationAmount: 400,
      cleaningAmount: 95,
      subtotalAmount: 1111,
      savingsAmount: 111,
      finalAmount: 1000,
      isPopular: false,
      sortOrder: 1,
      isActive: true,
      features: createPackageFeatures({
        included: [
          "4 Hour Event Rental",
          "1 Complimentary Setup Hour",
          "Private Pool & Backyard Access",
          "Coolers included",
          "Speaker system included",
          "Wifi",
          "3 Tables with black or white spandex",
          "24 Chairs setup",
          "Decoration included",
          "Standard event cleaning",
        ],
        decoration: [
          "Two balloon arches (custom color theme)",
          "LED \"Happy Birthday\" sign",
          "Cake stand included",
        ],
        cleaning: [
          "Event cleaning",
          "Trash removal included",
        ],
        priceBreakdown: [
          { label: "Rental", value: "$500" },
          { label: "Tables", value: "$45" },
          { label: "Chairs", value: "$72" },
          { label: "Decoration", value: "$400" },
          { label: "Cleaning", value: "$95" },
          { label: "Before Savings", value: "$1,112" },
        ],
      }),
    },
    {
      name: "Celebration Package",
      slug: "celebration-package",
      shortDescription:
        "Most popular package for birthdays, showers, and medium-sized celebrations.",
      guestLimit: 40,
      eventDurationHours: 4,
      complimentarySetupHours: 1,
      rentalAmount: 580,
      decorationAmount: 400,
      cleaningAmount: 95,
      subtotalAmount: 1231,
      savingsAmount: 123,
      finalAmount: 1108,
      isPopular: true,
      sortOrder: 2,
      isActive: true,
      features: createPackageFeatures({
        included: [
          "4 Hour Event Rental",
          "1 Complimentary Setup Hour",
          "Private Pool & Backyard Access",
          "Coolers included",
          "Speaker system included",
          "Wifi",
          "4 Tables with black or white spandex",
          "32 Chairs setup",
          "Decoration included",
          "Standard event cleaning",
        ],
        decoration: [
          "Two balloon arches (custom color theme)",
          "LED \"Happy Birthday\" sign",
          "Cake stand included",
        ],
        cleaning: [
          "Event cleaning",
          "Trash removal included",
        ],
        priceBreakdown: [
          { label: "Rental", value: "$580" },
          { label: "Tables", value: "$60" },
          { label: "Chairs", value: "$96" },
          { label: "Decoration", value: "$400" },
          { label: "Cleaning", value: "$95" },
          { label: "Before Savings", value: "$1,231" },
        ],
      }),
    },
    {
      name: "Signature Package",
      slug: "signature-package",
      shortDescription:
        "Larger-format package designed for elevated celebrations and fuller guest counts.",
      guestLimit: 50,
      eventDurationHours: 4,
      complimentarySetupHours: 1,
      rentalAmount: 700,
      decorationAmount: 400,
      cleaningAmount: 95,
      subtotalAmount: 1405,
      savingsAmount: 140,
      finalAmount: 1265,
      isPopular: false,
      sortOrder: 3,
      isActive: true,
      features: createPackageFeatures({
        included: [
          "4 Hour Event Rental",
          "1 Complimentary Setup Hour",
          "Private Pool & Backyard Access",
          "Coolers included",
          "Speaker system included",
          "Wifi",
          "6 Tables with black or white spandex",
          "40 Chairs setup",
          "Decoration included",
          "Standard event cleaning",
        ],
        decoration: [
          "Two balloon arches (custom color theme)",
          "LED \"Happy Birthday\" sign",
          "Cake stand included",
        ],
        cleaning: [
          "Event cleaning",
          "Trash removal included",
        ],
        priceBreakdown: [
          { label: "Rental", value: "$700" },
          { label: "Tables", value: "$90" },
          { label: "Chairs", value: "$120" },
          { label: "Decoration", value: "$400" },
          { label: "Cleaning", value: "$95" },
          { label: "Before Savings", value: "$1,405" },
        ],
      }),
    },
  ],
  addons: [],
};
