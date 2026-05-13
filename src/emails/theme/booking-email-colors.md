# Booking Email Color Tokens

Use [booking-email-colors.ts](/Users/omprakash/Developer/Development/havenretreat/src/emails/theme/booking-email-colors.ts) as the single place for email colors.

## Why this exists
- Avoid hardcoded hex values scattered across templates.
- Make brand updates quick (example: accent changed to `#FFC72C`).
- Keep dark, light, and admin palettes consistent.

## How to update colors
1. Open `src/emails/theme/booking-email-colors.ts`.
2. Update token values in `brandAccent`, `dark`, `light`, or `admin`.
3. All templates importing these tokens pick up the change automatically.

## Current consumers
- `src/emails/BookingConfirmationEmail.tsx`
- `src/emails/BookingConfirmationEmailLight.tsx`
- `src/emails/AdminBookingConfirmationEmail.tsx`

