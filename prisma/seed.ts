/**
 * Master production seed for the range booking engine.
 *
 * This seed is intentionally small and idempotent. It creates only the
 * dependency data required for the customer booking flow to run:
 * Location -> Theatre -> BookingSettings, Venue -> EventPackages -> Features,
 * basic occasions, app settings, and the active agreement template.
 *
 * It does not create Slot, SlotTemplate, demo products, coupons, or bookings.
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

const THEATRE = {
  name: "Haven Retreat Miami",
  timezone: "America/New_York",
  images: [
    "/media/booking/theatres/theatre-1/theatre-1-1.png",
    "/media/booking/theatres/theatre-2/theatre-2-1.png",
    "/media/booking/theatres/theatre-3/theatre-3-1.png",
  ],
  capacity: 50,
  baseGuests: 30,
  extraPersonPrice: 25,
  decorationPrice: 0,
  hasFood: true,
  menuFile: "/documents/menus/havenretreat-menu.pdf",
  mapUrl: "https://maps.app.goo.gl/JS3stLbATdCEjDG96",
  footerMessage: "Custom event time ranges available from 9 AM to 11 PM.",
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
  images: THEATRE.images,
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
  rentalAmount: number;
  decorationAmount: number;
  cleaningAmount: number;
  subtotalAmount: number;
  savingsAmount: number;
  finalAmount: number;
  isPopular: boolean;
  sortOrder: number;
  included: string[];
  decoration: string[];
  cleaning: string[];
  priceBreakdown: Array<{ label: string; value: string }>;
};

const PACKAGE_SEEDS: PackageSeed[] = [
  {
    name: "Essential Package",
    slug: "essential-package",
    shortDescription:
      "Flexible event package for intimate gatherings and styled celebrations.",
    guestLimit: 30,
    rentalAmount: 500,
    decorationAmount: 400,
    cleaningAmount: 95,
    subtotalAmount: 1111,
    savingsAmount: 0,
    finalAmount: 1111,
    isPopular: false,
    sortOrder: 1,
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
      "LED Happy Birthday sign",
      "Cake stand included",
    ],
    cleaning: ["Event cleaning", "Trash removal included"],
    priceBreakdown: [
      { label: "Rental", value: "$500" },
      { label: "Tables", value: "$45" },
      { label: "Chairs", value: "$72" },
      { label: "Decoration", value: "$400" },
      { label: "Cleaning", value: "$95" },
    ],
  },
  {
    name: "Celebration Package",
    slug: "celebration-package",
    shortDescription:
      "Most popular package for birthdays, showers, and medium-sized celebrations.",
    guestLimit: 40,
    rentalAmount: 580,
    decorationAmount: 400,
    cleaningAmount: 95,
    subtotalAmount: 1231,
    savingsAmount: 0,
    finalAmount: 1231,
    isPopular: true,
    sortOrder: 2,
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
      "LED Happy Birthday sign",
      "Cake stand included",
    ],
    cleaning: ["Event cleaning", "Trash removal included"],
    priceBreakdown: [
      { label: "Rental", value: "$580" },
      { label: "Tables", value: "$60" },
      { label: "Chairs", value: "$96" },
      { label: "Decoration", value: "$400" },
      { label: "Cleaning", value: "$95" },
    ],
  },
  {
    name: "Signature Package",
    slug: "signature-package",
    shortDescription:
      "Larger-format package designed for elevated celebrations and fuller guest counts.",
    guestLimit: 50,
    rentalAmount: 700,
    decorationAmount: 400,
    cleaningAmount: 95,
    subtotalAmount: 1405,
    savingsAmount: 0,
    finalAmount: 1405,
    isPopular: false,
    sortOrder: 3,
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
      "LED Happy Birthday sign",
      "Cake stand included",
    ],
    cleaning: ["Event cleaning", "Trash removal included"],
    priceBreakdown: [
      { label: "Rental", value: "$700" },
      { label: "Tables", value: "$90" },
      { label: "Chairs", value: "$120" },
      { label: "Decoration", value: "$400" },
      { label: "Cleaning", value: "$95" },
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
    stock: 20,
    sortOrder: 1,
    variant: { label: "Per Table", regularPrice: 15 },
  },
  {
    name: "Chairs",
    slug: "chairs",
    image: "/media/booking/products/add-ons/chairs.jpeg",
    description: "Extra guest chairs for larger celebrations and custom layouts.",
    stock: 120,
    sortOrder: 2,
    variant: { label: "Per Chair", regularPrice: 3 },
  },
  {
    name: "Bartender",
    slug: "bartender",
    image: "/media/booking/products/add-ons/bartender.avif",
    description: "Professional bartender service for your private event.",
    stock: 2,
    sortOrder: 3,
    variant: { label: "Per Booking", regularPrice: 200 },
  },
  {
    name: "Pool Heater",
    slug: "pool-heater",
    image: "/media/booking/products/add-ons/pool-heater.avif",
    description: "Warm up the pool in advance for a more comfortable evening event.",
    stock: 1,
    sortOrder: 4,
    variant: { label: "Per Booking", regularPrice: 150 },
  },
  {
    name: "Pool Slide",
    slug: "pool-slide",
    image: "/media/booking/products/add-ons/pool-slide.jpeg",
    description: "Add the pool slide to make the backyard experience more fun.",
    stock: 1,
    sortOrder: 5,
    variant: { label: "Per Booking", regularPrice: 300 },
  },
  {
    name: "Balloon Arch",
    slug: "balloon-arch",
    image: "/media/booking/products/add-ons/balloon-arch.avif",
    description: "Custom balloon arch to create a standout event entrance or focal point.",
    stock: 4,
    sortOrder: 6,
    variant: { label: "Per Setup", regularPrice: 300 },
  },
  {
    name: "Backdrop Balloons",
    slug: "backdrop-balloons",
    image: "/media/booking/products/add-ons/backdrop-balloons.avif",
    description: "Decorative balloon backdrop for photos, gifts, or cake setup.",
    stock: 4,
    sortOrder: 7,
    variant: { label: "Per Setup", regularPrice: 350 },
  },
  {
    name: "BABY Marquee + Balloon",
    slug: "baby-marque-baloon",
    image: "/media/booking/products/add-ons/baby-marque-baloon.avif",
    description: "Statement marquee setup with balloons for baby showers and family celebrations.",
    stock: 2,
    sortOrder: 8,
    variant: { label: "Per Setup", regularPrice: 500 },
  },
  {
    name: "Tent 10x10",
    slug: "tent-10x10",
    image: "/media/booking/products/add-ons/tent.jpeg",
    description: "Shade and weather cover for outdoor gatherings and event setups.",
    stock: 6,
    sortOrder: 9,
    variant: { label: "Per Tent", regularPrice: 45 },
  },
  {
    name: "Hot Tub",
    slug: "hot-tub",
    image: "/media/booking/products/add-ons/hot-tub.avif",
    description: "Enable the hot tub for a cozy and upgraded backyard experience.",
    stock: 1,
    sortOrder: 10,
    variant: { label: "Per Booking", regularPrice: 50 },
  },
] as const;

/* --------------------------------
   APPLICATION SETTINGS DATA
--------------------------------- */
const APP_SETTINGS = [
  { key: "ADVANCE_PAYMENT_AMOUNT", value: "150" },
  { key: "BOOKING_LOCK_MINUTES", value: "10" },
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
    ...groupRows(PackageFeatureGroup.DECORATION, seed.decoration),
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

async function seedLocationAndTheatre() {
  console.log("Seeding location, theatre, and booking settings...");

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

  const theatre = await prisma.theatre.upsert({
    where: {
      name_locationId: {
        name: THEATRE.name,
        locationId: location.id,
      },
    },
    update: {
      timezone: THEATRE.timezone,
      images: THEATRE.images,
      capacity: THEATRE.capacity,
      baseGuests: THEATRE.baseGuests,
      extraPersonPrice: THEATRE.extraPersonPrice,
      decorationPrice: THEATRE.decorationPrice,
      hasFood: THEATRE.hasFood,
      menuFile: THEATRE.menuFile,
      mapUrl: THEATRE.mapUrl,
      footerMessage: THEATRE.footerMessage,
      sortOrder: THEATRE.sortOrder,
      isActive: true,
    },
    create: {
      name: THEATRE.name,
      timezone: THEATRE.timezone,
      images: THEATRE.images,
      capacity: THEATRE.capacity,
      baseGuests: THEATRE.baseGuests,
      extraPersonPrice: THEATRE.extraPersonPrice,
      decorationPrice: THEATRE.decorationPrice,
      hasFood: THEATRE.hasFood,
      menuFile: THEATRE.menuFile,
      mapUrl: THEATRE.mapUrl,
      footerMessage: THEATRE.footerMessage,
      sortOrder: THEATRE.sortOrder,
      isActive: true,
      locationId: location.id,
    },
  });

  await prisma.bookingSettings.upsert({
    where: { theatreId: theatre.id },
    update: {
      businessOpenTime: "09:00",
      businessCloseTime: "23:00",
      minimumDurationMinutes: 240,
      bufferMinutes: 60,
      lockDurationMinutes: 10,
      maximumGuests: 50,
    },
    create: {
      theatreId: theatre.id,
      businessOpenTime: "09:00",
      businessCloseTime: "23:00",
      minimumDurationMinutes: 240,
      bufferMinutes: 60,
      lockDurationMinutes: 10,
      maximumGuests: 50,
    },
  });

  console.log("Location, theatre, and booking settings seeded", {
    locations: 1,
    theatres: 1,
    bookingSettings: 1,
  });

  return { location, theatre };
}

async function seedVenuePackages() {
  console.log("Seeding venue, event packages, package features, and event add-ons...");

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
        name: seed.name,
        shortDescription: seed.shortDescription,
        guestLimit: seed.guestLimit,
        eventDurationHours: 4,
        complimentarySetupHours: 1,
        rentalAmount: seed.rentalAmount,
        decorationAmount: seed.decorationAmount,
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
        name: seed.name,
        slug: seed.slug,
        shortDescription: seed.shortDescription,
        guestLimit: seed.guestLimit,
        eventDurationHours: 4,
        complimentarySetupHours: 1,
        rentalAmount: seed.rentalAmount,
        decorationAmount: seed.decorationAmount,
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
        seed.decoration.length +
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

  await prisma.agreementTemplate.upsert({
    where: {
      title_version: {
        title: "Haven Retreat Event Rental Agreement",
        version: "v2",
      },
    },
    update: {
      content,
      isActive: true,
    },
    create: {
      title: "Haven Retreat Event Rental Agreement",
      version: "v2",
      content,
      isActive: true,
    },
  });

  console.log("Agreement template seeded", {
    agreementTemplates: 1,
    version: "v2",
  });
}

/* --------------------------------
   MAIN RUNNER
--------------------------------- */
async function main() {
  console.log("Starting Haven Retreat master production seed...");
  await seedAdmin();
  const { location, theatre } = await seedLocationAndTheatre();
  await seedVenuePackages();
  await seedOccasions();
  await seedProducts();
  await seedAppSettings();
  await seedAgreementTemplate();

  console.log("Haven Retreat master production seed completed.");
  console.log("Seed checklist", {
    adminUsers: 1,
    location: location.name,
    theatre: theatre.name,
    bookingSettings: 1,
    venues: 1,
    eventPackages: PACKAGE_SEEDS.length,
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
    rangeAvailability: "BookingSettings + Bookings + BookingLocks + AvailabilityBlocks",
    slotsCreated: 0,
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
