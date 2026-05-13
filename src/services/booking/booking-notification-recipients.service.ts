function normalizeEmailList(raw: string | null | undefined) {
  return String(raw ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry, index, arr) => entry.length > 0 && arr.indexOf(entry) === index);
}

export function resolveAdminBookingNotificationRecipients() {
  return normalizeEmailList(
    process.env.BOOKING_ADMIN_NOTIFICATION_EMAILS ??
      process.env.ADMIN_NOTIFICATION_EMAILS ??
      process.env.ADMIN_EMAILS
  );
}
