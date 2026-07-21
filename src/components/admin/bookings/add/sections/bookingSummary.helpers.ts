export function getSubmitBlockerMessage(errors: Record<string, string>) {
  if (errors.locationId) return "Select a location.";
  if (errors.date) return "Select a date.";
  if (errors.theatreId) return "Select a package.";
  if (errors.slotStatus) return errors.slotStatus;
  if (errors.timeRange) return "Select a time range.";
  if (errors.name) return "Enter customer name.";
  if (errors.phone) return "Enter a valid phone number.";
  if (errors.email) return "Enter a valid email address.";
  if (errors.extraGuestCount) return errors.extraGuestCount;

  const occasionKey = Object.keys(errors).find((key) => key.startsWith("occasion."));
  if (occasionKey) return errors[occasionKey] ?? "Complete required occasion details.";

  if (errors.amountPayNow) return errors.amountPayNow;
  if (errors.additionalChargeAmount) return errors.additionalChargeAmount;
  if (errors.additionalChargeReason) return errors.additionalChargeReason;
  if (errors.offlineReference) return "Enter payment reference ID.";
  if (errors.paymentStatus) return errors.paymentStatus;
  if (errors.couponCode) return errors.couponCode;

  return null;
}

export function formatCurrency(value: number) {
  const amount = Number(value) || 0;
  return `$${amount.toLocaleString(undefined, {
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}
