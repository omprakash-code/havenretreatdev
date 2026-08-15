export type BookingEmailTheme = "dark" | "light";

/**
 * Every booking email uses the light design. Which template a booking happened
 * to go through must never change how it looks, so "light" is the default
 * rather than something a deployment has to opt into. Setting the env var to
 * "dark" is still honoured for the legacy dark treatment.
 */
export function resolveBookingEmailTheme(
  theme: string | null | undefined
): BookingEmailTheme {
  return String(theme ?? "").trim().toLowerCase() === "dark"
    ? "dark"
    : "light";
}
