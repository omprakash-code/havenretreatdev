// Add Data to this file to seed your database
 /**
 * MASTER SEED FILE
 * Runs all seed scripts in sequence.
 * Safe to run multiple times (uses upsert).
 */

import "dotenv/config";
import { PrismaClient, UserRole, ProductCategory, type Prisma } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcrypt";
import { LOCATION_SEED_CONFIGS } from "./seed-data/location-theatre-config.js";
import { HAVEN_RETREAT_VENUE_CONFIG } from "./seed-data/venue-package-config.js";

/* --------------------------------
   Prisma Setup (ONE INSTANCE ONLY)
--------------------------------- */
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

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
      passwordHash: hashedPassword,
      role: UserRole.ADMIN,
      isActive: true,
      isGuest: false,
    },
    create: {
      name: "Arpan Mittal",
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
   LOCATION SEED
--------------------------------- */
async function seedLocations() {
  console.log("Seeding locations...");

  for (const loc of LOCATION_SEED_CONFIGS) {
    await prisma.location.upsert({
      where: { name: loc.name },
      update: {
        city: loc.city,
        sortOrder: loc.sortOrder,
        isActive: true,
      },
      create: {
        name: loc.name,
        city: loc.city,
        sortOrder: loc.sortOrder,
        isActive: true,
      },
    });
  }

  console.log(" Locations seeded");
}

/* -----------------------------
   Seed Theatres
------------------------------ */
async function seedTheatres() {
  console.log("Seeding theatres");

  for (const locationConfig of LOCATION_SEED_CONFIGS) {
    const location = await prisma.location.findUnique({
      where: { name: locationConfig.name },
    });

    if (!location) {
      throw new Error(`${locationConfig.name} location not found. Seed locations first.`);
    }

    for (const theatre of locationConfig.theatres) {
      await prisma.theatre.upsert({
        where: {
          name_locationId: {
            name: theatre.name,
            locationId: location.id,
          },
        },
        update: {
          images: theatre.images,
          capacity: theatre.capacity,
          baseGuests: theatre.baseGuests,
          hasFood: theatre.hasFood,
          decorationPrice: theatre.decorationPrice,
          extraPersonPrice: theatre.extraPersonPrice,
          menuFile: theatre.menuFile,
          mapUrl: theatre.mapUrl,
          footerMessage: theatre.footerMessage ?? null,
          cardContent: theatre.cardContent as Prisma.InputJsonValue | undefined,
          sortOrder: theatre.sortOrder,
          isActive: true,
        },
        create: {
          name: theatre.name,
          images: theatre.images,
          capacity: theatre.capacity,
          baseGuests: theatre.baseGuests,
          hasFood: theatre.hasFood,
          decorationPrice: theatre.decorationPrice,
          extraPersonPrice: theatre.extraPersonPrice,
          menuFile: theatre.menuFile,
          mapUrl: theatre.mapUrl,
          footerMessage: theatre.footerMessage ?? null,
          cardContent: theatre.cardContent as Prisma.InputJsonValue | undefined,
          sortOrder: theatre.sortOrder,
          isActive: true,
          locationId: location.id,
        },
      });
    }
  }

  console.log("Theatres seeded");
}

/* -----------------------------
   Seed Venue Event Module
------------------------------ */
async function seedVenueEventModule() {
  console.log("Seeding venue event module...");

  const config = HAVEN_RETREAT_VENUE_CONFIG;

  const venue = await prisma.venue.upsert({
    where: { slug: config.slug },
    update: {
      name: config.name,
      businessType: config.businessType,
      description: config.description,
      address: config.address,
      city: config.city,
      state: config.state,
      zipCode: config.zipCode,
      country: config.country,
      phone: config.phone ?? null,
      email: config.email ?? null,
      images: config.images,
      maxGuests: config.maxGuests,
      cleaningFee: config.cleaningFee,
      setupBufferMinutes: config.setupBufferMinutes,
      isActive: config.isActive,
    },
    create: {
      name: config.name,
      slug: config.slug,
      businessType: config.businessType,
      description: config.description,
      address: config.address,
      city: config.city,
      state: config.state,
      zipCode: config.zipCode,
      country: config.country,
      phone: config.phone ?? null,
      email: config.email ?? null,
      images: config.images,
      maxGuests: config.maxGuests,
      cleaningFee: config.cleaningFee,
      setupBufferMinutes: config.setupBufferMinutes,
      isActive: config.isActive,
    },
  });

  for (const eventPackage of config.packages) {
    const savedPackage = await prisma.eventPackage.upsert({
      where: { slug: eventPackage.slug },
      update: {
        venueId: venue.id,
        name: eventPackage.name,
        shortDescription: eventPackage.shortDescription,
        guestLimit: eventPackage.guestLimit,
        eventDurationHours: eventPackage.eventDurationHours,
        complimentarySetupHours: eventPackage.complimentarySetupHours,
        rentalAmount: eventPackage.rentalAmount,
        decorationAmount: eventPackage.decorationAmount,
        cleaningAmount: eventPackage.cleaningAmount,
        subtotalAmount: eventPackage.subtotalAmount,
        savingsAmount: eventPackage.savingsAmount,
        finalAmount: eventPackage.finalAmount,
        isPopular: eventPackage.isPopular,
        sortOrder: eventPackage.sortOrder,
        isActive: eventPackage.isActive,
      },
      create: {
        venueId: venue.id,
        name: eventPackage.name,
        slug: eventPackage.slug,
        shortDescription: eventPackage.shortDescription,
        guestLimit: eventPackage.guestLimit,
        eventDurationHours: eventPackage.eventDurationHours,
        complimentarySetupHours: eventPackage.complimentarySetupHours,
        rentalAmount: eventPackage.rentalAmount,
        decorationAmount: eventPackage.decorationAmount,
        cleaningAmount: eventPackage.cleaningAmount,
        subtotalAmount: eventPackage.subtotalAmount,
        savingsAmount: eventPackage.savingsAmount,
        finalAmount: eventPackage.finalAmount,
        isPopular: eventPackage.isPopular,
        sortOrder: eventPackage.sortOrder,
        isActive: eventPackage.isActive,
      },
    });

    await prisma.packageFeature.deleteMany({
      where: { packageId: savedPackage.id },
    });

    if (eventPackage.features.length > 0) {
      await prisma.packageFeature.createMany({
        data: eventPackage.features.map((feature) => ({
          packageId: savedPackage.id,
          group: feature.group,
          label: feature.label,
          value: feature.value ?? null,
          icon: feature.icon ?? null,
          sortOrder: feature.sortOrder,
        })),
      });
    }

    for (const addon of eventPackage.addons ?? []) {
      await prisma.eventAddon.upsert({
        where: { slug: addon.slug },
        update: {
          venueId: venue.id,
          packageId: savedPackage.id,
          name: addon.name,
          description: addon.description ?? null,
          price: addon.price,
          category: addon.category,
          image: addon.image ?? null,
          sortOrder: addon.sortOrder,
          isActive: true,
        },
        create: {
          venueId: venue.id,
          packageId: savedPackage.id,
          name: addon.name,
          slug: addon.slug,
          description: addon.description ?? null,
          price: addon.price,
          category: addon.category,
          image: addon.image ?? null,
          sortOrder: addon.sortOrder,
          isActive: true,
        },
      });
    }
  }

  for (const addon of config.addons ?? []) {
    await prisma.eventAddon.upsert({
      where: { slug: addon.slug },
      update: {
        venueId: venue.id,
        packageId: null,
        name: addon.name,
        description: addon.description ?? null,
        price: addon.price,
        category: addon.category,
        image: addon.image ?? null,
        sortOrder: addon.sortOrder,
        isActive: true,
      },
      create: {
        venueId: venue.id,
        packageId: null,
        name: addon.name,
        slug: addon.slug,
        description: addon.description ?? null,
        price: addon.price,
        category: addon.category,
        image: addon.image ?? null,
        sortOrder: addon.sortOrder,
        isActive: true,
      },
    });
  }

  console.log("Venue event module seeded");
}

/* -----------------------------
   Seed Agreement Templates
------------------------------ */
async function seedAgreementTemplates() {
  console.log("Seeding agreement templates");

  const content = [
    "This agreement confirms the event booking request submitted for the selected venue package.",
    "",
    "The customer agrees that event details, selected add-ons, guest count, and venue rules will be honored as captured during checkout.",
    "",
    "Final payment collection, arrival instructions, permitted use, damage policy, and cancellation handling remain subject to the venue's operating policy and manual confirmation workflow.",
    "",
    "By signing below, the customer confirms that the submitted contact information is accurate and that they authorize the venue to proceed with payment coordination for this booking.",
  ].join("\n");

  await prisma.agreementTemplate.upsert({
    where: {
      title_version: {
        title: "Venue Booking Agreement",
        version: "v1",
      },
    },
    update: {
      content,
      isActive: true,
    },
    create: {
      title: "Venue Booking Agreement",
      version: "v1",
      content,
      isActive: true,
    },
  });

  console.log("Agreement templates seeded");
}

/* -----------------------------
   Helpers
------------------------------ */
function calculateDuration(startTime: string, endTime: string): number {
  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);

  const startMin = sh * 60 + sm;
  const endMin = eh * 60 + em;

  return endMin > startMin
    ? endMin - startMin
    : endMin + 1440 - startMin;
}

/* -----------------------------
   Seed Slot Templates
------------------------------ */
async function seedSlotTemplates(): Promise<void> {
  console.log("Seeding slot templates");

  for (const locationConfig of LOCATION_SEED_CONFIGS) {
    const location = await prisma.location.findUnique({
      where: { name: locationConfig.name },
      select: {
        id: true,
        theatres: {
          where: { isActive: true },
          select: { id: true, name: true },
        },
      },
    });

    if (!location) {
      throw new Error(`${locationConfig.name} location not found. Seed locations first.`);
    }

    const theatreIdByName = new Map(
      location.theatres.map((theatre) => [theatre.name, theatre.id])
    );

    for (const theatreConfig of locationConfig.theatres) {
      const theatreId = theatreIdByName.get(theatreConfig.name);

      if (!theatreId) {
        throw new Error(
          `${theatreConfig.name} not found for ${locationConfig.name}. Seed theatres first.`
        );
      }

      for (const slot of theatreConfig.slotTemplates) {
        const durationMin = calculateDuration(slot.startTime, slot.endTime);

        await prisma.slotTemplate.upsert({
          where: {
            theatreId_startTime_endTime: {
              theatreId,
              startTime: slot.startTime,
              endTime: slot.endTime,
            },
          },
          update: {
            regularPrice: slot.regularPrice,
            salePrice: slot.salePrice ?? null,
            durationMin,
            bufferMin: slot.bufferMin ?? 30,
            decorationMandatory: slot.decorationMandatory ?? false,
            isActive: true,
          },
          create: {
            theatreId,
            startTime: slot.startTime,
            endTime: slot.endTime,
            durationMin,
            bufferMin: slot.bufferMin ?? 30,
            regularPrice: slot.regularPrice,
            salePrice: slot.salePrice ?? null,
            decorationMandatory: slot.decorationMandatory ?? false,
            isActive: true,
          },
        });
      }
    }
  }

  console.log("Slot templates seeded");
}

/* -----------------------------
   Seed Slots
------------------------------ */



/* -----------------------------
   Seed Occasions
------------------------------ */
async function seedOccasions(): Promise<void> {
  console.log("Seeding occasions");

  const occasions = [
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
  ];

  for (const occasion of occasions) {
    const savedOccasion = await prisma.occasion.upsert({
      where: { key: occasion.key },
      update: {
        label: occasion.label,
        icon: occasion.icon,
        subtext: occasion.subtext,
        sortOrder: occasion.sortOrder,
        isActive: true,
      },
      create: {
        key: occasion.key,
        label: occasion.label,
        icon: occasion.icon,
        subtext: occasion.subtext,
        sortOrder: occasion.sortOrder,
        isActive: true,
      },
    });

    await prisma.occasionField.deleteMany({
      where: { occasionId: savedOccasion.id },
    });

    await prisma.occasionField.createMany({
      data: occasion.fields.map((field) => ({
        occasionId: savedOccasion.id,
        fieldKey: field.fieldKey,
        label: field.label,
        placeholder: field.placeholder,
        isRequired: field.isRequired,
        sortOrder: field.sortOrder,
      })),
    });
  }

  console.log("Occasions seeded");
}

/* -----------------------------
   Seed Products
------------------------------ */
async function seedProducts(): Promise<void> {
  console.log("Seeding products");

  const DEFAULT_VARIANT_STOCK = 50;
  const bookingCategoryLabel = "Add-ons";
  const bookingCategorySlug = "add-ons";
  const bookingCategoryDescription =
    "Choose any optional add-ons for your event.";

  type SeedVariant = {
    label: string;
    regularPrice: number;
    salePrice?: number | null;
    stock?: number;
    sortOrder: number;
    isDefault: boolean;
  };

  type SeedProduct = {
    name: string;
    slug: string;
    image: string;
    description: string;
    category: ProductCategory;
    stock?: number;
    sortOrder: number;
    variants: SeedVariant[];
  };

  const miamiLocation = await prisma.location.findFirst({
    where: {
      name: "Miami",
      isActive: true,
    },
  });

  if (!miamiLocation) {
    throw new Error("Miami location not found. Seed locations first.");
  }

  const products: SeedProduct[] = [
    {
      name: "Tables",
      slug: "tables",
      image: "/media/booking/products/add-ons/tables.jpeg",
      description: "Additional event tables for food, cake, gifts, or guest seating.",
      category: ProductCategory.DECORATION,
      stock: 20,
      sortOrder: 1,
      variants: [
        { label: "Per Table", regularPrice: 15, sortOrder: 1, isDefault: true, stock: 20 },
      ],
    },
    {
      name: "Chairs",
      slug: "chairs",
      image: "/media/booking/products/add-ons/chairs.jpeg",
      description: "Extra guest chairs for larger celebrations and custom layouts.",
      category: ProductCategory.DECORATION,
      stock: 120,
      sortOrder: 2,
      variants: [
        { label: "Per Chair", regularPrice: 3, sortOrder: 1, isDefault: true, stock: 120 },
      ],
    },
    {
      name: "Bartender",
      slug: "bartender",
      image: "/media/booking/products/add-ons/bartender.avif",
      description: "Professional bartender service for your private event.",
      category: ProductCategory.DECORATION,
      stock: 2,
      sortOrder: 3,
      variants: [
        { label: "Per Booking", regularPrice: 200, sortOrder: 1, isDefault: true, stock: 2 },
      ],
    },
    {
      name: "Pool Heater",
      slug: "pool-heater",
      image: "/media/booking/products/add-ons/pool-heater.avif",
      description: "Warm up the pool in advance for a more comfortable evening event.",
      category: ProductCategory.DECORATION,
      stock: 1,
      sortOrder: 4,
      variants: [
        { label: "Per Booking", regularPrice: 150, sortOrder: 1, isDefault: true, stock: 1 },
      ],
    },
    {
      name: "Pool Slide",
      slug: "pool-slide",
      image: "/media/booking/products/add-ons/pool-slide.jpeg",
      description: "Add the pool slide to make the backyard experience more fun.",
      category: ProductCategory.DECORATION,
      stock: 1,
      sortOrder: 5,
      variants: [
        { label: "Per Booking", regularPrice: 300, sortOrder: 1, isDefault: true, stock: 1 },
      ],
    },
    {
      name: "Balloon Arch",
      slug: "balloon-arch",
      image: "/media/booking/products/add-ons/balloon-arch.avif",
      description: "Custom balloon arch to create a standout event entrance or focal point.",
      category: ProductCategory.DECORATION,
      stock: 4,
      sortOrder: 6,
      variants: [
        { label: "Per Setup", regularPrice: 300, sortOrder: 1, isDefault: true, stock: 4 },
      ],
    },
    {
      name: "Backdrop Balloons",
      slug: "backdrop-balloons",
      image: "/media/booking/products/add-ons/backdrop-balloons.avif",
      description: "Decorative balloon backdrop for photos, gifts, or cake setup.",
      category: ProductCategory.DECORATION,
      stock: 4,
      sortOrder: 7,
      variants: [
        { label: "Per Setup", regularPrice: 350, sortOrder: 1, isDefault: true, stock: 4 },
      ],
    },
    {
      name: "BABY Marque + Baloon",
      slug: "baby-marque-baloon",
      image: "/media/booking/products/add-ons/baby-marque-baloon.avif",
      description: "Statement marquee setup with balloons for baby showers and family celebrations.",
      category: ProductCategory.DECORATION,
      stock: 2,
      sortOrder: 8,
      variants: [
        { label: "Per Setup", regularPrice: 500, sortOrder: 1, isDefault: true, stock: 2 },
      ],
    },
    {
      name: "Tent 10x10",
      slug: "tent-10x10",
      image: "/media/booking/products/add-ons/tent.jpeg",
      description: "Shade and weather cover for outdoor gatherings and event setups.",
      category: ProductCategory.DECORATION,
      stock: 6,
      sortOrder: 9,
      variants: [
        { label: "Per Tent", regularPrice: 45, sortOrder: 1, isDefault: true, stock: 6 },
      ],
    },
    {
      name: "Hot Tub",
      slug: "hot-tub",
      image: "/media/booking/products/add-ons/hot-tub.avif",
      description: "Enable the hot tub for a cozy and upgraded backyard experience.",
      category: ProductCategory.DECORATION,
      stock: 1,
      sortOrder: 10,
      variants: [
        { label: "Per Booking", regularPrice: 50, sortOrder: 1, isDefault: true, stock: 1 },
      ],
    },
  ];

  const keepSlugs = products.map((product) => product.slug);

  await prisma.productVariant.deleteMany({
    where: {
      product: {
        slug: { notIn: keepSlugs },
        bookingItems: { none: {} },
      },
    },
  });

  await prisma.product.deleteMany({
    where: {
      slug: { notIn: keepSlugs },
      bookingItems: { none: {} },
    },
  });

  await prisma.product.updateMany({
    where: {
      slug: { notIn: keepSlugs },
    },
    data: {
      isActive: false,
      bookingCategorySlug: null,
      bookingCategoryLabel: null,
      bookingCategoryDescription: null,
      bookingCategorySortOrder: 0,
    },
  });

  for (const product of products) {
    const savedProduct = await prisma.product.upsert({
      where: { slug: product.slug },
      update: {
        name: product.name,
        image: product.image,
        description: product.description,
        category: product.category,
        locationId: miamiLocation.id,
        bookingCategorySlug,
        bookingCategoryLabel,
        bookingCategoryDescription,
        bookingCategorySortOrder: 0,
        sortOrder: product.sortOrder,
        isActive: true,
      },
      create: {
        name: product.name,
        slug: product.slug,
        image: product.image,
        description: product.description,
        category: product.category,
        locationId: miamiLocation.id,
        bookingCategorySlug,
        bookingCategoryLabel,
        bookingCategoryDescription,
        bookingCategorySortOrder: 0,
        sortOrder: product.sortOrder,
        isActive: true,
      },
    });

    await prisma.productVariant.deleteMany({
      where: { productId: savedProduct.id },
    });

    await prisma.productVariant.createMany({
      data: product.variants.map((v) => ({
        productId: savedProduct.id,
        label: v.label,
        regularPrice: v.regularPrice,
        salePrice: v.salePrice ?? null,
        stock:
          Number.isFinite(v.stock) ? Number(v.stock) : product.stock ?? DEFAULT_VARIANT_STOCK,
        sortOrder: v.sortOrder,
        isDefault: v.isDefault,
        isActive: true,
      })),
    });
  }

  console.log("Products seeded");
}

/* -----------------------------
   Seed App Settings
------------------------------ */
async function seedAppSettings() {
  console.log("Seeding app settings");

  const settings = [
    {
      key: "SPECIAL_SLOT_TEXT",
      value: "Special Price",
    },
    {
      key: "ADVANCE_PAYMENT_AMOUNT",
      value: "750",
    },
    {
      key: "BOOKING_LOCK_MINUTES",
      value: "10",
    },
    {
      key: "SLOT_EXPIRY_MODE",
      value: "START_TIME",
    },
    {
      key: "SLOT_EXPIRY_GRACE_MINUTES",
      value: "30",
    },
  ];

  for (const setting of settings) {
    await prisma.appSetting.upsert({
      where: { key: setting.key },
      update: { value: setting.value },
      create: {
        key: setting.key,
        value: setting.value,
      },
    });
  }

  console.log("App settings seeded");
}


/* --------------------------------
   MAIN RUNNER
--------------------------------- */
async function main(): Promise<void>  {
  console.log("Starting database seed...");

  await seedAdmin();
  await seedLocations();
  await seedVenueEventModule();
  await seedTheatres();
  await seedSlotTemplates();
  // await seedSlots();
  await seedOccasions();

  await seedProducts();
  await seedAppSettings();
  await seedAgreementTemplates();

  console.log("All seeds completed successfully");
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
