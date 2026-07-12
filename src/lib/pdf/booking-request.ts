import { buildBookingTicketPdf } from "@/components/booking/success/pdf/downloadBookingTicketPdf";
import { loadServerPdfImage } from "@/lib/pdf/server-image";
import {
  buildBookingSuccessData,
  loadBookingWithSuccessRelations,
} from "@/services/booking/booking-success-data.service";
import type { EmailAttachment } from "@/services/email.service";

/**
 * The booking summary the customer sees on the success page, as a PDF they can
 * keep. Drawn from the same data the page reads, so the emailed copy cannot
 * disagree with the page.
 */
export async function buildBookingRequestPdfAttachment(
  bookingId: string
): Promise<EmailAttachment | null> {
  const booking = await loadBookingWithSuccessRelations(bookingId);
  if (!booking) return null;

  const built = await buildBookingSuccessData(booking);
  if (!built) return null;

  const { filename, arrayBuffer } = await buildBookingTicketPdf(built.data, {
    loadImage: loadServerPdfImage,
  });

  return {
    filename,
    content: Buffer.from(arrayBuffer),
    contentType: "application/pdf",
  };
}
