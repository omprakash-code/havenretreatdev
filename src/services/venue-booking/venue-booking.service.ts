import crypto from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getRequiredAdvancePaymentAmount } from "@/lib/advance-payment";
import { calculateVenueBookingPricing } from "@/lib/venue-booking-pricing";
import { generateBookingRef } from "@/services/booking/bookingId.service";
import type {
  VenueBookingPersistedDraft,
  VenueBookingPricingSnapshot,
  VenueBookingSelectedAddon,
} from "@/types/venue-booking";

const EDITABLE_BOOKING_STATUSES = [
  "INCOMPLETE",
  "AWAITING_PAYMENT",
  "PAYMENT_PROCESSING",
] as const;

const VENUE_BOOKING_INCLUDE = {
  bookingAddons: {
    include: {
      addon: true,
    },
    orderBy: {
      createdAt: "asc" as const,
    },
  },
  signedAgreements: {
    include: {
      agreementTemplate: true,
    },
    orderBy: {
      signedAt: "desc" as const,
    },
  },
} satisfies Prisma.BookingInclude;

type VenueBookingRecord = Prisma.BookingGetPayload<{
  include: typeof VENUE_BOOKING_INCLUDE;
}>;

type VenueBookingDraftInput = {
  bookingId?: string;
  venueId: string;
  packageId: string;
  eventDate: string;
  eventStartTime: string;
  eventEndTime: string;
  guestCount: number;
  specialInstructions?: string;
  contact: {
    fullName: string;
    email: string;
    phone: string;
  };
};

type VenueAddonSelectionInput = {
  addonId: string;
  quantity: number;
};

function isEditableBookingStatus(status: string) {
  return EDITABLE_BOOKING_STATUSES.includes(
    status as (typeof EDITABLE_BOOKING_STATUSES)[number]
  );
}

function toMoney(value: number | null | undefined) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.trunc(value as number));
}

function formatEventDate(date: Date | null) {
  return date ? date.toISOString().slice(0, 10) : null;
}

function normalizeStringMap(value: Prisma.JsonValue | null | undefined) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const output: Record<string, string> = {};
  Object.entries(value).forEach(([key, entry]) => {
    output[key] = entry == null ? "" : String(entry);
  });
  return output;
}

function parsePricingSnapshot(
  value: Prisma.JsonValue | null | undefined,
  fallback: VenueBookingPricingSnapshot
) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return fallback;
  }

  const candidate = value as Record<string, unknown>;
  const resolved: VenueBookingPricingSnapshot = {
    packageAmount: toMoney(candidate.packageAmount as number | undefined),
    addonsAmount: toMoney(candidate.addonsAmount as number | undefined),
    cleaningFeeAmount: toMoney(candidate.cleaningFeeAmount as number | undefined),
    savingsAmount: toMoney(candidate.savingsAmount as number | undefined),
    subtotalAmount: toMoney(candidate.subtotalAmount as number | undefined),
    depositAmount: toMoney(candidate.depositAmount as number | undefined),
    remainingAmount: toMoney(candidate.remainingAmount as number | undefined),
  };

  if (
    resolved.packageAmount === 0 &&
    resolved.subtotalAmount === 0 &&
    resolved.depositAmount === 0
  ) {
    return fallback;
  }

  return resolved;
}

function buildPricingSnapshotJson(snapshot: VenueBookingPricingSnapshot) {
  return {
    packageAmount: snapshot.packageAmount,
    addonsAmount: snapshot.addonsAmount,
    cleaningFeeAmount: snapshot.cleaningFeeAmount,
    savingsAmount: snapshot.savingsAmount,
    subtotalAmount: snapshot.subtotalAmount,
    depositAmount: snapshot.depositAmount,
    remainingAmount: snapshot.remainingAmount,
  } as Prisma.InputJsonValue;
}

function getFallbackPricingSnapshot(booking: VenueBookingRecord): VenueBookingPricingSnapshot {
  return {
    packageAmount: toMoney(booking.baseAmount),
    addonsAmount: toMoney(booking.productsAmount),
    cleaningFeeAmount: toMoney(booking.extrasAmount),
    savingsAmount: toMoney(booking.discountAmount),
    subtotalAmount: toMoney(booking.totalAmount),
    depositAmount: toMoney(booking.advancePaid),
    remainingAmount: toMoney(booking.remainingPayable),
  };
}

function mapVenueBookingDraft(booking: VenueBookingRecord): VenueBookingPersistedDraft {
  const latestAgreement = booking.signedAgreements[0] ?? null;

  return {
    bookingId: booking.id,
    bookingRef: booking.bookingRef,
    bookingStatus: booking.bookingStatus,
    paymentStatus: booking.paymentStatus ?? null,
    venueId: booking.venueId ?? null,
    packageId: booking.packageId ?? null,
    eventDate: formatEventDate(booking.eventDate),
    eventStartTime: booking.eventStartTime ?? "",
    eventEndTime: booking.eventEndTime ?? "",
    guestCount: booking.guestCount,
    contact: {
      fullName: booking.contactName ?? "",
      email: booking.contactEmail ?? "",
      phone: booking.contactPhone ?? "",
    },
    occasionType: booking.occasionKey ?? null,
    occasionData: normalizeStringMap(booking.occasionData),
    selectedAddons: booking.bookingAddons.map((item) => ({
      addonId: item.addonId,
      name: item.snapshotName,
      category: item.addon.category,
      unitPrice: item.snapshotPrice,
      quantity: item.quantity,
      image: item.addon.image,
    })),
    agreementAccepted: Boolean(booking.termsAcceptedAt),
    signatureImage: latestAgreement?.signatureImage ?? null,
    signerName: latestAgreement?.signerName ?? booking.contactName ?? "",
    specialInstructions: booking.specialInstructions ?? "",
    pricingSnapshot: parsePricingSnapshot(
      booking.pricingSnapshot,
      getFallbackPricingSnapshot(booking)
    ),
  };
}

async function getAdvanceAmountForVenuePricing(tx: Prisma.TransactionClient) {
  return getRequiredAdvancePaymentAmount(tx);
}

async function getNextBookingReference(tx: Prisma.TransactionClient, now: Date) {
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);

  const todayCount = await tx.booking.count({
    where: {
      createdAt: {
        gte: startOfDay,
      },
    },
  });

  return generateBookingRef(now, todayCount + 1);
}

async function getVenuePackageOrThrow(
  tx: Prisma.TransactionClient,
  packageId: string,
  venueId: string
) {
  const eventPackage = await tx.eventPackage.findFirst({
    where: {
      id: packageId,
      venueId,
      isActive: true,
      venue: {
        isActive: true,
      },
    },
    include: {
      venue: true,
    },
  });

  if (!eventPackage) {
    throw new Error("PACKAGE_NOT_FOUND");
  }

  return eventPackage;
}

async function upsertVenueBookingUser(
  tx: Prisma.TransactionClient,
  contact: VenueBookingDraftInput["contact"]
) {
  return tx.user.upsert({
    where: {
      phone: contact.phone,
    },
    update: {
      name: contact.fullName,
      email: contact.email || null,
      isGuest: true,
    },
    create: {
      name: contact.fullName,
      phone: contact.phone,
      email: contact.email || null,
      isGuest: true,
    },
  });
}

async function getEditableVenueBookingOrThrow(
  tx: Prisma.TransactionClient,
  bookingId: string
) {
  const booking = await tx.booking.findUnique({
    where: { id: bookingId },
    include: VENUE_BOOKING_INCLUDE,
  });

  if (!booking) {
    throw new Error("BOOKING_NOT_FOUND");
  }

  if (booking.bookingStatus === "CONFIRMED") {
    throw new Error("BOOKING_FINALIZED");
  }

  if (!isEditableBookingStatus(booking.bookingStatus)) {
    throw new Error("BOOKING_INVALID_STATE");
  }

  if (!booking.venueId || !booking.packageId) {
    throw new Error("BOOKING_INVALID_DETAILS");
  }

  return booking;
}

async function resolveStoredVenueAddons(
  tx: Prisma.TransactionClient,
  booking: VenueBookingRecord
): Promise<VenueBookingSelectedAddon[]> {
  if (!booking.venueId || !booking.packageId || booking.bookingAddons.length === 0) {
    return [];
  }

  const addonIds = booking.bookingAddons.map((item) => item.addonId);
  const activeAddons = await tx.eventAddon.findMany({
    where: {
      id: { in: addonIds },
      isActive: true,
      OR: [
        { packageId: booking.packageId },
        { venueId: booking.venueId, packageId: null },
      ],
    },
  });

  const addonById = new Map(activeAddons.map((addon) => [addon.id, addon]));
  const resolved: Array<VenueBookingSelectedAddon | null> = booking.bookingAddons
    .map((item) => {
      const addon = addonById.get(item.addonId);
      if (!addon) return null;
      return {
        addonId: item.addonId,
        name: item.snapshotName,
        category: addon.category,
        unitPrice: item.snapshotPrice,
        quantity: item.quantity,
        image: addon.image,
      } satisfies VenueBookingSelectedAddon;
    });

  return resolved.filter((item): item is VenueBookingSelectedAddon => item !== null);
}

async function resolveSelectedVenueAddons(
  tx: Prisma.TransactionClient,
  booking: {
    venueId: string;
    packageId: string;
  },
  selectedAddons: VenueAddonSelectionInput[]
): Promise<VenueBookingSelectedAddon[]> {
  const normalizedSelections = selectedAddons
    .filter((item) => item.addonId && item.quantity > 0)
    .map((item) => ({
      addonId: item.addonId,
      quantity: Math.max(1, Math.trunc(item.quantity)),
    }));

  if (normalizedSelections.length === 0) {
    return [];
  }

  const uniqueAddonIds = Array.from(
    new Set(normalizedSelections.map((item) => item.addonId))
  );

  const addons = await tx.eventAddon.findMany({
    where: {
      id: { in: uniqueAddonIds },
      isActive: true,
      OR: [
        { packageId: booking.packageId },
        { venueId: booking.venueId, packageId: null },
      ],
    },
    orderBy: {
      sortOrder: "asc",
    },
  });

  if (addons.length !== uniqueAddonIds.length) {
    throw new Error("INVALID_ADDON_SELECTION");
  }

  const addonById = new Map(addons.map((addon) => [addon.id, addon]));

  return normalizedSelections.map((selection) => {
    const addon = addonById.get(selection.addonId);
    if (!addon) {
      throw new Error("INVALID_ADDON_SELECTION");
    }

    return {
      addonId: addon.id,
      name: addon.name,
      category: addon.category,
      unitPrice: addon.price,
      quantity: selection.quantity,
      image: addon.image,
    } satisfies VenueBookingSelectedAddon;
  });
}

function buildDraftResetFields() {
  return {
    bookingStatus: "INCOMPLETE" as const,
    paymentStatus: null,
    termsAcceptedAt: null,
    razorpayOrderId: null,
    razorpayPaymentId: null,
    razorpaySignature: null,
  };
}

function toEventPackageSummaryShape(
  eventPackage: Awaited<ReturnType<typeof getVenuePackageOrThrow>>
) {
  return {
    id: eventPackage.id,
    venueId: eventPackage.venueId,
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
    venue: {
      id: eventPackage.venue.id,
      name: eventPackage.venue.name,
      slug: eventPackage.venue.slug,
      description: eventPackage.venue.description,
      address: eventPackage.venue.address,
      city: eventPackage.venue.city,
      state: eventPackage.venue.state,
      zipCode: eventPackage.venue.zipCode,
      country: eventPackage.venue.country,
      phone: eventPackage.venue.phone,
      email: eventPackage.venue.email,
      images: eventPackage.venue.images,
      maxGuests: eventPackage.venue.maxGuests,
      cleaningFee: eventPackage.venue.cleaningFee,
      setupBufferMinutes: eventPackage.venue.setupBufferMinutes,
      isActive: eventPackage.venue.isActive,
    },
    features: [],
    featureGroups: {
      included: [],
      decoration: [],
      cleaning: [],
      priceBreakdown: [],
    },
    addons: [],
  };
}

export async function createVenueBookingDraft(input: VenueBookingDraftInput) {
  const now = new Date();

  return prisma.$transaction(async (tx) => {
    const eventPackage = await getVenuePackageOrThrow(
      tx,
      input.packageId,
      input.venueId
    );

    if (input.guestCount < 1 || input.guestCount > eventPackage.guestLimit) {
      throw new Error("INVALID_GUEST_COUNT");
    }

    const user = await upsertVenueBookingUser(tx, input.contact);
    const configuredAdvance = await getAdvanceAmountForVenuePricing(tx);

    let selectedAddons: VenueBookingSelectedAddon[] = [];
    let existingBookingId: string | null = null;

    if (input.bookingId) {
      const existingBooking = await getEditableVenueBookingOrThrow(tx, input.bookingId);
      selectedAddons = await resolveStoredVenueAddons(tx, existingBooking);
      existingBookingId = existingBooking.id;
    }

    const pricingSnapshot = calculateVenueBookingPricing({
      eventPackage: toEventPackageSummaryShape(eventPackage),
      selectedAddons,
      depositAmountOverride: configuredAdvance,
    });

    let booking: VenueBookingRecord;

    if (existingBookingId) {
      await tx.signedAgreement.deleteMany({
        where: { bookingId: existingBookingId },
      });

      booking = await tx.booking.update({
        where: { id: existingBookingId },
        data: {
          userId: user.id,
          contactName: input.contact.fullName,
          contactPhone: input.contact.phone,
          contactEmail: input.contact.email || null,
          venueId: eventPackage.venueId,
          packageId: eventPackage.id,
          eventDate: new Date(input.eventDate),
          eventStartTime: input.eventStartTime,
          eventEndTime: input.eventEndTime,
          guestCount: input.guestCount,
          specialInstructions: input.specialInstructions || null,
          baseAmount: pricingSnapshot.packageAmount,
          extrasAmount: pricingSnapshot.cleaningFeeAmount,
          productsAmount: pricingSnapshot.addonsAmount,
          discountAmount: pricingSnapshot.savingsAmount,
          totalAmount: pricingSnapshot.subtotalAmount,
          decorationAmount: eventPackage.decorationAmount,
          advancePaid: pricingSnapshot.depositAmount,
          remainingPayable: pricingSnapshot.remainingAmount,
          pricingSnapshot: buildPricingSnapshotJson(pricingSnapshot),
          ...buildDraftResetFields(),
        },
        include: VENUE_BOOKING_INCLUDE,
      });
    } else {
      const bookingRef = await getNextBookingReference(tx, now);
      booking = await tx.booking.create({
        data: {
          bookingRef,
          userId: user.id,
          contactName: input.contact.fullName,
          contactPhone: input.contact.phone,
          contactEmail: input.contact.email || null,
          venueId: eventPackage.venueId,
          packageId: eventPackage.id,
          eventDate: new Date(input.eventDate),
          eventStartTime: input.eventStartTime,
          eventEndTime: input.eventEndTime,
          guestCount: input.guestCount,
          specialInstructions: input.specialInstructions || null,
          occasionData: {},
          baseAmount: pricingSnapshot.packageAmount,
          extrasAmount: pricingSnapshot.cleaningFeeAmount,
          productsAmount: pricingSnapshot.addonsAmount,
          discountAmount: pricingSnapshot.savingsAmount,
          totalAmount: pricingSnapshot.subtotalAmount,
          decorationAmount: eventPackage.decorationAmount,
          advancePaid: pricingSnapshot.depositAmount,
          remainingPayable: pricingSnapshot.remainingAmount,
          pricingSnapshot: buildPricingSnapshotJson(pricingSnapshot),
          bookingStatus: "INCOMPLETE",
          paymentStatus: null,
          decorationRequired: true,
        },
        include: VENUE_BOOKING_INCLUDE,
      });
    }

    return {
      draft: mapVenueBookingDraft(booking),
      sessionOwner: crypto.randomUUID(),
    };
  });
}

export async function getVenueBookingDraft(bookingId: string) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: VENUE_BOOKING_INCLUDE,
  });

  if (!booking) {
    throw new Error("BOOKING_NOT_FOUND");
  }

  if (!booking.venueId || !booking.packageId) {
    throw new Error("BOOKING_INVALID_DETAILS");
  }

  return mapVenueBookingDraft(booking);
}

export async function attachVenueOccasion(input: {
  bookingId: string;
  occasionKey: string;
  occasionData: Record<string, string>;
}) {
  return prisma.$transaction(async (tx) => {
    const booking = await getEditableVenueBookingOrThrow(tx, input.bookingId);
    const occasion = await tx.occasion.findFirst({
      where: {
        key: input.occasionKey,
        isActive: true,
      },
    });

    if (!occasion) {
      throw new Error("INVALID_OCCASION");
    }

    await tx.signedAgreement.deleteMany({
      where: { bookingId: booking.id },
    });

    const updated = await tx.booking.update({
      where: { id: booking.id },
      data: {
        occasionKey: occasion.key,
        occasionLabel: occasion.label,
        eventType: occasion.label,
        occasionData: (typeof input.occasionData === "object"
          ? input.occasionData
          : {}) as Prisma.InputJsonValue,
        ...buildDraftResetFields(),
      },
      include: VENUE_BOOKING_INCLUDE,
    });

    return mapVenueBookingDraft(updated);
  });
}

export async function attachVenueAddons(input: {
  bookingId: string;
  selectedAddons: VenueAddonSelectionInput[];
}) {
  return prisma.$transaction(async (tx) => {
    const booking = await getEditableVenueBookingOrThrow(tx, input.bookingId);
    const eventPackage = await getVenuePackageOrThrow(
      tx,
      booking.packageId as string,
      booking.venueId as string
    );
    const selectedAddons = await resolveSelectedVenueAddons(
      tx,
      {
        venueId: booking.venueId as string,
        packageId: booking.packageId as string,
      },
      input.selectedAddons
    );
    const configuredAdvance = await getAdvanceAmountForVenuePricing(tx);
    const pricingSnapshot = calculateVenueBookingPricing({
      eventPackage: toEventPackageSummaryShape(eventPackage),
      selectedAddons,
      depositAmountOverride: configuredAdvance,
    });

    await tx.bookingAddon.deleteMany({
      where: { bookingId: booking.id },
    });

    if (selectedAddons.length > 0) {
      await tx.bookingAddon.createMany({
        data: selectedAddons.map((addon) => ({
          bookingId: booking.id,
          addonId: addon.addonId,
          snapshotName: addon.name,
          quantity: addon.quantity,
          snapshotPrice: addon.unitPrice,
          totalPrice: addon.unitPrice * addon.quantity,
        })),
      });
    }

    await tx.signedAgreement.deleteMany({
      where: { bookingId: booking.id },
    });

    const updated = await tx.booking.update({
      where: { id: booking.id },
      data: {
        baseAmount: pricingSnapshot.packageAmount,
        extrasAmount: pricingSnapshot.cleaningFeeAmount,
        productsAmount: pricingSnapshot.addonsAmount,
        discountAmount: pricingSnapshot.savingsAmount,
        totalAmount: pricingSnapshot.subtotalAmount,
        advancePaid: pricingSnapshot.depositAmount,
        remainingPayable: pricingSnapshot.remainingAmount,
        pricingSnapshot: buildPricingSnapshotJson(pricingSnapshot),
        ...buildDraftResetFields(),
      },
      include: VENUE_BOOKING_INCLUDE,
    });

    return mapVenueBookingDraft(updated);
  });
}

export async function attachVenueAgreement(input: {
  bookingId: string;
  signerName: string;
  signatureImage: string;
  ipAddress?: string | null;
}) {
  return prisma.$transaction(async (tx) => {
    const booking = await getEditableVenueBookingOrThrow(tx, input.bookingId);
    const template = await tx.agreementTemplate.findFirst({
      where: {
        isActive: true,
      },
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    });

    if (!template) {
      throw new Error("AGREEMENT_TEMPLATE_NOT_FOUND");
    }

    if (!booking.contactEmail) {
      throw new Error("CONTACT_EMAIL_REQUIRED");
    }

    if (!input.signerName.trim() || !input.signatureImage.trim()) {
      throw new Error("SIGNATURE_REQUIRED");
    }

    const signedAt = new Date();

    await tx.signedAgreement.deleteMany({
      where: { bookingId: booking.id },
    });

    await tx.signedAgreement.create({
      data: {
        bookingId: booking.id,
        agreementTemplateId: template.id,
        signerName: input.signerName.trim(),
        signerEmail: booking.contactEmail,
        signedAt,
        signatureImage: input.signatureImage,
        ipAddress: input.ipAddress ?? null,
      },
    });

    const updated = await tx.booking.update({
      where: { id: booking.id },
      data: {
        termsAcceptedAt: signedAt,
        bookingStatus: "AWAITING_PAYMENT",
        paymentStatus: "INITIALIZED",
      },
      include: VENUE_BOOKING_INCLUDE,
    });

    return mapVenueBookingDraft(updated);
  });
}

export async function prepareVenuePayment(bookingId: string) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: VENUE_BOOKING_INCLUDE,
  });

  if (!booking) {
    throw new Error("BOOKING_NOT_FOUND");
  }

  if (booking.bookingStatus === "CONFIRMED") {
    throw new Error("BOOKING_FINALIZED");
  }

  if (
    booking.bookingStatus !== "AWAITING_PAYMENT" &&
    booking.bookingStatus !== "PAYMENT_PROCESSING"
  ) {
    throw new Error("BOOKING_INVALID_STATE");
  }

  if (!booking.termsAcceptedAt || booking.signedAgreements.length === 0) {
    throw new Error("AGREEMENT_PENDING");
  }

  if (booking.totalAmount <= 0) {
    throw new Error("BOOKING_INVALID_AMOUNT");
  }

  const configuredAdvance = await getRequiredAdvancePaymentAmount(prisma);
  const advancePayable =
    booking.advancePaid && booking.advancePaid > 0
      ? booking.advancePaid
      : configuredAdvance;

  return {
    draft: mapVenueBookingDraft(booking),
    bookingId: booking.id,
    bookingRef: booking.bookingRef,
    bookingStatus: booking.bookingStatus,
    paymentStatus: booking.paymentStatus ?? null,
    advancePayable,
    totalAmount: booking.totalAmount,
    remainingPayable: Math.max(booking.totalAmount - advancePayable, 0),
  };
}
