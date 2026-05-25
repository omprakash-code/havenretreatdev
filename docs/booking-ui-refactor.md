# Booking UI Refactor Notes

## Phase 1: Booking Landing Page

The first UI slice keeps the existing legacy booking flow and only changes the
`/booking` presentation layer.

### Components

- `BookingHeroCard` provides the premium glass card shell for the landing page.
- `DateSelector` isolates quick-date chips and the calendar trigger.
- `LiveBookingSummary` shows selected date and time details without repeating the location.
- `TimeRangePicker` keeps the same state contract but now opens a clean modal for start/end time selection.

### Styling Decisions

- Use a refined venue-booking card over the existing background image.
- Prefer soft shadows, subtle rings, and high-contrast CTAs over heavy borders.
- Keep teal as the primary brand action color.
- Use larger tap targets for date and time selection on mobile.
- Keep the landing card compact by showing a single time-range field and moving detailed time selection into a focused dialog.
- Hide the location selector for the current single-location operation while keeping the selector code available for future multi-location use.

### Compatibility Notes

- No backend flow, booking context shape, payment logic, agreement logic, or database schema changed.
- Existing prebooking persistence and package redirect remain unchanged.
- Admin-configured minimum duration and 30-minute increments remain the source of truth.
- Past start times for today remain disabled.
- The modal uses local draft state and only persists the selected range when the user saves.
- Time selection follows a Swimply-style flow: first valid chip sets the start time, the next valid chip sets the end time.

### Future Scalability

- Additional pages should reuse patterns only after a second page proves the component shape.
- Avoid a broad design-system rewrite until contact, package, and summary pages expose repeated needs.
