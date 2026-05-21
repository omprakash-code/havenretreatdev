# Haven Booking Engine Migration Notes

## Phase 1A: Booking Entry Time Range

The production booking engine still owns the Haven Retreat flow. Phase 1A adds
time-range selection to the existing `/booking` entry route without creating a
parallel Haven context or changing payment, agreement, occasion, add-ons, or
confirmation behavior.

The entry step now captures:

- location
- selected date
- start time
- end time
- derived duration in hours

The time range is carried as optional prebooking session data beside the existing
date snapshot. Existing slot-based package selection remains compatible until a
later phase moves availability and booking locks to range-aware validation.

## Minimum Duration Configuration

`MINIMUM_BOOKING_DURATION_HOURS` is an app setting editable from the admin
settings page. Its initial value is `4`, and the value accepts 30-minute
increments so future venues can use values such as `4.5` without changing the
picker architecture.

The reusable `TimeRangePicker` uses the configured minimum duration and
30-minute time increments. Start time is selected first; end times that do not
satisfy the minimum duration stay disabled.

## Slot Compatibility Direction

Haven booking is moving from fixed slot chips toward date and time-range inputs.
Slot templates and `slotId` are not removed in Phase 1A because current package
selection, booking locks, pricing, and payment confirmation still rely on them.

## Phase 1B: Independent Package Catalog

The package page reads from a location-only active package catalog and no longer
exposes slot chips or a second event-time selector on package cards. Package
visibility is not controlled by the selected date, time range, or legacy slot
availability. A sticky package summary still shows location, date, selected
range, and duration while customers compare packages in the current step order.

Until the range-native booking lock exists, the package CTA resolves the legacy
slot handoff only after the customer chooses a package. `/api/theatres` still
accepts optional `startTime` and `endTime` for that transitional handoff and
narrows the returned slot payload to an exact matching legacy slot. This keeps
downstream contact, agreement, payment, and confirmation lifecycles stable while
package comparison itself becomes step-order friendly.

If no exact legacy slot exists for the requested range, package selection can be
shown but cannot yet create the downstream booking session. A later phase should
replace this exact-slot bridge with overlap-aware dynamic availability and
range-native booking creation.

Follow-up phases should introduce range-aware architecture incrementally for:

- overlap validation
- cleaning buffers
- blackout windows
- dynamic pricing
- overtime rules
- package availability for the selected range

This staged approach deprecates slot-first UX for Haven while keeping existing
stable booking lifecycle and DB compatibility intact.
