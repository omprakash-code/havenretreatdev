import type { SlotOption } from "@/components/admin/bookings/add/shared";

type ProgressiveHintParams = {
  locationId: string;
  date: string;
  theatreId: string;
  selectedSlot: SlotOption | null;
};

export function getSummaryHint({
  locationId,
  date,
  theatreId,
  selectedSlot,
}: ProgressiveHintParams) {
  if (!locationId) return "Select a location.";
  if (!date) return "Select a date.";
  if (!theatreId) return "Select a theatre.";
  if (!selectedSlot) return "Select a slot.";
  return null;
}

export function getSubmitBlockerMessage(errors: Record<string, string>) {
  if (errors.locationId) return "Select a location.";
  if (errors.date) return "Select a date.";
  if (errors.theatreId) return "Select a theatre.";
  if (errors.slotStatus) return errors.slotStatus;
  if (errors.slotId) return "Select a slot.";
  if (errors.name) return "Enter customer name.";
  if (errors.phone) return "Enter a valid phone number.";
  if (errors.email) return "Enter a valid email address.";
  if (errors.extraGuestCount) return errors.extraGuestCount;

  const occasionKey = Object.keys(errors).find((key) => key.startsWith("occasion."));
  if (occasionKey) return errors[occasionKey] ?? "Complete required occasion details.";

  if (errors.amountPayNow) return errors.amountPayNow;
  if (errors.offlineReference) return "Enter payment reference ID.";
  if (errors.paymentStatus) return errors.paymentStatus;
  if (errors.couponCode) return errors.couponCode;

  return null;
}

export function formatCurrency(value: number) {
  return `₹${value.toLocaleString()}`;
}
