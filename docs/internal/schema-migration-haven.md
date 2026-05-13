# Haven Retreat Schema Migration - Phase 1

## Purpose

This phase transforms the schema progressively from a theatre-centric booking architecture into a reusable venue event booking architecture for Haven Retreat.

This is intentionally:

- additive
- migration-safe
- reuse-first
- non-destructive

It does **not** rewrite booking or payment logic yet.

## Core Approach

The existing reusable booking engine remains intact:

- booking lifecycle
- payment lifecycle
- slot locking
- coupon engine
- waitlist
- contact inquiry
- pricing snapshot structure

Instead of deleting theatre-specific models, Phase 1 introduces new venue-oriented models alongside the legacy module.

## New Models Added

### Venue

New reusable venue entity for event businesses.

Fields added:

- `name`
- `slug`
- `businessType`
- `description`
- `address`
- `city`
- `state`
- `zipCode`
- `country`
- `phone`
- `email`
- `images`
- `maxGuests`
- `cleaningFee`
- `setupBufferMinutes`
- `isActive`

### EventPackage

New venue package model representing package-level pricing and limits.

Fields added:

- `venueId`
- `name`
- `slug`
- `shortDescription`
- `guestLimit`
- `eventDurationHours`
- `complimentarySetupHours`
- `rentalAmount`
- `decorationAmount`
- `cleaningAmount`
- `subtotalAmount`
- `savingsAmount`
- `finalAmount`
- `isPopular`
- `sortOrder`
- `isActive`

### PackageFeature

New grouped package feature model.

Fields added:

- `packageId`
- `group`
- `label`
- `value`
- `icon`
- `sortOrder`

Enum added:

- `PackageFeatureGroup`
  - `INCLUDED`
  - `DECORATION`
  - `CLEANING`
  - `PRICE_BREAKDOWN`

### EventAddon

New flattened add-on model for venue businesses.

Fields added:

- `venueId`
- `packageId`
- `name`
- `slug`
- `description`
- `price`
- `category`
- `image`
- `isActive`
- `sortOrder`

Enum added:

- `EventAddonCategory`
  - `DECORATION`
  - `FURNITURE`
  - `FOOD_BEVERAGE`
  - `ENTERTAINMENT`
  - `SERVICE`
  - `OTHER`

### BookingAddon

Booking-to-addon snapshot relation.

Fields added:

- `bookingId`
- `addonId`
- `quantity`
- `snapshotPrice`

### AgreementTemplate

Template for reusable agreement documents.

Fields added:

- `title`
- `content`
- `version`
- `isActive`

### SignedAgreement

Stores in-app agreement signing evidence.

Fields added:

- `bookingId`
- `agreementTemplateId`
- `signerName`
- `signerEmail`
- `signedAt`
- `signatureImage`
- `ipAddress`

## Booking Bridge Changes

`Booking` was extended rather than replaced.

### Legacy fields retained

- `theatreId`
- `slotId`

These were marked as legacy bridge fields and made nullable to support the future venue flow.

### New booking fields added

- `venueId`
- `packageId`
- `eventDate`
- `eventStartTime`
- `eventEndTime`
- `eventType`
- `specialInstructions`

### Existing reusable field preserved

- `guestCount`

This field already exists and is shared by both the legacy theatre flow and the new venue flow.

## Legacy Models Preserved

The following modules remain intentionally preserved during Phase 1:

- `Location`
- `Theatre`
- `SlotTemplate`
- `Slot`
- `Product`
- `ProductVariant`
- `BookingItem`

These are now explicitly documented in the schema as legacy theatre-oriented modules that will be phased down later.

## Naming Strategy

Schema comments were updated to separate:

- `CORE MASTER ENTITIES`
- `VENUE EVENT MODULE (PHASE 1 ADDITIVE)`
- `LEGACY THEATRE MODULE`
- `LEGACY THEATRE SLOT SYSTEM`
- `LEGACY THEATRE PRODUCT / EXTRA MODULE`

This keeps future resale and multi-business reuse practical.

## Migration Safety Notes

Phase 1 is designed to be additive and safe:

- no destructive deletes were introduced
- no legacy models were removed

## Haven Add-on Category Layer

To support Haven Retreat's simplified add-on flow without rewriting the legacy
`ProductCategory` enum system, a lightweight booking-category layer was added to
`Product`.

Fields added:

- `bookingCategorySlug`
- `bookingCategoryLabel`
- `bookingCategoryDescription`
- `bookingCategorySortOrder`

This keeps the reusable legacy product infrastructure intact while allowing the
booking flow to build extras steps dynamically from seeded product data.

### Current Haven usage

- All active Haven products are grouped into a single booking category:
  `Add-ons`
- The booking extras route now discovers available categories from product data
  instead of hardcoding `cake / decoration / gift`
- Occasion submit now redirects to the first active product category, or skips
  directly to payment if no booking categories are active

### Safety notes

- Legacy admin/product code remains untouched
- Legacy `ProductCategory` enum remains intact for existing systems
- Old demo products are deactivated by seed when they are not part of the
  Haven keep-list
- Unreferenced legacy products are removed by seed when safe
- new venue architecture exists alongside the old one
- booking/payment core remains intact

However, there are important follow-up implications:

### 1. Prisma client and business logic are not fully migrated yet

The application logic still primarily uses:

- `theatreId`
- `slotId`
- `Theatre`
- `Slot`

So Phase 2 must progressively update services, routes, and UI to use `venueId` and `packageId`.

### 2. Nullable bridge fields change the long-term data contract

`Booking.theatreId` and `Booking.slotId` are now nullable in the schema.

This is required for the target architecture, but downstream code that assumes they are always present must be reviewed before full client regeneration and rollout.

### 3. Product/ProductVariant remain live

The old extras architecture still exists because removing it in Phase 1 would be destructive and would risk breaking current booking integrity.

## Recommended Next Phase

Phase 2 should focus on business logic migration, not schema redesign:

1. Introduce venue/package-aware repositories and API responses
2. Move package selection UI fully onto `EventPackage`
3. Introduce agreement signing APIs and persistence using `SignedAgreement`
4. Gradually bridge add-on selection from `Product/ProductVariant` to `EventAddon`
5. Preserve payment lifecycle and booking integrity during each cutover

## Phase 2A - Read-only Venue and Package Integration

Phase 2A introduced a database-driven package layer without touching booking mutations.

### Repository and service structure

New read-only repository/service modules were added:

- `src/repos/venue.repo.ts`
- `src/repos/package.repo.ts`
- `src/services/venue.service.ts`
- `src/services/package.service.ts`
- `src/lib/package-features.ts`

These modules expose:

- active venues
- venue-by-slug lookup
- active event packages
- package-by-slug lookup
- grouped package features
- venue/package add-ons

### Read-only API layer

New additive APIs were introduced:

- `GET /api/venues`
- `GET /api/venues/[slug]`
- `GET /api/packages`
- `GET /api/packages/[slug]`

These APIs are intentionally read-only and do not participate in booking creation.

### Frontend package module

New package rendering modules were introduced:

- `src/components/packages/PackageCard.tsx`
- `src/components/packages/PackageListSection.tsx`
- `src/components/packages/PackageDetailView.tsx`

The package UI is database-driven and grouped around:

- included features
- decoration details
- cleaning details
- price breakdown

### Seed notes

Venue package seed configuration now lives in:

- `prisma/seed-data/venue-package-config.ts`

This provides:

- the initial Haven Retreat venue record
- event packages
- grouped package features
- package pricing snapshots

Manual seed execution remains intentionally separate from code changes.

## Phase 2B - Parallel Haven Booking Flow Foundation

Phase 2B adds a new venue-booking flow alongside the legacy theatre flow.

### Important coexistence decision

The existing legacy flow already occupies routes such as:

- `/booking`
- `/booking/package`
- `/booking/occasion`
- `/booking/payment`

To preserve the old runtime safely, the new venue flow was added under:

- `/booking/haven/package`
- `/booking/haven/details`
- `/booking/haven/occasion`
- `/booking/haven/addons`
- `/booking/haven/agreement`
- `/booking/haven/payment`
- `/booking/haven/success`

This is a temporary parallel route strategy, not a permanent naming decision.

### New venue-booking state layer

Instead of mutating `BookingContext` heavily, a new isolated provider was added:

- `src/context/VenueBookingContext.tsx`

This state currently carries:

- `venueId`
- `packageId`
- `packageSnapshot`
- `eventDate`
- `eventStartTime`
- `eventEndTime`
- `guestCount`
- `contact`
- `occasionType`
- `occasionData`
- `selectedAddons`
- `agreementAccepted`
- `signatureImage`
- `signerName`
- `specialInstructions`
- `pricingSnapshot`

The state is local and persisted in browser storage for this phase only.

### Pricing adapter

A thin additive pricing adapter was introduced:

- `src/lib/venue-booking-pricing.ts`

This preserves the existing pricing-snapshot philosophy while adapting it to:

- package amount
- add-on totals
- cleaning fee visibility
- savings amount
- deposit amount

It does not replace the legacy pricing engine.

### Agreement foundation

Read-only agreement lookup was added through:

- `src/repos/agreement.repo.ts`
- `src/services/agreement.service.ts`

The agreement step currently supports:

- rendering the active agreement template if present
- checkbox acceptance
- typed signer name
- in-app signature pad foundation

Persistence to `SignedAgreement` is intentionally deferred.

### Frontend architecture

New additive UI modules were introduced under:

- `src/components/venue-booking/`

These include:

- package selection
- details form
- occasion step
- add-on grid step
- agreement step
- venue-booking summary
- venue-booking step indicator

The old theatre summary, extras flow, slot lifecycle, payment runtime, and booking mutations remain untouched.

### Validation status

Validation was run before Phase 2B changes:

- Prisma schema validation passes
- new Haven foundation files lint cleanly
- targeted TypeScript check for new Haven files is clean

Full-project typecheck is still blocked by legacy runtime code that assumes:

- `booking.theatre` is always present
- `booking.slot` is always present
- `slotId` is always non-null

Those errors are a direct side effect of the Phase 1 nullable bridge fields and should be resolved in a dedicated legacy-compatibility pass, not during the Haven foundation phase.

## Phase 2C - Real Haven Booking Persistence

Phase 2C is the first step where the new Haven flow writes real booking data into the database.

### Core adapter decision

The legacy theatre booking APIs were not rewritten. Instead, a new venue-specific layer was added:

- `src/services/venue-booking/venue-booking.service.ts`
- `src/services/venue-booking/venue-booking-session.server.ts`
- `src/app/api/venue-bookings/*`

This keeps the reusable booking engine intact while giving the new venue flow its own persistence path.

### New venue-booking mutations

The Haven mutation layer now supports:

- create/update venue booking draft
- attach occasion data
- attach add-ons
- attach signed agreement
- prepare booking for payment

These mutations use additive wrappers and do not overload the old theatre-specific route handlers.

### Session strategy

A dedicated signed session cookie was added for the venue flow:

- `hr_booking_session`

It reuses the existing booking-session token signing approach but keeps the new venue flow isolated from the legacy `ds_booking_session` runtime.

### Booking draft persistence

The details step now creates or updates a real `Booking` draft with:

- `venueId`
- `packageId`
- `eventDate`
- `eventStartTime`
- `eventEndTime`
- `guestCount`
- contact details
- special instructions

The initial lifecycle state remains:

- `bookingStatus = INCOMPLETE`

### Venue pricing snapshot persistence

To avoid relying on UI-only pricing, the server now computes and persists a venue pricing snapshot.

Temporary additive schema note:

- `Booking.pricingSnapshot` was added as JSON

This stores:

- package amount
- add-ons amount
- cleaning amount
- savings amount
- deposit amount
- total amount
- remaining amount

The existing legacy amount columns are still populated as adapter values so downstream reusable systems can continue to work:

- `baseAmount` -> package amount
- `extrasAmount` -> cleaning amount
- `productsAmount` -> add-ons amount
- `discountAmount` -> savings amount
- `totalAmount` -> venue total
- `advancePaid` -> deposit target

### Add-on persistence

Venue add-ons are now persisted into `BookingAddon`.

Temporary additive schema note:

- `BookingAddon.snapshotName`
- `BookingAddon.totalPrice`

This keeps the venue add-on path aligned with the existing snapshot philosophy used by legacy `BookingItem`.

### Agreement persistence

Agreement signing now persists real `SignedAgreement` records with:

- `bookingId`
- `agreementTemplateId`
- `signerName`
- `signerEmail`
- `signedAt`
- `signatureImage`
- `ipAddress`

The booking lifecycle is moved to:

- `bookingStatus = AWAITING_PAYMENT`
- `paymentStatus = INITIALIZED`

only after a successful signed agreement save.

### Payment preparation adapter

The legacy Razorpay create/verify runtime was not rewritten.

Instead, Phase 2C adds a Haven-specific payment preparation route:

- `POST /api/venue-bookings/prepare-payment`

This validates:

- signed venue session
- editable booking state
- agreement presence
- amount integrity

and returns payment-ready totals for the Haven flow.

### Client flow integration

The Haven client flow now persists across steps:

- details
- occasion
- add-ons
- agreement
- payment prep

The client state still keeps local convenience data, but the authoritative draft now lives in the database and is synced back into the Haven provider after each successful mutation.

### Manual follow-up required

Because this phase added new schema fields and a seeded agreement template, these steps must be run manually in the Haven repo:

1. apply the additive schema change to your local database
2. reseed the database so the agreement template exists

Examples:

- `npx prisma db push`
- `npx prisma db seed`

These were intentionally left as manual handoff steps instead of being executed automatically.
