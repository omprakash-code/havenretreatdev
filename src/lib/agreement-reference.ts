export function buildAgreementReference(bookingRef: string) {
  const normalized = bookingRef.trim().toUpperCase();
  const bookingBody = normalized.startsWith("HR")
    ? normalized.slice(2)
    : normalized.replace(/[^A-Z0-9]/g, "");

  if (!bookingBody) {
    throw new Error("Unable to generate an agreement reference.");
  }

  return `HRA${bookingBody}`;
}
