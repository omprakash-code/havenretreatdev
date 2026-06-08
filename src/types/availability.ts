export type AvailabilityReason = "BOOKED" | "LOCKED" | "BLOCKED";

export type AvailabilityRange = {
  startTime: string;
  endTime: string;
  reason: AvailabilityReason;
};

export type TheatreAvailability = {
  theatreId: string;
  timezone: string;
  businessOpenTime: string;
  businessCloseTime: string;
  minimumDurationMinutes: number;
  unavailableRanges: AvailabilityRange[];
  availableRanges: Array<{
    startTime: string;
    endTime: string;
  }>;
  counts: {
    bookings: number;
    locks: number;
    blocks: number;
  };
};

export type RangeAvailabilityResult = {
  date: string;
  theatres: TheatreAvailability[];
  unavailableRanges: AvailabilityRange[];
  hasAvailability: boolean;
  durationMs: number;
};
