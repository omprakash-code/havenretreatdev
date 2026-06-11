# Haven Retreat — Private Event Venue Platform

Haven Retreat is a full-stack booking platform for a private outdoor event venue in Miami, Florida. Guests pick a date and time window, choose a package, provide contact details, and pay a deposit — all in one guided flow.

## Package booking journey

Each `EventPackage` controls the customer's initial decoration choice through
`decorationDefault`.

- `true` (default): decoration starts as **Yes**. After contact details, the
  customer continues through occasion and add-on selection.
- `false`: decoration starts as **No**. After contact details, the customer
  continues directly to the agreement.

Change an existing package with SQL:

```sql
UPDATE "EventPackage"
SET "decorationDefault" = false
WHERE "slug" = 'starter-package';
```

For seeded environments, change `decorationDefault` on the matching entry in
`prisma/seed.ts` and run the seed again. The value is copied into each new
booking, so changing a package affects new booking journeys without rewriting
bookings already in progress.

---

## Business Overview

**Haven Retreat Miami** is a private backyard and poolside event space available for celebrations, birthdays, anniversaries, graduations, and intimate outdoor gatherings. The venue accommodates up to 50 guests and operates daily from 9 AM to 10:30 PM under Miami-Dade County regulations.

### What's Included at the Venue

- Private pool and backyard access
- Tables with black or white spandex covers
- Chairs setup (varies by package)
- Coolers
- Speaker system
- WiFi
- Standard post-event cleaning

---

## Event Packages

All packages have a 4-hour minimum rental with full private access to the venue. Extra hours beyond the minimum are billed at the package's own hourly rate. Guests above the package's included count are charged per person.

| Package | Guests Included | Rate | 4-Hr Starting Price |
|---|---|---|---|
| Starter | Up to 20 | $110/hr | $568 |
| Classic *(Popular)* | Up to 30 | $125/hr | $692 |
| Premium | Up to 40 | $150/hr | $841 |
| Grand | Up to 50 | $175/hr | $990 |

Each package's name, hourly rate, guest limit, and features are saved as a snapshot at booking time so pricing is never affected by future changes.

---

## Booking Flow

Guests book via a range-based system — they choose any start and end time on an available date, with no fixed slots.

There are **two paths** depending on whether the guest opts into decoration.

### Path A — With Decoration

```
Package → Date & Time → Contact (decoration = Yes) → Occasion & Details → Extras → Agreement → Payment → Confirmed
```

### Path B — Without Decoration

```
Package → Date & Time → Contact (decoration = No) → Agreement → Payment → Confirmed
```

---

### Step 1 — Package (`/booking/package`)

The guest selects from the four available packages based on their expected guest count. Each package card shows the included features, per-hour rate, and the 4-hour starting price.

### Step 2 — Date & Time (`/booking/schedule`)

The guest selects a location (Miami), picks an available date on the calendar, then sets a custom start and end time using the range time picker. A 4-hour minimum is enforced. The system holds a temporary time lock when the guest continues.

### Step 3 — Contact (`/booking/contact`)

The guest provides:
- Full name
- US mobile number (+1)
- Email address (booking confirmation is sent here)
- Guest count (extra guests above the package limit are $25/person)
- Decoration preference (Yes / No)

**If decoration is selected**, the guest continues to Occasion & Extras.
**If no decoration**, the guest goes directly to the Agreement.

### Step 4 — Occasion & Details (`/booking/occasion`)

*Only shown when decoration is selected.*

The guest chooses an occasion type (Birthday, Anniversary, Graduation, etc.) and fills in any occasion-specific fields such as the honoree's name or a custom message. This information is printed on the booking confirmation.

### Step 5 — Extras (`/booking/extras/[category]`)

*Only shown when decoration is selected.*

The guest can add optional products — cakes, decorations, and gifts — from the venue's product catalogue. Products are presented by category. Each product has variants with individual pricing. Selected items are added as line items to the booking total.

Balloon décor packages are also available starting at $375, added when the guest opted into decoration in Step 3.

### Step 6 — Agreement (`/booking/agreement`)

The guest reviews the full Haven Retreat Event Rental Agreement and signs digitally. The signed agreement — including the signature image, timestamp, and IP address — is stored against the booking.

Key policy highlights:
- **$150 non-refundable deposit** required to confirm the booking
- **Rain-or-shine policy** — no refunds for weather
- **Reschedule**: 72+ hours notice required; subject to date availability
- **No confetti or loose props** on the property
- **Events must end by 10:30 PM** (Miami-Dade County regulation)
- Cleaning fee applies; excessive damage incurs additional charges
- Governed by Florida and Miami-Dade County law

### Step 7 — Payment (`/booking/payment`)

A **$150 non-refundable deposit** is charged via Square to secure the date. The payment page shows a full breakdown:
- Package base price
- Extra hours (billed at the package's hourly rate)
- Extra guests
- Product add-ons
- Total due

The remaining balance is due by Monday of the event week.

### Step 8 — Confirmed (`/booking/success`)

On successful payment the booking is confirmed. The guest receives an email with a booking summary and a downloadable PDF ticket. Haven Retreat admin receives a notification email in parallel.

---

## Admin Panel

The admin panel at `/admin` covers:

- **Bookings** — full list with status filters; booking drawer with payment history, agreement view, and manual payment recording
- **Availability Blocks** — block specific dates or time windows to prevent new bookings
- **Products** — manage cakes, decorations, and gifts with variants and pricing
- **Settings** — configure minimum booking duration, extra hourly rate, and deposit amount
- **Payments** — payment log per booking including Square transactions
- **Contact Inquiries** — messages submitted via the public contact form

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router, Server Components) |
| Language | TypeScript 5 |
| Database | PostgreSQL via Prisma 7 ORM |
| Styling | Tailwind CSS |
| Payments | Square (hosted checkout + webhook) |
| Email | React Email + Nodemailer |
| PDF | jsPDF |
| Auth | Session-based (HTTP-only cookie) |

---

## Project Structure

```
src/
├── app/
│   ├── booking/              # Customer booking flow
│   │   ├── package/          # Step 1: Package selection
│   │   ├── schedule/         # Step 2: Date & time selection
│   │   ├── contact/          # Step 3: Contact info + decoration choice
│   │   ├── occasion/         # Step 4: Occasion (decoration path only)
│   │   ├── extras/[category] # Step 5: Product add-ons (decoration path only)
│   │   ├── agreement/        # Step 6: Rental agreement signing
│   │   ├── payment/          # Step 7: Square deposit payment
│   │   └── success/          # Step 8: Confirmation
│   ├── packages/             # Public packages listing and detail pages
│   ├── admin/                # Admin dashboard
│   └── api/                  # API route handlers
├── components/
│   ├── booking/              # Booking flow UI components
│   ├── packages/             # Package cards and price breakdown
│   └── admin/                # Admin UI components
├── context/
│   └── BookingContext.tsx    # Global booking state (package, time, pricing, contact)
├── services/                 # Business logic (pricing, emails, PDF, payment)
├── lib/                      # Utilities (Square client, date helpers, validators)
├── emails/                   # React Email templates (customer + admin)
├── types/                    # TypeScript types for bookings, packages, admin
└── constants/                # Agreement content, routes, pricing constants
prisma/
├── schema.prisma             # Database schema
├── seed.ts                   # Venue, packages, products, settings seed data
└── migrations/               # Database migration history
```

---

## Pricing Rules

- Package base price is locked at booking time from the selected package
- Extra hours are billed at that package's `hourlyRate` (not a global rate)
- Extra guests above the included `guestLimit` are charged $25 per person
- Balloon décor add-on starts at $375
- All amounts are stored in USD as integers (dollars, not cents)

---

## Environment Variables

```env
DATABASE_URL=                    # PostgreSQL connection string
SQUARE_ACCESS_TOKEN=             # Square API access token
SQUARE_WEBHOOK_SIGNATURE_KEY=    # Square webhook verification key
SQUARE_WEBHOOK_URL=              # Public webhook endpoint URL
SQUARE_LOCATION_ID=              # Square location ID
SESSION_SECRET=                  # HTTP-only session cookie secret
SMTP_HOST=                       # Email delivery host
SMTP_PORT=                       # Email delivery port
SMTP_USER=                       # SMTP username
SMTP_PASS=                       # SMTP password
EMAIL_FROM=                      # Sender address
ADMIN_EMAIL=                     # Recipient for admin notification emails
NEXT_PUBLIC_BASE_URL=            # Public site URL (used in emails and PDF links)
ADMIN_RANGE_BOOKING_ENABLED=true # Enables the range-based booking flow
```

---

## Getting Started                    

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local

# Run database migrations
npx prisma migrate deploy

# Seed initial data (venue, packages, products, settings)
npx prisma db seed

# Start development server
npm run dev
```

App: `http://localhost:3000`
Admin: `http://localhost:3000/admin`
Booking: `http://localhost:3000/booking`
