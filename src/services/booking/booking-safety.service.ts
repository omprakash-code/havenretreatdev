export class BookingOverlapError extends Error {
  constructor(message = "This time range is currently reserved.") {
    super(message);
    this.name = "BookingOverlapError";
  }
}

export function logBookingSafetyEvent(
  event: string,
  payload: Record<string, unknown>
) {
  console.info(event, payload);
}
