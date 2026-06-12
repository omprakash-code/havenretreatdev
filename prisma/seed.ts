/**
 * Master production seed for the range booking engine.
 *
 * This seed creates the dependency data required for the customer booking flow to run:
 */

import "dotenv/config";
import {
  EventAddonCategory,
  PackageFeatureGroup,
  PrismaClient,
  ProductCategory,
  UserRole,
  VenueBusinessType,
} from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import bcrypt from "bcrypt";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({
  adapter: new PrismaPg(pool),
});

/* --------------------------------
   ADMIN USER SEED
--------------------------------- */
async function seedAdmin() {
  console.log("Seeding admin user...");

  const adminEmail = "admin@havenretreat.com";
  const adminPassword = "Admin@123";
  const hashedPassword = await bcrypt.hash(adminPassword, 12);

  await prisma.user.upsert({
    where: { phone: "9999999999" },
    update: {
      name: "Jessika Miranda",
      passwordHash: hashedPassword,
      role: UserRole.ADMIN,
      isActive: true,
      isGuest: false,
    },
    create: {
      name: "Jessika Miranda",
      email: adminEmail,
      phone: "9999999999",
      passwordHash: hashedPassword,
      role: UserRole.ADMIN,
      isActive: true,
      isGuest: false,
    },
  });

  console.log("Admin user seeded");
}

/* --------------------------------
   LOCATION, THEATRE & SETTINGS DATA
--------------------------------- */
const LOCATION = {
  name: "Miami",
  city: "Miami",
  sortOrder: 1,
};


/* --------------------------------
   VENUE DATA
--------------------------------- */
const VENUE = {
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
  images: [
    "/media/booking/theatres/theatre-1/theatre-1-1.png",
    "/media/booking/theatres/theatre-2/theatre-2-1.png",
    "/media/booking/theatres/theatre-3/theatre-3-1.png",
  ],
  maxGuests: 50,
  cleaningFee: 95,
  setupBufferMinutes: 60,
};

/* --------------------------------
   EVENT PACKAGE & FEATURE DATA
--------------------------------- */
type PackageSeed = {
  name: string;
  slug: string;
  shortDescription: string;
  guestLimit: number;
  hourlyRate: number;
  rentalAmount: number;
  decorationAmount: number;
  cleaningAmount: number;
  subtotalAmount: number;
  savingsAmount: number;
  finalAmount: number;
  decorationAddonPrice: number;
  decorationDefault: boolean;
  isPopular: boolean;
  sortOrder: number;
  included: string[];
  decoration?: string[];
  cleaning: string[];
  priceBreakdown: Array<{ label: string; value: string }>;
};

const PACKAGE_SEEDS: PackageSeed[] = [
  // --------------- Starter: up to 20 guests, $110/hr ---------------
  {
    name: "Starter Package",
    slug: "starter-package",
    shortDescription: "Up to 20 guests · $110/hr · 4-hour minimum",
    guestLimit: 20,
    hourlyRate: 110,
    rentalAmount: 440,
    decorationAmount: 0,
    cleaningAmount: 50,
    subtotalAmount: 568,
    savingsAmount: 0,
    finalAmount: 568,
    decorationAddonPrice: 375,
    decorationDefault: true,
    isPopular: false,
    sortOrder: 1,
    included: [
      "4 Hour Event Rental",
      "Private Pool & Backyard Access",
      "Coolers Included",
      "Speaker System Included",
      "WiFi",
      "2 Tables with Black or White Spandex",
      "16 Chairs Setup",
      "Standard Cleaning Included",
    ],
    cleaning: ["Event Cleaning", "Trash Removal Included"],
    priceBreakdown: [
      { label: "Rental ($110/hr × 4 hrs)", value: "$440" },
      { label: "Tables & Chairs", value: "$78" },
      { label: "Cleaning Fee", value: "$50" },
      { label: "4-Hour Total", value: "$568" },
    ],
  },
  // --------------- Classic: up to 30 guests, $125/hr ---------------
  {
    name: "Classic Package",
    slug: "classic-package",
    shortDescription: "Up to 30 guests · $125/hr · 4-hour minimum",
    guestLimit: 30,
    hourlyRate: 125,
    rentalAmount: 500,
    decorationAmount: 0,
    cleaningAmount: 75,
    subtotalAmount: 692,
    savingsAmount: 0,
    finalAmount: 692,
    decorationAddonPrice: 375,
    decorationDefault: true,
    isPopular: true,
    sortOrder: 2,
    included: [
      "4 Hour Event Rental",
      "Private Pool & Backyard Access",
      "Coolers Included",
      "Speaker System Included",
      "WiFi",
      "3 Tables with Black or White Spandex",
      "24 Chairs Setup",
      "Standard Cleaning Included",
    ],
    cleaning: ["Event Cleaning", "Trash Removal Included"],
    priceBreakdown: [
      { label: "Rental ($125/hr × 4 hrs)", value: "$500" },
      { label: "Tables & Chairs", value: "$117" },
      { label: "Cleaning Fee", value: "$75" },
      { label: "4-Hour Total", value: "$692" },
    ],
  },
  // --------------- Premium: up to 40 guests, $150/hr ---------------
  {
    name: "Premium Package",
    slug: "premium-package",
    shortDescription: "Up to 40 guests · $150/hr · 4-hour minimum",
    guestLimit: 40,
    hourlyRate: 150,
    rentalAmount: 600,
    decorationAmount: 0,
    cleaningAmount: 85,
    subtotalAmount: 841,
    savingsAmount: 0,
    finalAmount: 841,
    decorationAddonPrice: 375,
    decorationDefault: true,
    isPopular: false,
    sortOrder: 3,
    included: [
      "4 Hour Event Rental",
      "Private Pool & Backyard Access",
      "Coolers Included",
      "Speaker System Included",
      "WiFi",
      "4 Tables with Black or White Spandex",
      "32 Chairs Setup",
      "Standard Cleaning Included",
    ],
    cleaning: ["Event Cleaning", "Trash Removal Included"],
    priceBreakdown: [
      { label: "Rental ($150/hr × 4 hrs)", value: "$600" },
      { label: "Tables & Chairs", value: "$156" },
      { label: "Cleaning Fee", value: "$85" },
      { label: "4-Hour Total", value: "$841" },
    ],
  },
  // --------------- Grand: up to 50 guests, $175/hr ---------------
  {
    name: "Grand Package",
    slug: "grand-package",
    shortDescription: "Up to 50 guests · $175/hr · 4-hour minimum",
    guestLimit: 50,
    hourlyRate: 175,
    rentalAmount: 700,
    decorationAmount: 0,
    cleaningAmount: 95,
    subtotalAmount: 990,
    savingsAmount: 0,
    finalAmount: 990,
    decorationAddonPrice: 375,
    decorationDefault: true,
    isPopular: false,
    sortOrder: 4,
    included: [
      "4 Hour Event Rental",
      "Private Pool & Backyard Access",
      "Coolers Included",
      "Speaker System Included",
      "WiFi",
      "5 Tables with Black or White Spandex",
      "40 Chairs Setup",
      "Standard Cleaning Included",
    ],
    cleaning: ["Event Cleaning", "Trash Removal Included"],
    priceBreakdown: [
      { label: "Rental ($175/hr × 4 hrs)", value: "$700" },
      { label: "Tables & Chairs", value: "$195" },
      { label: "Cleaning Fee", value: "$95" },
      { label: "4-Hour Total", value: "$990" },
    ],
  },
];

/* --------------------------------
   OCCASION & OCCASION FIELD DATA
--------------------------------- */
const OCCASIONS = [
  {
    key: "BIRTHDAY",
    label: "Birthday",
    icon: "/media/booking/occasions/birthday.png",
    subtext: "Celebrate a memorable birthday",
    sortOrder: 1,
    fields: [
      {
        fieldKey: "celebrant_name",
        label: "Birthday Person Name",
        placeholder: "Enter name",
        isRequired: true,
        sortOrder: 1,
      },
      {
        fieldKey: "message",
        label: "Message on Decoration",
        placeholder: "Happy Birthday",
        isRequired: false,
        sortOrder: 2,
      },
    ],
  },
  {
    key: "ANNIVERSARY",
    label: "Anniversary",
    icon: "/media/booking/occasions/anniversary.png",
    subtext: "Celebrate years of togetherness",
    sortOrder: 2,
    fields: [
      {
        fieldKey: "partner1_name",
        label: "Partner 1 Name",
        placeholder: "Enter name",
        isRequired: true,
        sortOrder: 1,
      },
      {
        fieldKey: "partner2_name",
        label: "Partner 2 Name",
        placeholder: "Enter name",
        isRequired: true,
        sortOrder: 2,
      },
      {
        fieldKey: "message",
        label: "Message on Decoration",
        placeholder: "Happy Anniversary",
        isRequired: false,
        sortOrder: 3,
      },
    ],
  },
  {
    key: "ROMANTIC_DATE",
    label: "Romantic Date",
    icon: "/media/booking/occasions/romantic.png",
    subtext: "A private and romantic experience",
    sortOrder: 3,
    fields: [
      {
        fieldKey: "partner1_name",
        label: "Partner 1 Name",
        placeholder: "Enter name",
        isRequired: true,
        sortOrder: 1,
      },
      {
        fieldKey: "partner2_name",
        label: "Partner 2 Name",
        placeholder: "Enter name",
        isRequired: true,
        sortOrder: 2,
      },
      {
        fieldKey: "message",
        label: "Special Message",
        placeholder: "Forever with you",
        isRequired: false,
        sortOrder: 3,
      },
    ],
  },
  {
    key: "MARRIAGE_PROPOSAL",
    label: "Marriage Proposal",
    icon: "/media/booking/occasions/proposal.png",
    subtext: "Plan the perfect proposal",
    sortOrder: 4,
    fields: [
      {
        fieldKey: "partner1_name",
        label: "Partner 1 Name",
        placeholder: "Enter name",
        isRequired: true,
        sortOrder: 1,
      },
      {
        fieldKey: "partner2_name",
        label: "Partner 2 Name",
        placeholder: "Enter name",
        isRequired: true,
        sortOrder: 2,
      },
      {
        fieldKey: "proposal_message",
        label: "Proposal Message",
        placeholder: "Will you marry me",
        isRequired: true,
        sortOrder: 3,
      },
    ],
  },
  {
    key: "BRIDE_TO_BE",
    label: "Bride to Be",
    icon: "/media/booking/occasions/bride.png",
    subtext: "Celebrate the bride-to-be",
    sortOrder: 5,
    fields: [
      {
        fieldKey: "bride_name",
        label: "Bride Name",
        placeholder: "Enter bride name",
        isRequired: true,
        sortOrder: 1,
      },
      {
        fieldKey: "message",
        label: "Message on Decoration",
        placeholder: "Bride to be",
        isRequired: false,
        sortOrder: 2,
      },
    ],
  },
  {
    key: "FAREWELL",
    label: "Farewell",
    icon: "/media/booking/occasions/farewell.png",
    subtext: "A warm farewell celebration",
    sortOrder: 6,
    fields: [
      {
        fieldKey: "person_name",
        label: "Person Name",
        placeholder: "Enter name",
        isRequired: true,
        sortOrder: 1,
      },
      {
        fieldKey: "message",
        label: "Farewell Message",
        placeholder: "Best wishes",
        isRequired: false,
        sortOrder: 2,
      },
    ],
  },
  {
    key: "CONGRATULATIONS",
    label: "Congratulations",
    icon: "/media/booking/occasions/congratulations.png",
    subtext: "Celebrate a special achievement",
    sortOrder: 7,
    fields: [
      {
        fieldKey: "celebrated_for",
        label: "Person Name",
        placeholder: "Enter name",
        isRequired: true,
        sortOrder: 1,
      },
      {
        fieldKey: "message",
        label: "Message",
        placeholder: "Congratulations",
        isRequired: false,
        sortOrder: 2,
      },
    ],
  },
  {
    key: "BABY_SHOWER",
    label: "Baby Shower",
    icon: "/media/booking/occasions/baby.png",
    subtext: "Celebrate the upcoming arrival",
    sortOrder: 8,
    fields: [
      {
        fieldKey: "parent_name",
        label: "Parent Name",
        placeholder: "Enter name",
        isRequired: true,
        sortOrder: 1,
      },
      {
        fieldKey: "message",
        label: "Message on Decoration",
        placeholder: "Welcome baby",
        isRequired: false,
        sortOrder: 2,
      },
    ],
  },
  {
    key: "OTHER",
    label: "Other Celebration",
    icon: "/media/booking/occasions/others.png",
    subtext: "Tell us what you are celebrating",
    sortOrder: 99,
    fields: [
      {
        fieldKey: "occasion",
        label: "Occasion",
        placeholder: "Graduation, reunion, or another celebration",
        isRequired: true,
        sortOrder: 1,
      },
    ],
  },
] as const;

/* --------------------------------
   PRODUCT & PRODUCT VARIANT DATA
--------------------------------- */
const PRODUCTS = [
  {
    name: "Tables",
    slug: "tables",
    image: "/media/booking/products/add-ons/tables.jpeg",
    description: "Additional event tables for food, cake, gifts, or guest seating.",
    stock: 1000,
    sortOrder: 1,
    variant: { label: "Per Table", regularPrice: 15 },
  },
  {
    name: "Chairs",
    slug: "chairs",
    image: "/media/booking/products/add-ons/chairs.jpeg",
    description: "Extra guest chairs for larger celebrations and custom layouts.",
    stock: 1000,
    sortOrder: 2,
    variant: { label: "Per Chair", regularPrice: 3 },
  },
  {
    name: "Bartender",
    slug: "bartender",
    image: "/media/booking/products/add-ons/bartender.avif",
    description: "Professional bartender service for your private event.",
    stock: 1000,
    sortOrder: 3,
    variant: { label: "Per Booking", regularPrice: 200 },
  },
  {
    name: "Pool Heater",
    slug: "pool-heater",
    image: "/media/booking/products/add-ons/pool-heater.avif",
    description: "Warm up the pool in advance for a more comfortable evening event.",
    stock: 1000,
    sortOrder: 4,
    variant: { label: "Per Booking", regularPrice: 150 },
  },
  {
    name: "Pool Slide",
    slug: "pool-slide",
    image: "/media/booking/products/add-ons/pool-slide.jpeg",
    description: "Add the pool slide to make the backyard experience more fun.",
    stock: 1000,
    sortOrder: 5,
    variant: { label: "Per Booking", regularPrice: 300 },
  },
  {
    name: "Balloon Arch",
    slug: "balloon-arch",
    image: "/media/booking/products/add-ons/balloon-arch.avif",
    description: "Custom balloon arch to create a standout event entrance or focal point.",
    stock: 1000,
    sortOrder: 6,
    variant: { label: "Per Setup", regularPrice: 300 },
  },
  {
    name: "Backdrop Balloons",
    slug: "backdrop-balloons",
    image: "/media/booking/products/add-ons/backdrop-balloons.avif",
    description: "Decorative balloon backdrop for photos, gifts, or cake setup.",
    stock: 1000,
    sortOrder: 7,
    variant: { label: "Per Setup", regularPrice: 350 },
  },
  {
    name: "BABY Marquee + Balloon",
    slug: "baby-marque-baloon",
    image: "/media/booking/products/add-ons/baby-marque-baloon.avif",
    description: "Statement marquee setup with balloons for baby showers and family celebrations.",
    stock: 1000,
    sortOrder: 8,
    variant: { label: "Per Setup", regularPrice: 500 },
  },
  {
    name: "Tent 10x10",
    slug: "tent-10x10",
    image: "/media/booking/products/add-ons/tent.jpeg",
    description: "Shade and weather cover for outdoor gatherings and event setups.",
    stock: 1000,
    sortOrder: 9,
    variant: { label: "Per Tent", regularPrice: 45 },
  },
  {
    name: "Hot Tub",
    slug: "hot-tub",
    image: "/media/booking/products/add-ons/hot-tub.jpeg",
    description: "Enable the hot tub for a cozy and upgraded backyard experience.",
    stock: 1000,
    sortOrder: 10,
    variant: { label: "Per Booking", regularPrice: 50 },
  },
  {
    name: "Balloon Décor Package",
    slug: "balloon-decor-package",
    image: "/media/booking/products/add-ons/balloon-décor-package.avif",
    description:
      "Balloon décor package starting at $375. Includes up to 3 balloon colors of your choice, balloon arch design, cake cylinders/pedestals, and basic setup & styling.",
    stock: 1000,
    sortOrder: 11,
    variant: { label: "Per Setup", regularPrice: 375 },
  },
] as const;

/* --------------------------------
   APPLICATION SETTINGS DATA
--------------------------------- */
const APP_SETTINGS = [
  { key: "ADVANCE_PAYMENT_AMOUNT", value: "150" },
  { key: "BOOKING_LOCK_MINUTES", value: "20" },
  { key: "MINIMUM_BOOKING_DURATION_HOURS", value: "4" },
  { key: "EXTRA_HOURLY_RATE", value: "120" },
  { key: "SLOT_EXPIRY_MODE", value: "START_TIME" },
  { key: "SLOT_EXPIRY_GRACE_MINUTES", value: "30" },
  { key: "SPECIAL_SLOT_TEXT", value: "Special Price" },
];

/* --------------------------------
   AGREEMENT TEMPLATE DATA
--------------------------------- */
const AGREEMENT_TEMPLATE_CONTENT = `
<h1>Haven Retreat Event Rental Agreement</h1>
<p>This agreement is between Haven Retreat and the renter for a private event booking.</p>
<h2>Rental Period</h2>
<p>The rental period begins and ends at the booking time selected by the renter. Setup time is included inside the booked duration.</p>
<h2>Guest Policy</h2>
<p>The renter agrees that guest count must not exceed the venue maximum capacity or the confirmed booking guest count.</p>
<h2>Payment Policy</h2>
<p>The booking is confirmed only after required payment is received and the reservation is approved by Haven Retreat.</p>
<h2>Property Rules</h2>
<p>Guests must respect the property, neighborhood, pool and outdoor areas. The renter is responsible for guest conduct and damages.</p>
<h2>Cancellation And Changes</h2>
<p>Schedule changes, cancellations and refunds are subject to Haven Retreat approval and current booking policies.</p>
`;

function featureRows(packageId: string, seed: PackageSeed) {
  let sortOrder = 1;
  const groupRows = (
    group: PackageFeatureGroup,
    labels: string[],
    valueByLabel?: Record<string, string>
  ) =>
    labels.map((label) => ({
      packageId,
      group,
      label,
      value: valueByLabel?.[label] ?? null,
      icon: null,
      sortOrder: sortOrder++,
    }));

  return [
    ...groupRows(PackageFeatureGroup.INCLUDED, seed.included),
    ...groupRows(PackageFeatureGroup.DECORATION, seed.decoration ?? []),
    ...groupRows(PackageFeatureGroup.CLEANING, seed.cleaning),
    ...seed.priceBreakdown.map((row) => ({
      packageId,
      group: PackageFeatureGroup.PRICE_BREAKDOWN,
      label: row.label,
      value: row.value,
      icon: null,
      sortOrder: sortOrder++,
    })),
  ];
}

async function seedLocation() {
  console.log("Seeding location...");

  const location = await prisma.location.upsert({
    where: { name: LOCATION.name },
    update: {
      city: LOCATION.city,
      sortOrder: LOCATION.sortOrder,
      isActive: true,
    },
    create: {
      name: LOCATION.name,
      city: LOCATION.city,
      sortOrder: LOCATION.sortOrder,
      isActive: true,
    },
  });

  console.log("Location seeded", { locations: 1 });
  return { location };
}

async function seedVenuePackages(locationId: string) {
  console.log("Seeding venue, event packages, package features, and event add-ons...");

  await prisma.eventPackage.deleteMany({
    where: {
      slug: { in: ["essential-package", "celebration-package", "signature-package"] },
    },
  });

  const venue = await prisma.venue.upsert({
    where: { slug: VENUE.slug },
    update: {
      name: VENUE.name,
      businessType: VENUE.businessType,
      description: VENUE.description,
      address: VENUE.address,
      city: VENUE.city,
      state: VENUE.state,
      zipCode: VENUE.zipCode,
      country: VENUE.country,
      images: VENUE.images,
      maxGuests: VENUE.maxGuests,
      cleaningFee: VENUE.cleaningFee,
      setupBufferMinutes: VENUE.setupBufferMinutes,
      isActive: true,
    },
    create: {
      name: VENUE.name,
      slug: VENUE.slug,
      businessType: VENUE.businessType,
      description: VENUE.description,
      address: VENUE.address,
      city: VENUE.city,
      state: VENUE.state,
      zipCode: VENUE.zipCode,
      country: VENUE.country,
      images: VENUE.images,
      maxGuests: VENUE.maxGuests,
      cleaningFee: VENUE.cleaningFee,
      setupBufferMinutes: VENUE.setupBufferMinutes,
      isActive: true,
    },
  });

  for (const seed of PACKAGE_SEEDS) {
    const eventPackage = await prisma.eventPackage.upsert({
      where: { slug: seed.slug },
      update: {
        venueId: venue.id,
        locationId,
        name: seed.name,
        shortDescription: seed.shortDescription,
        guestLimit: seed.guestLimit,
        eventDurationHours: 4,
        complimentarySetupHours: 1,
        hourlyRate: seed.hourlyRate,
        rentalAmount: seed.rentalAmount,
        decorationAmount: seed.decorationAmount,
        decorationAddonPrice: seed.decorationAddonPrice,
        decorationDefault: seed.decorationDefault,
        cleaningAmount: seed.cleaningAmount,
        subtotalAmount: seed.subtotalAmount,
        savingsAmount: seed.savingsAmount,
        finalAmount: seed.finalAmount,
        isPopular: seed.isPopular,
        sortOrder: seed.sortOrder,
        isActive: true,
      },
      create: {
        venueId: venue.id,
        locationId,
        name: seed.name,
        slug: seed.slug,
        shortDescription: seed.shortDescription,
        guestLimit: seed.guestLimit,
        eventDurationHours: 4,
        complimentarySetupHours: 1,
        hourlyRate: seed.hourlyRate,
        rentalAmount: seed.rentalAmount,
        decorationAmount: seed.decorationAmount,
        decorationAddonPrice: seed.decorationAddonPrice,
        decorationDefault: seed.decorationDefault,
        cleaningAmount: seed.cleaningAmount,
        subtotalAmount: seed.subtotalAmount,
        savingsAmount: seed.savingsAmount,
        finalAmount: seed.finalAmount,
        isPopular: seed.isPopular,
        sortOrder: seed.sortOrder,
        isActive: true,
      },
    });

    await prisma.packageFeature.deleteMany({
      where: { packageId: eventPackage.id },
    });
    await prisma.packageFeature.createMany({
      data: featureRows(eventPackage.id, seed),
    });
  }

  await prisma.eventAddon.upsert({
    where: { slug: "extra-guest" },
    update: {
      venueId: venue.id,
      name: "Extra Guest",
      description: "Additional guest above package included count.",
      price: 25,
      category: EventAddonCategory.SERVICE,
      isActive: true,
      sortOrder: 1,
    },
    create: {
      venueId: venue.id,
      name: "Extra Guest",
      slug: "extra-guest",
      description: "Additional guest above package included count.",
      price: 25,
      category: EventAddonCategory.SERVICE,
      isActive: true,
      sortOrder: 1,
    },
  });

  console.log("Venue catalog seeded", {
    venues: 1,
    eventPackages: PACKAGE_SEEDS.length,
    packageFeatures: PACKAGE_SEEDS.reduce(
      (total, seed) =>
        total +
        seed.included.length +
        (seed.decoration?.length ?? 0) +
        seed.cleaning.length +
        seed.priceBreakdown.length,
      0
    ),
    eventAddons: 1,
  });
}

async function seedOccasions() {
  console.log("Seeding occasions and occasion fields...");

  for (const seed of OCCASIONS) {
    const occasion = await prisma.occasion.upsert({
      where: { key: seed.key },
      update: {
        label: seed.label,
        icon: seed.icon,
        subtext: seed.subtext,
        sortOrder: seed.sortOrder,
        isActive: true,
      },
      create: {
        key: seed.key,
        label: seed.label,
        icon: seed.icon,
        subtext: seed.subtext,
        sortOrder: seed.sortOrder,
        isActive: true,
      },
    });

    await prisma.occasionField.deleteMany({
      where: { occasionId: occasion.id },
    });
    await prisma.occasionField.createMany({
      data: seed.fields.map((field) => ({
        occasionId: occasion.id,
        fieldKey: field.fieldKey,
        label: field.label,
        placeholder: field.placeholder,
        isRequired: field.isRequired,
        sortOrder: field.sortOrder,
      })),
    });
  }

  console.log("Occasions seeded", {
    occasions: OCCASIONS.length,
    occasionFields: OCCASIONS.reduce(
      (total, occasion) => total + occasion.fields.length,
      0
    ),
  });
}

async function seedProducts() {
  console.log("Seeding products and product variants...");

  const location = await prisma.location.findFirst({
    where: {
      city: "Miami",
      isActive: true,
    },
    orderBy: { sortOrder: "asc" },
  });

  if (!location) {
    throw new Error("Active Miami location was not created.");
  }

  for (const seed of PRODUCTS) {
    const product = await prisma.product.upsert({
      where: { slug: seed.slug },
      update: {
        name: seed.name,
        image: seed.image,
        description: seed.description,
        locationId: location.id,
        category: ProductCategory.DECORATION,
        bookingCategorySlug: "add-ons",
        bookingCategoryLabel: "Add-ons",
        bookingCategoryDescription: "Choose any optional add-ons for your event.",
        bookingCategorySortOrder: 0,
        isActive: true,
        sortOrder: seed.sortOrder,
      },
      create: {
        name: seed.name,
        slug: seed.slug,
        image: seed.image,
        description: seed.description,
        locationId: location.id,
        category: ProductCategory.DECORATION,
        bookingCategorySlug: "add-ons",
        bookingCategoryLabel: "Add-ons",
        bookingCategoryDescription: "Choose any optional add-ons for your event.",
        bookingCategorySortOrder: 0,
        isActive: true,
        sortOrder: seed.sortOrder,
      },
    });

    await prisma.productVariant.upsert({
      where: {
        productId_label: {
          productId: product.id,
          label: seed.variant.label,
        },
      },
      update: {
        regularPrice: seed.variant.regularPrice,
        salePrice: null,
        stock: seed.stock,
        isDefault: true,
        isActive: true,
        sortOrder: 1,
      },
      create: {
        productId: product.id,
        label: seed.variant.label,
        regularPrice: seed.variant.regularPrice,
        salePrice: null,
        stock: seed.stock,
        isDefault: true,
        isActive: true,
        sortOrder: 1,
      },
    });
  }

  console.log("Products seeded", {
    products: PRODUCTS.length,
    productVariants: PRODUCTS.length,
  });
}

async function seedAppSettings() {
  console.log("Seeding application settings...");

  for (const setting of APP_SETTINGS) {
    await prisma.appSetting.upsert({
      where: { key: setting.key },
      update: { value: setting.value },
      create: setting,
    });
  }

  console.log("Application settings seeded", {
    appSettings: APP_SETTINGS.length,
  });
}

async function seedAgreementTemplate() {
  console.log("Seeding agreement template...");

  const content = AGREEMENT_TEMPLATE_CONTENT.trim();

  await prisma.agreementTemplate.updateMany({
    where: { isActive: true },
    data: { isActive: false },
  });

  await prisma.agreementTemplate.upsert({
    where: {
      title_version: {
        title: "Haven Retreat Event Rental Agreement",
        version: "v1",
      },
    },
    update: {
      content,
      isActive: true,
    },
    create: {
      title: "Haven Retreat Event Rental Agreement",
      version: "v1",
      content,
      isActive: true,
    },
  });

  console.log("Agreement template seeded", {
    agreementTemplates: 1,
    version: "v1",
  });
}

/* --------------------------------
   MAIN RUNNER
--------------------------------- */
async function main() {
  console.log("Starting Haven Retreat master production seed...");
  await seedAdmin();
  const { location } = await seedLocation();
  await seedVenuePackages(location.id);
  await seedOccasions();
  await seedProducts();
  await seedAppSettings();
  await seedAgreementTemplate();

  console.log("Haven Retreat master production seed completed.");
  console.log("Seed checklist", {
    adminUsers: 1,
    location: location.name,
    venues: 1,
    eventPackages: PACKAGE_SEEDS.length,
    packageSlugs: PACKAGE_SEEDS.map((p) => p.slug),
    eventAddons: 1,
    occasions: OCCASIONS.length,
    occasionFields: OCCASIONS.reduce(
      (total, occasion) => total + occasion.fields.length,
      0
    ),
    products: PRODUCTS.length,
    productVariants: PRODUCTS.length,
    appSettings: APP_SETTINGS.length,
    agreementTemplates: 1,
  });
}

/* --------------------------------
   EXECUTE
--------------------------------- */
main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
