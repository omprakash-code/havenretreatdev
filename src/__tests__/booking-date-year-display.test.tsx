import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { render } from "@react-email/render";
import DateSelector from "@/components/booking/location/DateSelector";
import { renderBookingConfirmationEmail } from "@/emails/renderBookingConfirmationEmail";
import { presentReportingSchedule } from "@/lib/admin/reporting-schedule-presenter";
import { resolvePresentedBookingSchedule } from "@/lib/booking-schedule-presenter";
import { dateFromDateKey, toDateKey, toDateKeyString } from "@/lib/date";
import { formatCalendarDate, formatCalendarDateKey } from "@/lib/formatters";
import { validateAdminRangeBooking } from "@/services/booking/admin-range-booking.service";
import {
  BOOKING_BUFFER_MINUTES,
  BOOKING_BUSINESS_CLOSE_TIME,
  BOOKING_BUSINESS_OPEN_TIME,
} from "@/lib/booking-policy";

// Year-ahead bookings: every complete booking date shown to customers (and in
// emails/PDF/admin) must carry its own year, never the current one.

const VENUE_TZ = "America/New_York";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

function textOf(markup: string) {
  return markup.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

// ─── Customer date selection ──────────────────────────────────────────────

describe("DateSelector year display", () => {
  const quickDates = [
    { label: "Today", offset: 0 },
    { label: "Tomorrow", offset: 1 },
    { label: null, offset: 2 },
    { label: null, offset: 3 },
  ];

  function renderSelector(selectedDateKey: string | null) {
    // Venue "today" is 30 Dec 2026, so the quick dates span the year boundary.
    const quickKeys = ["2026-12-30", "2026-12-31", "2027-01-01", "2027-01-02"];
    const markup = renderToStaticMarkup(
      <DateSelector
        datesLoading={false}
        noSlotsForLocation={false}
        hasLocation
        selectedDate={selectedDateKey ? dateFromDateKey(selectedDateKey) : null}
        availableDates={[...quickKeys, "2027-01-05", "2027-05-12"]}
        quickDates={quickDates}
        onQuickDateSelect={() => {}}
        onOpenCalendar={() => {}}
        isQuickDate={(date) => quickKeys.some((key) => toDateKey(key) === toDateKey(date))}
        isSameDay={(a, b) => toDateKey(a) === toDateKey(b)}
        getWeekdayShort={(date) => date.toLocaleDateString("en-US", { weekday: "short" })}
        timezone={VENUE_TZ}
      />
    );
    return textOf(markup);
  }

  function atVenueDec30() {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-12-30T17:00:00Z")); // 12:00 in New York
  }

  it("shows the correct year on quick dates spanning December and January", () => {
    atVenueDec30();
    const text = renderSelector(null);

    expect(text).toContain("Today 30 Dec 2026");
    expect(text).toContain("Tomorrow 31 Dec 2026");
    expect(text).toContain("Fri 1 Jan 2027");
    expect(text).toContain("Sat 2 Jan 2027");
    expect(text).toContain("Choose Date");
  });

  it("shows the year of a calendar-picked date in the following year", () => {
    atVenueDec30();
    expect(renderSelector("2027-05-12")).toContain("May 12, 2027");
  });

  it("updates the date and year when the selected date changes", () => {
    atVenueDec30();
    const text = renderSelector("2027-01-05");

    expect(text).toContain("Jan 05, 2027");
    expect(text).not.toContain("May 12");
  });
});

// ─── Booking summary (customer) ───────────────────────────────────────────

describe("formatCalendarDate (booking summary date)", () => {
  it("includes the year for current-year and following-year dates", () => {
    expect(formatCalendarDate("2026-10-12")).toBe("12 Oct 2026");
    expect(formatCalendarDate("2027-05-12")).toBe("12 May 2027");
  });

  it("keeps date-only values on their calendar day across the year boundary", () => {
    expect(formatCalendarDate("2026-12-31")).toBe("31 Dec 2026");
    expect(formatCalendarDate("2027-01-01")).toBe("01 Jan 2027");
    // Venue-midnight eventDate instants (EST) stay on their day.
    expect(formatCalendarDate(new Date("2027-01-01T05:00:00Z"))).toBe("01 Jan 2027");
  });

});

// BookingSummary renders formatCalendarDate(toDateKeyString(booking.date)).
// booking.date is a local-midnight Date: from the pickers (dateFromDateKey),
// from prebooking (its ISO round-trip) or from /api/bookings/current
// (BookingContext: dateFromDateKey(formatCalendarDateKey(eventDate))).
describe.each(["Asia/Kolkata", "UTC", "America/New_York"])(
  "booking summary date in a %s browser",
  (browserTz) => {
    const summaryDate = (date: Date) => formatCalendarDate(toDateKeyString(date));
    const fromBookingApi = (eventDate: string) =>
      dateFromDateKey(formatCalendarDateKey(eventDate));

    it("shows the exact picked day and year", () => {
      vi.stubEnv("TZ", browserTz);
      expect(summaryDate(dateFromDateKey("2027-10-12"))).toBe("12 Oct 2027");
    });

    it("keeps 31 Dec and 1 Jan in their own years", () => {
      vi.stubEnv("TZ", browserTz);
      expect(summaryDate(dateFromDateKey("2026-12-31"))).toBe("31 Dec 2026");
      expect(summaryDate(dateFromDateKey("2027-01-01"))).toBe("01 Jan 2027");
    });

    it("shows the same day after a refresh restores the booked date", () => {
      vi.stubEnv("TZ", browserTz);
      // Prisma @db.Date serialised by /api/bookings/current.
      const restored = fromBookingApi("2027-10-12T00:00:00.000Z");
      expect(summaryDate(restored)).toBe("12 Oct 2027");
      // Same key the time picker and schedule step send to the server.
      expect(toDateKeyString(restored)).toBe("2027-10-12");
      expect(summaryDate(fromBookingApi("2027-01-01T00:00:00.000Z"))).toBe("01 Jan 2027");
    });

    it("shows the same day after a prebooking round-trip", () => {
      vi.stubEnv("TZ", browserTz);
      const picked = dateFromDateKey("2027-10-12");
      expect(summaryDate(new Date(picked.toISOString()))).toBe("12 Oct 2027");
    });

    it("follows the customer when they change the selected date", () => {
      vi.stubEnv("TZ", browserTz);
      let selected = dateFromDateKey("2027-10-12");
      expect(summaryDate(selected)).toBe("12 Oct 2027");
      selected = dateFromDateKey("2028-01-03");
      expect(summaryDate(selected)).toBe("03 Jan 2028");
    });
  }
);

// ─── Confirmation / success / PDF / email ─────────────────────────────────

describe("presented booking schedule year", () => {
  it("uses the booked date's year, not the current year", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-12T15:00:00Z"));

    const schedule = resolvePresentedBookingSchedule(
      {
        eventDate: "2027-05-12",
        eventStartTime: "09:00",
        eventEndTime: "13:00",
        startsAtUtc: "2027-05-12T13:00:00Z",
        endsAtUtc: "2027-05-12T17:00:00Z",
        timezone: VENUE_TZ,
      },
      "dd MMM yyyy" // success page + PDF pattern
    );

    expect(schedule?.date).toBe("12 May 2027");
    expect(schedule?.dateKey).toBe("2027-05-12");
  });

  it("keeps a late 31 Dec venue booking in 2026 even though its UTC instant is 2027", () => {
    const schedule = resolvePresentedBookingSchedule({
      eventDate: "2026-12-31",
      eventStartTime: "18:00",
      eventEndTime: "22:00",
      startsAtUtc: "2026-12-31T23:00:00Z",
      endsAtUtc: "2027-01-01T03:00:00Z",
      timezone: VENUE_TZ,
    });

    expect(schedule?.date).toBe("Thu, 31 Dec 2026");
    expect(schedule?.dateKey).toBe("2026-12-31");
  });

  it("formats a 1 Jan booking without UTC timestamps in 2027", () => {
    const schedule = resolvePresentedBookingSchedule({
      eventDate: "2027-01-01",
      eventStartTime: "10:00",
      eventEndTime: "14:00",
    });

    expect(schedule?.date).toBe("Fri, 01 Jan 2027");
  });

  it("includes the year in admin reporting labels", () => {
    const schedule = presentReportingSchedule({
      eventDate: "2027-01-02",
      eventStartTime: "10:00",
      eventEndTime: "14:00",
      startsAtUtc: "2027-01-02T15:00:00Z",
      endsAtUtc: "2027-01-02T19:00:00Z",
      timezone: VENUE_TZ,
    });

    expect(schedule.dateLabel).toBe("02 Jan 2027");
  });

  it("renders the booked year in the confirmation email", async () => {
    const schedule = resolvePresentedBookingSchedule({
      eventDate: "2027-05-12",
      eventStartTime: "09:00",
      eventEndTime: "13:00",
      startsAtUtc: "2027-05-12T13:00:00Z",
      endsAtUtc: "2027-05-12T17:00:00Z",
      timezone: VENUE_TZ,
    });

    const html = await render(
      renderBookingConfirmationEmail(
        {
          bookingRef: "HR-YEAR-1",
          customerName: "Test User",
          customerPhone: "9999999999",
          customerEmail: "test@example.com",
          theatreName: "Haven Retreat",
          locationName: "Miami",
          date: schedule!.date,
          timeSlot: schedule!.timeSlot,
          guestCount: 2,
          totalAmount: 500,
          advancePaid: 0,
          remainingPayable: 500,
          successUrl: "https://example.com/booking/success?t=abc",
        },
        "light"
      )
    );

    expect(html).toContain("Wed, 12 May 2027");
  });
});

// ─── Admin is not limited by the customer window ──────────────────────────

describe("admin booking beyond the customer availability window", () => {
  it("accepts a date well past 365 days ahead", async () => {
    vi.stubEnv("RANGE_AVAILABILITY_DAYS", "365");
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      booking: { findFirst: vi.fn().mockResolvedValue(null) },
    };

    const result = await validateAdminRangeBooking(tx as never, {
      venueId: "venue-1",
      date: "2028-03-01",
      startTime: "12:00",
      endTime: "16:00",
      guestCount: 10,
      settings: {
        businessOpenTime: BOOKING_BUSINESS_OPEN_TIME,
        businessCloseTime: BOOKING_BUSINESS_CLOSE_TIME,
        minimumDurationMinutes: 240,
        bufferMinutes: BOOKING_BUFFER_MINUTES,
        maximumGuests: 50,
      },
      timezone: VENUE_TZ,
    });

    expect(result.range.startsAtUtc.toISOString()).toBe("2028-03-01T17:00:00.000Z");
  });
});
