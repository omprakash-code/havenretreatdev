import type { BookingSuccessData } from "@/components/booking/success/types";
import {
  buildBookingTicketPdf,
  type PdfImage,
} from "@/components/booking/success/pdf/downloadBookingTicketPdf";
import type { BookingConfirmationEmailProps } from "@/emails/BookingConfirmationEmail";

type BookingConfirmationPdfAttachment = {
  filename: string;
  content: string;
  contentType: "application/pdf";
};

function mapEmailDataToBookingSuccessData(
  data: BookingConfirmationEmailProps
): BookingSuccessData {
  return {
    bookingRef: data.bookingRef,
    bookingStatus: "CONFIRMED",
    paymentStatus: data.paymentStatus ?? null,
    payment: {
      provider: data.paymentType ?? null,
      method: data.paymentMethod ?? null,
      transactionId: data.paymentReference ?? null,
      status: data.paymentStatus ?? null,
      amount: data.advancePaid,
    },
    contact: {
      name: data.customerName ?? "Guest",
      phone: data.customerPhone ?? "-",
      email: data.customerEmail,
    },
    theatreName: data.theatreName,
    date: data.date,
    timeSlot: data.timeSlot,
    durationHours: data.durationHours,
    includedDurationHours: data.includedDurationHours,
    extraDurationHours: data.extraDurationHours,
    locationName: data.locationName ?? "Miami",
    dateTime: `${data.date}, ${data.timeSlot}`,
    occasionLabel: data.occasionLabel,
    occasionDetails: data.occasionDetails ?? [],
    guestCount: data.guestCount,
    decorationRequired: (data.decorationAmount ?? 0) > 0,
    packageAmount: data.baseAmount ?? 0,
    extrasAmount: data.extrasAmount ?? 0,
    decorationAmount: data.decorationAmount ?? 0,
    totalAmount: data.totalAmount,
    advancePaid: data.advancePaid,
    remainingPayable: data.remainingPayable,
    discountAmount: data.discountAmount ?? 0,
    items: (data.addonItems ?? []).map((item, index) => {
      const quantity = Math.max(1, Math.trunc(item.quantity || 1));
      const totalPrice = Math.max(0, Math.trunc(item.totalPrice || 0));

      return {
        id: `email-addon-${index}`,
        productName: item.name,
        variantLabel: item.variantLabel ?? "Selected",
        category: "ADD_ON",
        quantity,
        unitPrice: Math.round(totalPrice / quantity),
        totalPrice,
        numberValue: item.numberValue ?? null,
        image: item.image ?? null,
      };
    }),
  };
}

async function loadServerPdfImage(sourceUrl: string | null): Promise<PdfImage | null> {
  if (!sourceUrl || !sourceUrl.startsWith("/")) return null;

  const extension = sourceUrl.split(".").pop()?.toLowerCase();

  try {
    const [{ readFile }, path] = await Promise.all([
      import("node:fs/promises"),
      import("node:path"),
    ]);
    const filePath = path.join(process.cwd(), "public", sourceUrl.replace(/^\/+/, ""));
    const content = await readFile(filePath);

    if (extension === "png") {
      return {
        dataUrl: `data:image/png;base64,${content.toString("base64")}`,
        format: "PNG",
      };
    }

    if (extension === "jpg" || extension === "jpeg") {
      return {
        dataUrl: `data:image/jpeg;base64,${content.toString("base64")}`,
        format: "JPEG",
      };
    }

    const { default: sharp } = await import("sharp");
    const converted = await sharp(content).jpeg({ quality: 88 }).toBuffer();

    return {
      dataUrl: `data:image/jpeg;base64,${converted.toString("base64")}`,
      format: "JPEG",
    };
  } catch {
    return null;
  }
}

export async function buildBookingConfirmationPdfAttachment(
  bookingRef: string,
  data: BookingConfirmationEmailProps
): Promise<BookingConfirmationPdfAttachment> {
  const ticketData = mapEmailDataToBookingSuccessData({
    ...data,
    bookingRef: bookingRef || data.bookingRef,
  });
  const { filename, arrayBuffer } = await buildBookingTicketPdf(ticketData, {
    loadImage: loadServerPdfImage,
  });

  return {
    filename,
    content: Buffer.from(arrayBuffer).toString("base64"),
    contentType: "application/pdf",
  };
}
