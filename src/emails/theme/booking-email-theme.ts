export type BookingEmailTheme = "dark" | "light";

export function resolveBookingEmailTheme(
  theme: string | null | undefined
): BookingEmailTheme {
  return String(theme ?? "").trim().toLowerCase() === "light"
    ? "light"
    : "dark";
}
