import BookingConfirmationEmail, {
  type BookingConfirmationEmailProps,
} from "@/emails/BookingConfirmationEmail";
import BookingConfirmationEmailLight from "@/emails/BookingConfirmationEmailLight";
import {
  resolveBookingEmailTheme,
  type BookingEmailTheme,
} from "@/emails/theme/booking-email-theme";

export type BookingConfirmationEmailTheme = BookingEmailTheme;
export const resolveBookingConfirmationEmailTheme = resolveBookingEmailTheme;

export function renderBookingConfirmationEmail(
  props: BookingConfirmationEmailProps,
  theme?: string | null
) {
  const resolvedTheme = resolveBookingConfirmationEmailTheme(theme);
  return resolvedTheme === "light"
    ? BookingConfirmationEmailLight(props)
    : BookingConfirmationEmail(props);
}
