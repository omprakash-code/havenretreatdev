-- CreateEnum
CREATE TYPE "VenueBusinessType" AS ENUM ('PRIVATE_THEATRE', 'EVENT_VENUE', 'OTHER');

-- CreateEnum
CREATE TYPE "PackageFeatureGroup" AS ENUM ('INCLUDED', 'DECORATION', 'CLEANING', 'PRICE_BREAKDOWN');

-- CreateEnum
CREATE TYPE "EventAddonCategory" AS ENUM ('DECORATION', 'FURNITURE', 'FOOD_BEVERAGE', 'ENTERTAINMENT', 'SERVICE', 'OTHER');

-- CreateTable
CREATE TABLE "Venue" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "businessType" "VenueBusinessType" NOT NULL DEFAULT 'EVENT_VENUE',
    "description" TEXT,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "zipCode" TEXT,
    "country" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "images" TEXT[],
    "maxGuests" INTEGER,
    "cleaningFee" INTEGER,
    "setupBufferMinutes" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Venue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventPackage" (
    "id" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "shortDescription" TEXT,
    "guestLimit" INTEGER NOT NULL,
    "eventDurationHours" INTEGER NOT NULL,
    "complimentarySetupHours" INTEGER NOT NULL DEFAULT 0,
    "rentalAmount" INTEGER NOT NULL,
    "decorationAmount" INTEGER NOT NULL DEFAULT 0,
    "cleaningAmount" INTEGER NOT NULL DEFAULT 0,
    "subtotalAmount" INTEGER NOT NULL,
    "savingsAmount" INTEGER NOT NULL DEFAULT 0,
    "finalAmount" INTEGER NOT NULL,
    "isPopular" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventPackage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PackageFeature" (
    "id" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "group" "PackageFeatureGroup" NOT NULL,
    "label" TEXT NOT NULL,
    "value" TEXT,
    "icon" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PackageFeature_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventAddon" (
    "id" TEXT NOT NULL,
    "venueId" TEXT,
    "packageId" TEXT,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "price" INTEGER NOT NULL,
    "category" "EventAddonCategory" NOT NULL DEFAULT 'OTHER',
    "image" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventAddon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgreementTemplate" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgreementTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookingAddon" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "addonId" TEXT NOT NULL,
    "snapshotName" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "snapshotPrice" INTEGER NOT NULL,
    "totalPrice" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BookingAddon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SignedAgreement" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "agreementTemplateId" TEXT NOT NULL,
    "signerName" TEXT NOT NULL,
    "signerEmail" TEXT NOT NULL,
    "signedAt" TIMESTAMP(3) NOT NULL,
    "signatureImage" TEXT NOT NULL,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SignedAgreement_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Booking"
ADD COLUMN "venueId" TEXT,
ADD COLUMN "packageId" TEXT,
ADD COLUMN "eventDate" DATE,
ADD COLUMN "eventStartTime" TEXT,
ADD COLUMN "eventEndTime" TEXT,
ADD COLUMN "eventType" TEXT,
ADD COLUMN "specialInstructions" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Venue_slug_key" ON "Venue"("slug");
CREATE INDEX "Venue_businessType_isActive_idx" ON "Venue"("businessType", "isActive");
CREATE INDEX "Venue_city_state_country_idx" ON "Venue"("city", "state", "country");

-- CreateIndex
CREATE UNIQUE INDEX "EventPackage_slug_key" ON "EventPackage"("slug");
CREATE UNIQUE INDEX "EventPackage_venueId_name_key" ON "EventPackage"("venueId", "name");
CREATE INDEX "EventPackage_venueId_isActive_sortOrder_idx" ON "EventPackage"("venueId", "isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "PackageFeature_packageId_group_sortOrder_idx" ON "PackageFeature"("packageId", "group", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "EventAddon_slug_key" ON "EventAddon"("slug");
CREATE INDEX "EventAddon_venueId_isActive_sortOrder_idx" ON "EventAddon"("venueId", "isActive", "sortOrder");
CREATE INDEX "EventAddon_packageId_isActive_sortOrder_idx" ON "EventAddon"("packageId", "isActive", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "AgreementTemplate_title_version_key" ON "AgreementTemplate"("title", "version");
CREATE INDEX "AgreementTemplate_isActive_createdAt_idx" ON "AgreementTemplate"("isActive", "createdAt");

-- CreateIndex
CREATE INDEX "Booking_venueId_packageId_eventDate_idx" ON "Booking"("venueId", "packageId", "eventDate");

-- CreateIndex
CREATE INDEX "BookingAddon_bookingId_idx" ON "BookingAddon"("bookingId");
CREATE INDEX "BookingAddon_addonId_idx" ON "BookingAddon"("addonId");
CREATE UNIQUE INDEX "BookingAddon_bookingId_addonId_key" ON "BookingAddon"("bookingId", "addonId");

-- CreateIndex
CREATE INDEX "SignedAgreement_bookingId_signedAt_idx" ON "SignedAgreement"("bookingId", "signedAt");
CREATE INDEX "SignedAgreement_agreementTemplateId_idx" ON "SignedAgreement"("agreementTemplateId");

-- AddForeignKey
ALTER TABLE "EventPackage" ADD CONSTRAINT "EventPackage_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PackageFeature" ADD CONSTRAINT "PackageFeature_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "EventPackage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EventAddon" ADD CONSTRAINT "EventAddon_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EventAddon" ADD CONSTRAINT "EventAddon_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "EventPackage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "EventPackage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BookingAddon" ADD CONSTRAINT "BookingAddon_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BookingAddon" ADD CONSTRAINT "BookingAddon_addonId_fkey" FOREIGN KEY ("addonId") REFERENCES "EventAddon"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SignedAgreement" ADD CONSTRAINT "SignedAgreement_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SignedAgreement" ADD CONSTRAINT "SignedAgreement_agreementTemplateId_fkey" FOREIGN KEY ("agreementTemplateId") REFERENCES "AgreementTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
