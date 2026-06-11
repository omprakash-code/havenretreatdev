import {
  resolvePresentedBookingSchedule,
  type BookingSchedulePresenterInput,
} from "@/lib/booking-schedule-presenter";

export type ReportingScheduleSource = "BOOKING" | "MISSING";

export type ReportingSchedule = {
  source: ReportingScheduleSource;
  date: string;
  startTime: string;
  endTime: string;
  dateLabel: string;
  timeLabel: string;
  dateTimeLabel: string;
};

export function presentReportingSchedule(
  input: BookingSchedulePresenterInput
): ReportingSchedule {
  const schedule = resolvePresentedBookingSchedule(input, "dd MMM yyyy");

  if (!schedule) {
    return {
      source: "MISSING",
      date: "",
      startTime: "",
      endTime: "",
      dateLabel: "—",
      timeLabel: "—",
      dateTimeLabel: "—",
    };
  }

  return {
    source: schedule.source,
    date: schedule.dateKey,
    startTime: schedule.startTime,
    endTime: schedule.endTime,
    dateLabel: schedule.date,
    timeLabel: schedule.timeSlot,
    dateTimeLabel: schedule.dateTime,
  };
}

export function reportingScheduleFilterValue(schedule: ReportingSchedule) {
  if (!schedule.startTime || !schedule.endTime) return "";
  return `${schedule.startTime} - ${schedule.endTime}`;
}
