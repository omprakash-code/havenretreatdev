/** Haven Retreat's public WhatsApp line, as shown to customers. */
export const HAVEN_WHATSAPP_DISPLAY_NUMBER = "+1 (786) 683-0261";

/** The same number in the digits-only form wa.me links require. */
const HAVEN_WHATSAPP_E164 = "17866830261";

/**
 * Opens a chat with Haven Retreat rather than a share sheet, so the customer
 * reaches the venue instead of forwarding their booking to a contact.
 */
export function buildHavenWhatsAppUrl(message?: string) {
  const url = new URL(`https://wa.me/${HAVEN_WHATSAPP_E164}`);
  if (message) {
    url.searchParams.set("text", message);
  }
  return url.toString();
}
