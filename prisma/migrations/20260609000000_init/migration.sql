-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "VenueBusinessType" AS ENUM ('PRIVATE_THEATRE', 'EVENT_VENUE', 'OTHER');

-- CreateEnum
CREATE TYPE "PackageFeatureGroup" AS ENUM ('INCLUDED', 'DECORATION', 'CLEANING', 'PRICE_BREAKDOWN');

-- CreateEnum
CREATE TYPE "EventAddonCategory" AS ENUM ('DECORATION', 'FURNITURE', 'FOOD_BEVERAGE', 'ENTERTAINMENT', 'SERVICE', 'OTHER');

-- CreateEnum
CREATE TYPE "SlotStatus" AS ENUM ('AVAILABLE', 'BOOKED', 'LOCKED', 'DISABLED');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('CUSTOMER', 'ADMIN', 'MANAGER');

-- CreateEnum
CREATE TYPE "BookingLockStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'RELEASED', 'CONSUMED');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('INCOMPLETE', 'AWAITING_PAYMENT', 'PAYMENT_PROCESSING', 'CONFIRMED', 'CANCELLED', 'ABANDONED', 'PAID_EXPIRED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('INITIALIZED', 'AWAITING_PAYMENT', 'PAID', 'MANUAL_REVIEW', 'FAILED', 'CANCELLED', 'EXPIRED', 'OFFLINE');

-- CreateEnum
CREATE TYPE "ProductCategory" AS ENUM ('CAKE', 'DECORATION', 'GIFT');

-- CreateEnum
CREATE TYPE "WaitlistStatus" AS ENUM ('NEW', 'CONTACTED', 'CLOSED');

-- CreateEnum
CREATE TYPE "ContactInquiryStatus" AS ENUM ('NEW', 'CONTACTED', 'CLOSED');

-- CreateEnum
CREATE TYPE "CouponDiscountType" AS ENUM ('FLAT', 'PERCENTAGE');

-- CreateEnum
CREATE TYPE "CouponScope" AS ENUM ('BOOKING_TOTAL', 'PRODUCTS_ONLY', 'EXTRAS_ONLY');

-- CreateEnum
CREATE TYPE "CouponRuleType" AS ENUM ('SLOT_DATE_RANGE', 'SLOT_TIME_RANGE', 'SLOT_DURATION_MIN', 'SLOT_ID', 'THEATRE_ID', 'CATEGORY', 'PRODUCT_ID', 'USER_ID', 'TARGET_CATEGORY', 'TARGET_PRODUCT_ID', 'DECORATION_REQUIRED');

-- CreateEnum
CREATE TYPE "RuleOperator" AS ENUM ('IN', 'NOT_IN', 'BETWEEN', 'EQUALS');

-- CreateEnum
CREATE TYPE "CouponUsageStatus" AS ENUM ('RESERVED', 'CONFIRMED', 'RELEASED');

-- CreateTable
CREATE TABLE "Location" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Location_pkey" PRIMARY KEY ("id")
);

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
    "hourlyRate" INTEGER NOT NULL DEFAULT 0,
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
CREATE TABLE "Theatre" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "images" TEXT[],
    "locationId" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'America/New_York',
    "hasFood" BOOLEAN NOT NULL DEFAULT false,
    "capacity" INTEGER NOT NULL,
    "baseGuests" INTEGER NOT NULL DEFAULT 2,
    "extraPersonPrice" INTEGER NOT NULL DEFAULT 300,
    "decorationPrice" INTEGER NOT NULL DEFAULT 750,
    "footerMessage" TEXT,
    "mapUrl" TEXT,
    "menuFile" TEXT,
    "cardContent" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Theatre_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SlotTemplate" (
    "id" TEXT NOT NULL,
    "theatreId" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "durationMin" INTEGER NOT NULL,
    "bufferMin" INTEGER NOT NULL,
    "regularPrice" INTEGER NOT NULL,
    "salePrice" INTEGER,
    "decorationMandatory" BOOLEAN NOT NULL DEFAULT false,
    "isCustomTemplate" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SlotTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Slot" (
    "id" TEXT NOT NULL,
    "theatreId" TEXT NOT NULL,
    "slotTemplateId" TEXT NOT NULL,
    "date" TIMESTAMPTZ NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "durationMin" INTEGER NOT NULL,
    "basePrice" INTEGER NOT NULL,
    "baseGuests" INTEGER NOT NULL,
    "regularPrice" INTEGER NOT NULL,
    "salePrice" INTEGER,
    "finalPrice" INTEGER NOT NULL,
    "isSpecial" BOOLEAN NOT NULL DEFAULT false,
    "discountText" TEXT,
    "decorationMandatory" BOOLEAN NOT NULL DEFAULT false,
    "status" "SlotStatus" NOT NULL DEFAULT 'AVAILABLE',
    "lockedAt" TIMESTAMP(3),
    "lockExpiresAt" TIMESTAMP(3),
    "lockedBy" TEXT,
    "isOverridden" BOOLEAN NOT NULL DEFAULT false,
    "overrideReason" TEXT,
    "slotModifiedAt" TIMESTAMP(3),
    "slotModifiedBy" TEXT,
    "isTimingOverridden" BOOLEAN NOT NULL DEFAULT false,
    "isPricingOverridden" BOOLEAN NOT NULL DEFAULT false,
    "isStatusOverridden" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Slot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Occasion" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "subtext" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Occasion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OccasionField" (
    "id" TEXT NOT NULL,
    "occasionId" TEXT NOT NULL,
    "fieldKey" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "placeholder" TEXT,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OccasionField_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT NOT NULL,
    "passwordHash" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'CUSTOMER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isGuest" BOOLEAN NOT NULL DEFAULT true,
    "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockUntil" TIMESTAMP(3),
    "sessionVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Booking" (
    "id" TEXT NOT NULL,
    "bookingRef" TEXT NOT NULL,
    "userId" TEXT,
    "contactName" TEXT,
    "contactPhone" TEXT,
    "contactEmail" TEXT,
    "theatreId" TEXT,
    "slotId" TEXT,
    "venueId" TEXT,
    "packageId" TEXT,
    "eventDate" DATE,
    "eventStartTime" TEXT,
    "eventEndTime" TEXT,
    "eventType" TEXT,
    "specialInstructions" TEXT,
    "occasionKey" TEXT,
    "occasionLabel" TEXT,
    "occasionData" JSONB,
    "packageSnapshot" JSONB,
    "pricingSnapshot" JSONB,
    "startsAtUtc" TIMESTAMPTZ(3),
    "endsAtUtc" TIMESTAMPTZ(3),
    "occupiedUntilUtc" TIMESTAMPTZ(3),
    "bufferMinutes" INTEGER,
    "timezone" TEXT,
    "lockVersion" INTEGER,
    "guestCount" INTEGER NOT NULL,
    "decorationRequired" BOOLEAN NOT NULL DEFAULT false,
    "baseAmount" INTEGER NOT NULL,
    "extrasAmount" INTEGER NOT NULL,
    "productsAmount" INTEGER NOT NULL DEFAULT 0,
    "discountAmount" INTEGER NOT NULL,
    "totalAmount" INTEGER NOT NULL,
    "decorationAmount" INTEGER NOT NULL DEFAULT 0,
    "advancePaid" INTEGER NOT NULL,
    "remainingPayable" INTEGER NOT NULL,
    "paymentStatus" "PaymentStatus",
    "bookingStatus" "BookingStatus" NOT NULL,
    "razorpayOrderId" TEXT,
    "razorpayPaymentId" TEXT,
    "razorpaySignature" TEXT,
    "paymentProvider" TEXT,
    "paymentOrderId" TEXT,
    "paymentTransactionId" TEXT,
    "paymentSignature" TEXT,
    "paymentCheckoutUrl" TEXT,
    "termsAcceptedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancelledReason" TEXT,
    "confirmationEmailSent" BOOLEAN NOT NULL DEFAULT false,
    "abandonmentCustomerEmailSentAt" TIMESTAMP(3),
    "abandonmentAdminEmailSentAt" TIMESTAMP(3),
    "recoveredFromBookingId" TEXT,
    "createdByRole" TEXT,
    "createdByAdminId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookingReferenceCounter" (
    "year" INTEGER NOT NULL,
    "lastNumber" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BookingReferenceCounter_pkey" PRIMARY KEY ("year")
);

-- CreateTable
CREATE TABLE "BookingLock" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "theatreId" TEXT NOT NULL,
    "lockOwnerHash" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "eventDate" DATE NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "startsAtUtc" TIMESTAMPTZ(3) NOT NULL,
    "endsAtUtc" TIMESTAMPTZ(3) NOT NULL,
    "occupiedUntilUtc" TIMESTAMPTZ(3) NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "status" "BookingLockStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BookingLock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AvailabilityBlock" (
    "id" TEXT NOT NULL,
    "theatreId" TEXT NOT NULL,
    "eventDate" DATE NOT NULL,
    "isFullDay" BOOLEAN NOT NULL DEFAULT false,
    "startTime" TEXT,
    "endTime" TEXT,
    "startsAtUtc" TIMESTAMPTZ(3),
    "endsAtUtc" TIMESTAMPTZ(3),
    "internalNote" TEXT,
    "recurrenceRule" TEXT,
    "recurrenceStartDate" DATE,
    "recurrenceEndDate" DATE,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdByAdminId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AvailabilityBlock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookingSettings" (
    "id" TEXT NOT NULL,
    "theatreId" TEXT NOT NULL,
    "businessOpenTime" TEXT NOT NULL DEFAULT '09:00',
    "businessCloseTime" TEXT NOT NULL DEFAULT '23:00',
    "minimumDurationMinutes" INTEGER NOT NULL DEFAULT 240,
    "bufferMinutes" INTEGER NOT NULL DEFAULT 60,
    "lockDurationMinutes" INTEGER NOT NULL DEFAULT 10,
    "maximumGuests" INTEGER NOT NULL DEFAULT 50,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BookingSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookingItem" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "variantLabel" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "category" "ProductCategory" NOT NULL,
    "unitPrice" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "totalPrice" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BookingItem_pkey" PRIMARY KEY ("id")
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
    "userAgent" TEXT,
    "agreementVersion" TEXT,
    "agreementHtmlSnapshot" TEXT,
    "confirmationAccepted" BOOLEAN NOT NULL DEFAULT false,
    "paymentReference" TEXT,
    "pdfGeneratedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SignedAgreement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "image" TEXT NOT NULL,
    "description" TEXT,
    "locationId" TEXT,
    "category" "ProductCategory" NOT NULL,
    "bookingCategorySlug" TEXT,
    "bookingCategoryLabel" TEXT,
    "bookingCategoryDescription" TEXT,
    "bookingCategorySortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductVariant" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "regularPrice" INTEGER NOT NULL,
    "salePrice" INTEGER,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductVariant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "transactionId" TEXT,
    "providerOrderId" TEXT,
    "providerPaymentId" TEXT,
    "bookingLockVersion" INTEGER,
    "idempotencyKey" TEXT,
    "providerPayload" JSONB,
    "method" TEXT,
    "recordedByAdminId" TEXT,
    "amount" INTEGER NOT NULL,
    "status" "PaymentStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WaitlistEntry" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "city" TEXT,
    "locationPreference" TEXT,
    "theatrePreference" TEXT,
    "preferredDate" DATE,
    "preferredTime" TEXT,
    "peopleCount" INTEGER,
    "occasion" TEXT,
    "notes" TEXT,
    "status" "WaitlistStatus" NOT NULL DEFAULT 'NEW',
    "contactedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "handledByAdminId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WaitlistEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContactInquiry" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mobile" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" "ContactInquiryStatus" NOT NULL DEFAULT 'NEW',
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "respondedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContactInquiry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Coupon" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "discountType" "CouponDiscountType" NOT NULL,
    "discountValue" INTEGER NOT NULL,
    "maxDiscount" INTEGER,
    "isStackable" BOOLEAN NOT NULL DEFAULT false,
    "stackableCouponIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "validFrom" TIMESTAMP(3) NOT NULL,
    "validTill" TIMESTAMP(3),
    "scope" "CouponScope" NOT NULL DEFAULT 'BOOKING_TOTAL',
    "usageLimit" INTEGER,
    "perUserUsageLimit" INTEGER,
    "minimumAmount" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "locationId" TEXT,
    "createdBy" TEXT NOT NULL,
    "modifiedBy" TEXT,
    "modifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Coupon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CouponRule" (
    "id" TEXT NOT NULL,
    "couponId" TEXT NOT NULL,
    "type" "CouponRuleType" NOT NULL,
    "operator" "RuleOperator" NOT NULL,
    "value" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CouponRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CouponUsage" (
    "id" TEXT NOT NULL,
    "couponId" TEXT NOT NULL,
    "bookingId" TEXT,
    "userId" TEXT,
    "status" "CouponUsageStatus" NOT NULL,
    "discountAmount" INTEGER,
    "reservedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedAt" TIMESTAMP(3),
    "releasedAt" TIMESTAMP(3),

    CONSTRAINT "CouponUsage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppSetting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "AppSetting_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "Location_name_key" ON "Location"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Venue_slug_key" ON "Venue"("slug");

-- CreateIndex
CREATE INDEX "Venue_businessType_isActive_idx" ON "Venue"("businessType", "isActive");

-- CreateIndex
CREATE INDEX "Venue_city_state_country_idx" ON "Venue"("city", "state", "country");

-- CreateIndex
CREATE UNIQUE INDEX "EventPackage_slug_key" ON "EventPackage"("slug");

-- CreateIndex
CREATE INDEX "EventPackage_venueId_isActive_sortOrder_idx" ON "EventPackage"("venueId", "isActive", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "EventPackage_venueId_name_key" ON "EventPackage"("venueId", "name");

-- CreateIndex
CREATE INDEX "PackageFeature_packageId_group_sortOrder_idx" ON "PackageFeature"("packageId", "group", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "EventAddon_slug_key" ON "EventAddon"("slug");

-- CreateIndex
CREATE INDEX "EventAddon_venueId_isActive_sortOrder_idx" ON "EventAddon"("venueId", "isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "EventAddon_packageId_isActive_sortOrder_idx" ON "EventAddon"("packageId", "isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "AgreementTemplate_isActive_createdAt_idx" ON "AgreementTemplate"("isActive", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AgreementTemplate_title_version_key" ON "AgreementTemplate"("title", "version");

-- CreateIndex
CREATE UNIQUE INDEX "Theatre_name_locationId_key" ON "Theatre"("name", "locationId");

-- CreateIndex
CREATE UNIQUE INDEX "SlotTemplate_theatreId_startTime_endTime_key" ON "SlotTemplate"("theatreId", "startTime", "endTime");

-- CreateIndex
CREATE INDEX "Slot_theatreId_date_status_idx" ON "Slot"("theatreId", "date", "status");

-- CreateIndex
CREATE INDEX "Slot_date_status_startTime_idx" ON "Slot"("date", "status", "startTime");

-- CreateIndex
CREATE INDEX "Slot_status_lockExpiresAt_idx" ON "Slot"("status", "lockExpiresAt");

-- CreateIndex
CREATE INDEX "Slot_slotTemplateId_idx" ON "Slot"("slotTemplateId");

-- CreateIndex
CREATE UNIQUE INDEX "Slot_theatreId_date_startTime_endTime_key" ON "Slot"("theatreId", "date", "startTime", "endTime");

-- CreateIndex
CREATE UNIQUE INDEX "Occasion_key_key" ON "Occasion"("key");

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "Booking_bookingRef_key" ON "Booking"("bookingRef");

-- CreateIndex
CREATE INDEX "Booking_createdAt_idx" ON "Booking"("createdAt");

-- CreateIndex
CREATE INDEX "Booking_paymentStatus_createdAt_idx" ON "Booking"("paymentStatus", "createdAt");

-- CreateIndex
CREATE INDEX "Booking_bookingStatus_createdAt_idx" ON "Booking"("bookingStatus", "createdAt");

-- CreateIndex
CREATE INDEX "Booking_cancelledReason_idx" ON "Booking"("cancelledReason");

-- CreateIndex
CREATE INDEX "Booking_paymentProvider_paymentOrderId_idx" ON "Booking"("paymentProvider", "paymentOrderId");

-- CreateIndex
CREATE INDEX "Booking_paymentProvider_paymentTransactionId_idx" ON "Booking"("paymentProvider", "paymentTransactionId");

-- CreateIndex
CREATE INDEX "Booking_slotId_idx" ON "Booking"("slotId");

-- CreateIndex
CREATE INDEX "Booking_theatreId_idx" ON "Booking"("theatreId");

-- CreateIndex
CREATE INDEX "Booking_venueId_packageId_eventDate_idx" ON "Booking"("venueId", "packageId", "eventDate");

-- CreateIndex
CREATE INDEX "BookingLock_theatreId_eventDate_idx" ON "BookingLock"("theatreId", "eventDate");

-- CreateIndex
CREATE INDEX "BookingLock_theatreId_startsAtUtc_occupiedUntilUtc_idx" ON "BookingLock"("theatreId", "startsAtUtc", "occupiedUntilUtc");

-- CreateIndex
CREATE INDEX "BookingLock_status_expiresAt_idx" ON "BookingLock"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "BookingLock_lockOwnerHash_status_expiresAt_idx" ON "BookingLock"("lockOwnerHash", "status", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "BookingLock_bookingId_version_key" ON "BookingLock"("bookingId", "version");

-- CreateIndex
CREATE INDEX "AvailabilityBlock_theatreId_eventDate_isActive_idx" ON "AvailabilityBlock"("theatreId", "eventDate", "isActive");

-- CreateIndex
CREATE INDEX "AvailabilityBlock_theatreId_startsAtUtc_endsAtUtc_idx" ON "AvailabilityBlock"("theatreId", "startsAtUtc", "endsAtUtc");

-- CreateIndex
CREATE UNIQUE INDEX "BookingSettings_theatreId_key" ON "BookingSettings"("theatreId");

-- CreateIndex
CREATE INDEX "BookingItem_bookingId_idx" ON "BookingItem"("bookingId");

-- CreateIndex
CREATE INDEX "BookingItem_variantId_idx" ON "BookingItem"("variantId");

-- CreateIndex
CREATE UNIQUE INDEX "BookingItem_bookingId_variantId_key" ON "BookingItem"("bookingId", "variantId");

-- CreateIndex
CREATE INDEX "SignedAgreement_bookingId_signedAt_idx" ON "SignedAgreement"("bookingId", "signedAt");

-- CreateIndex
CREATE INDEX "SignedAgreement_agreementTemplateId_idx" ON "SignedAgreement"("agreementTemplateId");

-- CreateIndex
CREATE UNIQUE INDEX "Product_slug_key" ON "Product"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "ProductVariant_productId_label_key" ON "ProductVariant"("productId", "label");

-- CreateIndex
CREATE INDEX "Payment_bookingId_createdAt_idx" ON "Payment"("bookingId", "createdAt");

-- CreateIndex
CREATE INDEX "Payment_bookingId_bookingLockVersion_createdAt_idx" ON "Payment"("bookingId", "bookingLockVersion", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_provider_providerOrderId_key" ON "Payment"("provider", "providerOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_provider_providerPaymentId_key" ON "Payment"("provider", "providerPaymentId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_provider_idempotencyKey_key" ON "Payment"("provider", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "WaitlistEntry_reference_key" ON "WaitlistEntry"("reference");

-- CreateIndex
CREATE INDEX "WaitlistEntry_status_createdAt_idx" ON "WaitlistEntry"("status", "createdAt");

-- CreateIndex
CREATE INDEX "WaitlistEntry_phone_idx" ON "WaitlistEntry"("phone");

-- CreateIndex
CREATE INDEX "WaitlistEntry_locationPreference_idx" ON "WaitlistEntry"("locationPreference");

-- CreateIndex
CREATE INDEX "WaitlistEntry_createdAt_idx" ON "WaitlistEntry"("createdAt");

-- CreateIndex
CREATE INDEX "ContactInquiry_status_createdAt_idx" ON "ContactInquiry"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ContactInquiry_mobile_idx" ON "ContactInquiry"("mobile");

-- CreateIndex
CREATE INDEX "ContactInquiry_createdAt_idx" ON "ContactInquiry"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Coupon_code_key" ON "Coupon"("code");

-- CreateIndex
CREATE INDEX "Coupon_code_idx" ON "Coupon"("code");

-- CreateIndex
CREATE INDEX "Coupon_isActive_isDeleted_idx" ON "Coupon"("isActive", "isDeleted");

-- CreateIndex
CREATE INDEX "CouponRule_couponId_type_idx" ON "CouponRule"("couponId", "type");

-- CreateIndex
CREATE INDEX "CouponUsage_couponId_idx" ON "CouponUsage"("couponId");

-- CreateIndex
CREATE INDEX "CouponUsage_userId_idx" ON "CouponUsage"("userId");

-- CreateIndex
CREATE INDEX "CouponUsage_bookingId_idx" ON "CouponUsage"("bookingId");

-- CreateIndex
CREATE INDEX "CouponUsage_bookingId_status_reservedAt_idx" ON "CouponUsage"("bookingId", "status", "reservedAt");

-- CreateIndex
CREATE INDEX "CouponUsage_couponId_userId_status_idx" ON "CouponUsage"("couponId", "userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "CouponUsage_couponId_bookingId_key" ON "CouponUsage"("couponId", "bookingId");

-- AddForeignKey
ALTER TABLE "EventPackage" ADD CONSTRAINT "EventPackage_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackageFeature" ADD CONSTRAINT "PackageFeature_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "EventPackage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventAddon" ADD CONSTRAINT "EventAddon_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventAddon" ADD CONSTRAINT "EventAddon_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "EventPackage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Theatre" ADD CONSTRAINT "Theatre_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlotTemplate" ADD CONSTRAINT "SlotTemplate_theatreId_fkey" FOREIGN KEY ("theatreId") REFERENCES "Theatre"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Slot" ADD CONSTRAINT "Slot_theatreId_fkey" FOREIGN KEY ("theatreId") REFERENCES "Theatre"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Slot" ADD CONSTRAINT "Slot_slotTemplateId_fkey" FOREIGN KEY ("slotTemplateId") REFERENCES "SlotTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OccasionField" ADD CONSTRAINT "OccasionField_occasionId_fkey" FOREIGN KEY ("occasionId") REFERENCES "Occasion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_theatreId_fkey" FOREIGN KEY ("theatreId") REFERENCES "Theatre"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "Slot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "EventPackage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingLock" ADD CONSTRAINT "BookingLock_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingLock" ADD CONSTRAINT "BookingLock_theatreId_fkey" FOREIGN KEY ("theatreId") REFERENCES "Theatre"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AvailabilityBlock" ADD CONSTRAINT "AvailabilityBlock_theatreId_fkey" FOREIGN KEY ("theatreId") REFERENCES "Theatre"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingSettings" ADD CONSTRAINT "BookingSettings_theatreId_fkey" FOREIGN KEY ("theatreId") REFERENCES "Theatre"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingItem" ADD CONSTRAINT "BookingItem_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingItem" ADD CONSTRAINT "BookingItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignedAgreement" ADD CONSTRAINT "SignedAgreement_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignedAgreement" ADD CONSTRAINT "SignedAgreement_agreementTemplateId_fkey" FOREIGN KEY ("agreementTemplateId") REFERENCES "AgreementTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Coupon" ADD CONSTRAINT "Coupon_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CouponRule" ADD CONSTRAINT "CouponRule_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "Coupon"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CouponUsage" ADD CONSTRAINT "CouponUsage_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "Coupon"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CouponUsage" ADD CONSTRAINT "CouponUsage_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CouponUsage" ADD CONSTRAINT "CouponUsage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

