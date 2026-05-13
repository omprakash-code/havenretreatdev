import type { BookingConfirmationEmailProps } from "@/emails/BookingConfirmationEmail";
import { formatISTDateTime, formatSlotTime } from "@/lib/formatters";

type BookingConfirmationPdfAttachment = {
  filename: string;
  content: string;
  contentType: "application/pdf";
};

type PdfLogoImage = {
  dataUrl: string;
  format: "PNG";
};

function formatMoney(value: number | undefined) {
  return `INR ${Math.max(0, Math.trunc(Number(value ?? 0))).toLocaleString("en-IN")}`;
}

function sanitizeFilename(value: string) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function normalizeText(value: string | undefined) {
  return String(value ?? "").trim() || "-";
}

function slotRangeLabel(input: string) {
  const raw = String(input || "").trim();
  if (!raw) return raw;
  const [start, end] = raw.split(/\s*-\s*/);
  if (!start || !end) return raw;
  const startTime = start.trim();
  const endTime = end.trim();
  if (!/^\d{1,2}:\d{2}$/.test(startTime) || !/^\d{1,2}:\d{2}$/.test(endTime)) {
    return raw;
  }
  return formatSlotTime(startTime, endTime);
}

function ensureSpace(
  doc: import("jspdf").jsPDF,
  state: { y: number },
  pageHeight: number,
  requiredHeight: number
) {
  const bottomPadding = 12;
  if (state.y + requiredHeight <= pageHeight - bottomPadding) return;
  doc.addPage();
  state.y = 14;
}

async function loadEmailPdfLogo(): Promise<PdfLogoImage | null> {
  try {
    const [{ readFile }, pathModule] = await Promise.all([
      import("node:fs/promises"),
      import("node:path"),
    ]);
    const logoPath = pathModule.join(
      process.cwd(),
      "public",
      "assets",
      "logo.png"
    );
    const buffer = await readFile(logoPath);
    return {
      dataUrl: `data:image/png;base64,${buffer.toString("base64")}`,
      format: "PNG",
    };
  } catch {
    return null;
  }
}

function drawMatchingHeader(
  doc: import("jspdf").jsPDF,
  state: { y: number },
  pageHeight: number,
  bookingRef: string,
  logo: PdfLogoImage | null
) {
  const x = 12;
  const width = 186;
  const height = 22;

  ensureSpace(doc, state, pageHeight, height + 3);

  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(x, state.y, width, height, 3, 3, "FD");

  const circleSize = 13.5;
  const innerAlignX = x + 2.6;
  const innerAlignRight = x + width - 2.6;
  const circleX = innerAlignX;
  const circleY = state.y + (height - circleSize) / 2;

  doc.setFillColor(250, 204, 21);
  doc.circle(
    circleX + circleSize / 2,
    circleY + circleSize / 2,
    circleSize / 2,
    "F"
  );

  if (logo) {
    try {
      doc.addImage(
        logo.dataUrl,
        logo.format,
        circleX + 1.1,
        circleY + 1.1,
        circleSize - 2.2,
        circleSize - 2.2
      );
    } catch {
      // Keep header rendering even if image decode fails.
    }
  }

  const textX = circleX + circleSize + 2.4;
  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(13.6);
  doc.text("HAVEN RETREAT", textX, state.y + 9.8);
  doc.setFontSize(10.6);
  doc.text("Booking Ticket", textX, state.y + 15.6);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.8);
  doc.setTextColor(15, 23, 42);
  doc.text(`Booking ID: ${bookingRef}`, innerAlignRight, state.y + 9.8, {
    align: "right",
  });
  doc.text(
    `Issued: ${formatISTDateTime(new Date())}`,
    innerAlignRight,
    state.y + 15.6,
    { align: "right" }
  );

  state.y += height + 2.4;
}

function measureAlignedRow(
  doc: import("jspdf").jsPDF,
  label: string,
  value: string
) {
  const labelX = 15;
  const valueX = 196;
  const labelWidth = 68;
  const valueWidth = 112;
  const lineHeight = 4.4;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.2);
  const labelLines = doc.splitTextToSize(label, labelWidth) as string[];
  const valueLines = doc.splitTextToSize(value, valueWidth) as string[];
  const rowLines = Math.max(labelLines.length || 1, valueLines.length || 1);
  const rowHeight = rowLines * lineHeight + 1.2;

  return {
    labelX,
    valueX,
    labelLines: labelLines.length > 0 ? labelLines : [""],
    valueLines: valueLines.length > 0 ? valueLines : [""],
    rowHeight,
  };
}

function writeSectionCard(
  doc: import("jspdf").jsPDF,
  state: { y: number },
  pageHeight: number,
  title: string,
  rows: Array<{ label: string; value: string }>
) {
  const measuredRows = rows.map((row) =>
    measureAlignedRow(doc, row.label, row.value)
  );
  const headerHeight = 8.4;
  const contentTopPad = 1.2;
  const contentBottomPad = 2;
  const rowsHeight = measuredRows.reduce((sum, row) => sum + row.rowHeight, 0);
  const totalHeight = headerHeight + contentTopPad + rowsHeight + contentBottomPad;

  ensureSpace(doc, state, pageHeight, totalHeight + 3);

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(12, state.y, 186, totalHeight, 2, 2, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text(title, 15, state.y + 5.2);

  let rowY = state.y + headerHeight + contentTopPad;
  measuredRows.forEach((row) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.2);
    doc.setTextColor(71, 85, 105);
    doc.text(row.labelLines, row.labelX, rowY);

    doc.setTextColor(15, 23, 42);
    doc.text(row.valueLines, row.valueX, rowY, {
      align: "right",
    });
    rowY += row.rowHeight;
  });

  state.y += totalHeight + 3;
}

function arrayBufferToBase64(arrayBuffer: ArrayBuffer) {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(arrayBuffer).toString("base64");
  }

  let binary = "";
  const bytes = new Uint8Array(arrayBuffer);
  const chunkSize = 0x8000;

  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  if (typeof btoa !== "undefined") {
    return btoa(binary);
  }

  throw new Error("Unable to convert PDF data to base64.");
}

export async function buildBookingConfirmationPdfAttachment(
  bookingRef: string,
  data: BookingConfirmationEmailProps
): Promise<BookingConfirmationPdfAttachment> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
    compress: true,
  });
  const pageHeight = doc.internal.pageSize.getHeight();
  const state = { y: 16 };

  const effectiveBookingRef = normalizeText(bookingRef || data.bookingRef);
  const logo = await loadEmailPdfLogo();
  const subtotalBeforeDiscount =
    Math.max(0, Math.trunc(data.totalAmount || 0)) +
    Math.max(0, Math.trunc(data.discountAmount || 0));
  const showDiscount = Math.max(0, Math.trunc(data.discountAmount || 0)) > 0;
  const showRemaining = Math.max(0, Math.trunc(data.remainingPayable || 0)) > 0;
  drawMatchingHeader(doc, state, pageHeight, effectiveBookingRef, logo);

  const bookingDetailsRows = [
    { label: "Location", value: normalizeText(data.locationName) },
    { label: "Package", value: normalizeText(data.theatreName) },
    { label: "Date", value: normalizeText(data.date) },
    { label: "Time", value: normalizeText(slotRangeLabel(data.timeSlot)) },
    {
      label: "Guests",
      value: String(Math.max(0, Math.trunc(data.guestCount || 0))),
    },
  ];
  if (data.occasionLabel) {
    bookingDetailsRows.push({
      label: "Occasion",
      value: normalizeText(data.occasionLabel),
    });
  }
  writeSectionCard(doc, state, pageHeight, "Booking Details", bookingDetailsRows);

  const contactRows = [
    { label: "Name", value: normalizeText(data.customerName) },
    { label: "Phone", value: normalizeText(data.customerPhone) },
  ];
  if (data.customerEmail) {
    contactRows.push({
      label: "Email",
      value: normalizeText(data.customerEmail),
    });
  }
  writeSectionCard(doc, state, pageHeight, "Contact", contactRows);

  const addonItems = (Array.isArray(data.addonItems) ? data.addonItems : []).filter(
    (item) => Math.max(0, Math.trunc(item.quantity || 0)) > 0
  );
  if (addonItems.length > 0) {
    const addOnRows: Array<{ label: string; value: string }> = [];
    for (const item of addonItems) {
      const quantity = Math.max(0, Math.trunc(item.quantity || 0));
      const variant = normalizeText(item.variantLabel);
      const numberValue = item.numberValue ? ` | Number: ${item.numberValue}` : "";
      addOnRows.push({
        label: normalizeText(item.name),
        value: `${variant} x${quantity}${numberValue}`,
      });
    }
    writeSectionCard(doc, state, pageHeight, "Add-ons", addOnRows);
  }

  const paymentRows: Array<{ label: string; value: string }> = [];
  if (showDiscount) {
    paymentRows.push({
      label: "Subtotal (Before Discount)",
      value: formatMoney(subtotalBeforeDiscount),
    });
    paymentRows.push({
      label: "Discount",
      value: `- ${formatMoney(data.discountAmount)}`,
    });
  }
  paymentRows.push({
    label: "Total",
    value: formatMoney(data.totalAmount),
  });
  paymentRows.push({
    label: "Amount Paid",
    value: formatMoney(data.advancePaid),
  });
  if (showRemaining) {
    paymentRows.push({
      label: "Balance at Venue",
      value: formatMoney(data.remainingPayable),
    });
  }
  writeSectionCard(doc, state, pageHeight, "Payment Summary", paymentRows);

  state.y += 2;
  ensureSpace(doc, state, pageHeight, 8);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text("This is a system-generated confirmation PDF.", 12, state.y);

  const filenameBase = sanitizeFilename(effectiveBookingRef) || "booking-confirmation";
  const arrayBuffer = doc.output("arraybuffer");
  const content = arrayBufferToBase64(arrayBuffer);

  return {
    filename: `${filenameBase}.pdf`,
    content,
    contentType: "application/pdf",
  };
}
