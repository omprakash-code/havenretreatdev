import type { BookingSuccessData } from "@/components/booking/success/types";
import { buildCelebrationRows } from "@/components/booking/success/success-details";
import { formatISTDateTime, formatSlotTime } from "@/lib/formatters";
import { SUCCESS_VENUE_IMAGE } from "@/components/booking/success/assets";
import { HAVEN_AGREEMENT_TOTAL_CLAUSES } from "@/constants/haven-agreement-content";

export type PdfImage = {
  dataUrl: string;
  format: "PNG" | "JPEG";
};

type PdfImageLoader = (
  sourceUrl: string | null,
  options: ImageProcessOptions
) => Promise<PdfImage | null>;

export type BookingTicketPdfOptions = {
  loadImage?: PdfImageLoader;
};

type PdfLayout = {
  doc: import("jspdf").jsPDF;
  pageWidth: number;
  pageHeight: number;
  marginX: number;
  marginY: number;
  contentWidth: number;
  y: number;
};

type RowTone = "normal" | "strong" | "success" | "muted";

type SectionRow = {
  label: string;
  value: string;
  tone?: RowTone;
};

const COLORS = {
  paper: [255, 255, 255] as const,
  headerBg: [255, 255, 255] as const,
  sectionBg: [248, 250, 252] as const,
  sectionHeadBg: [241, 245, 249] as const,
  border: [226, 232, 240] as const,
  textStrong: [15, 23, 42] as const,
  textNormal: [51, 65, 85] as const,
  textMuted: [100, 116, 139] as const,
  textSuccess: [52, 127, 124] as const,
};

function bookingTimeRangeLabel(input: string) {
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

function formatHourValue(hours: number) {
  return Number.isInteger(hours) ? `${hours}h` : `${hours.toFixed(1)}h`;
}

function formatDurationLabel(data: BookingSuccessData) {
  const durationHours = data.durationHours ?? null;
  if (durationHours === null || !Number.isFinite(durationHours)) return "—";

  const included = data.includedDurationHours ?? 4;
  const extra = data.extraDurationHours ?? Math.max(durationHours - included, 0);

  if (extra > 0) {
    return `${formatHourValue(durationHours)} (${formatHourValue(included)} included + ${formatHourValue(extra)} extra)`;
  }

  return `${formatHourValue(durationHours)} included`;
}

export async function buildBookingTicketPdf(
  data: BookingSuccessData,
  options: BookingTicketPdfOptions = {}
): Promise<{ filename: string; arrayBuffer: ArrayBuffer }> {
  const { jsPDF } = await import("jspdf");

  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
    compress: true,
  });

  const layout: PdfLayout = {
    doc,
    pageWidth: doc.internal.pageSize.getWidth(),
    pageHeight: doc.internal.pageSize.getHeight(),
    marginX: 9.5,
    marginY: 9.5,
    contentWidth: doc.internal.pageSize.getWidth() - 19,
    y: 9.5,
  };

  const items = (Array.isArray(data.items) ? data.items : []).filter(
    (item) => item.quantity > 0
  );

  const loadImage = options.loadImage ?? loadProcessedImage;
  const logoPromise = loadImage("/assets/logo.png", {
    width: 286,
    height: 286,
    radius: 0,
    mode: "contain",
  });
  const venueImagePromise = loadImage(SUCCESS_VENUE_IMAGE, {
    width: 640,
    height: 420,
    radius: 0,
    mode: "cover",
  });
  const productImagePromises = items.map(async (item) => {
    const image = await loadImage(item.image ?? null, {
      width: 140,
      height: 140,
      radius: 0,
      mode: "cover",
    });
    return [item.id, image] as const;
  });

  const [logoImage, venueImage, ...productPairs] = await Promise.all([
    logoPromise,
    venueImagePromise,
    ...productImagePromises,
  ]);
  const productImageMap = new Map<string, PdfImage | null>(productPairs);

  drawHeader(layout, data, logoImage);
  drawVenueHero(layout, data, venueImage);

  const celebrationRows = buildCelebrationRows(data);
  if (celebrationRows.length > 0) {
    drawSectionCard(layout, "Celebration Details", celebrationRows);
  }

  const paymentRows = buildPaymentRows(data);
  drawPaymentTable(layout, paymentRows);

  if (items.length > 0) {
    drawProductsGrid(layout, items, productImageMap);
  }

  if (data.signedAgreement) {
    drawSectionCard(layout, "Signed Agreement", [
      {
        label: "Status",
        value: `${data.signedAgreement.acknowledgedClauses.length} of ${HAVEN_AGREEMENT_TOTAL_CLAUSES} clauses acknowledged`,
        tone: "success",
      },
      {
        label: "Signer",
        value: data.signedAgreement.signerName,
      },
      {
        label: "Signed At",
        value: formatISTDateTime(data.signedAgreement.signedAt),
      },
      {
        label: "Agreement Version",
        value: data.signedAgreement.agreementVersion ?? "Not specified",
      },
      {
        label: "Agreement ID",
        value: data.signedAgreement.id,
        tone: "muted",
      },
    ]);
  }

  drawSectionCard(layout, "Important", [
    {
      label: "Status",
      value: "Date reserved, final review pending.",
      tone: "strong",
    },
    {
      label: "Payment",
      value: "Payment applied, balance due one week before the event.",
      tone: "normal",
    },
    {
      label: "Entry",
      value: "Please show this receipt at the venue on arrival.",
      tone: "muted",
    },
    {
      label: "Support",
      value: "For help, message us on WhatsApp with your booking reference.",
      tone: "muted",
    },
  ]);

  drawFooter(layout);

  const filename = `${sanitizeFilename(data.bookingRef || "booking-ticket")}.pdf`;
  const arrayBuffer = doc.output("arraybuffer");
  return { filename, arrayBuffer };
}

export async function downloadBookingTicketPdf(
  data: BookingSuccessData
): Promise<void> {
  const { filename, arrayBuffer } = await buildBookingTicketPdf(data);
  const blob = new Blob([arrayBuffer], { type: "application/pdf" });
  const objectUrl = URL.createObjectURL(blob);

  try {
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export function buildPaymentRows(data: BookingSuccessData): SectionRow[] {
  const discountAmount = data.discountAmount ?? 0;
  const showDiscountBreakdown = discountAmount > 0;
  const subtotalBeforeDiscount = data.totalAmount + discountAmount;
  const showAdminPaymentMeta = data.createdByRole === "ADMIN";
  const adminPaymentModeLabel =
    data.payment?.provider === "OFFLINE"
      ? "Offline"
      : data.payment?.provider === "RAZORPAY"
        ? "Online"
        : null;
  const extraGuestCount =
    data.extraGuestCount ??
    Math.max(data.guestCount - (data.includedGuestCount ?? data.guestCount), 0);
  const extraPersonPrice = data.extraPersonPrice ?? 0;
  const extraGuestAmount = extraGuestCount * extraPersonPrice;
  const fallbackExtrasAmount = Math.max(data.extrasAmount ?? 0, 0);

  const rows: SectionRow[] = [];

  const packageAmount = data.packageAmount ?? 0;
  if (packageAmount > 0) {
    rows.push({
      label: "Package",
      value: formatCurrency(packageAmount),
    });
  }

  const extraDurationAmount = data.extraDurationAmount ?? 0;
  const extraDurationHours = data.extraDurationHours ?? 0;
  if (extraDurationAmount > 0) {
    const rateLabel =
      extraDurationHours > 0
        ? ` (${formatHourValue(extraDurationHours)} × ${formatCurrency(Math.round(extraDurationAmount / extraDurationHours))}/hr)`
        : "";
    rows.push({
      label: `Extra Hours${rateLabel}`,
      value: formatCurrency(extraDurationAmount),
    });
  }

  if (extraGuestAmount > 0) {
    rows.push({
      label: `Extra Guests (${extraGuestCount} × ${formatCurrency(extraPersonPrice)})`,
      value: formatCurrency(extraGuestAmount),
    });
  } else if (fallbackExtrasAmount > 0) {
    rows.push({
      label: "Extra Guests",
      value: formatCurrency(fallbackExtrasAmount),
    });
  }

  const decorationAmount = data.decorationAmount ?? 0;
  if (decorationAmount > 0) {
    rows.push({
      label: "Decoration",
      value: formatCurrency(decorationAmount),
    });
  }

  data.items
    .filter((item) =>
      item.extraQuantity !== null && item.extraQuantity !== undefined
        ? item.extraQuantity > 0
        : item.totalPrice > 0
    )
    .forEach((item) => {
      const chargedQuantity =
        item.extraQuantity ??
        (item.unitPrice > 0 ? Math.max(Math.round(item.totalPrice / item.unitPrice), 1) : item.quantity);

      rows.push({
        label: `${sanitizeDisplayText(item.productName)} (${chargedQuantity} × ${formatCurrency(item.unitPrice)})`,
        value: formatCurrency(item.totalPrice),
      });
    });

  if (showDiscountBreakdown) {
    rows.push({
      label: "Subtotal (Before Discount)",
      value: formatCurrency(subtotalBeforeDiscount),
    });

    rows.push({
      label: "Discount",
      value: `-${formatCurrency(discountAmount)}`,
      tone: "success",
    });
  }

  rows.push({
    label: showDiscountBreakdown
      ? "Final Total (After Discount)"
      : "Total Amount",
    value: formatCurrency(data.totalAmount),
    tone: "strong",
  });

  rows.push({
    label:
      showAdminPaymentMeta && adminPaymentModeLabel
        ? `Amount Paid (${adminPaymentModeLabel})`
        : data.createdByRole === "ADMIN"
          ? "Amount Paid"
          : "Paid Online",
    value: formatCurrency(data.advancePaid),
    tone: "success",
  });

  const isFullPayment =
    data.remainingPayable <= 0 || data.advancePaid >= data.totalAmount;
  const isCustomerAdvanceFlow =
    data.createdByRole !== "ADMIN" &&
    data.paymentStatus === "PAID" &&
    data.advancePaid > 0 &&
    data.remainingPayable > 0;
  const isAdminAdvanceFlow =
    data.createdByRole === "ADMIN" &&
    data.bookingStatus === "CONFIRMED" &&
    data.advancePaid > 0 &&
    data.remainingPayable > 0;
  const showRemainingRow =
    !isFullPayment && (isCustomerAdvanceFlow || isAdminAdvanceFlow);

  const remainingLabel = "Remaining Balance";

  if (showRemainingRow) {
    rows.push({
      label: remainingLabel,
      value: formatCurrency(data.remainingPayable),
      tone: "strong",
    });
    rows.push({
      label: "Note",
      value:
        "Please arrive 15 minutes before your booking time. Remaining balance can be paid at the venue via Card or Cash.",
      tone: "muted",
    });
  }

  return rows;
}

function drawHeader(layout: PdfLayout, data: BookingSuccessData, logo: PdfImage | null) {
  const { doc, marginX, contentWidth } = layout;
  const h = 22;

  ensureSpace(layout, h + 2);

  setFill(doc, COLORS.headerBg);
  setDraw(doc, COLORS.border);
  doc.rect(marginX, layout.y, contentWidth, h, "FD");

  const logoSize = 17;
  const innerAlignX = marginX + 2.6;
  const innerAlignRight = marginX + contentWidth - 2.6;
  const logoX = innerAlignX;
  const logoY = layout.y + (h - logoSize) / 2;

  if (logo) {
    doc.addImage(logo.dataUrl, logo.format, logoX, logoY, logoSize, logoSize);
  }

  const textX = logoX + logoSize + 2.4;
  doc.setFont("helvetica", "bold");
  setText(doc, COLORS.textStrong);
  doc.setFontSize(12);
  doc.text("HAVEN RETREAT", textX, layout.y + 9);
  doc.setFontSize(9);
  doc.text("Booking Receipt", textX, layout.y + 15);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  setText(doc, COLORS.textStrong);
  doc.text(
    `Booking ID: ${sanitizeDisplayText(data.bookingRef)}`,
    innerAlignRight,
    layout.y + 9,
    { align: "right" }
  );
  doc.text(
    `Issued: ${formatISTDateTime(new Date())}`,
    innerAlignRight,
    layout.y + 15,
    { align: "right" }
  );

  layout.y += h + 1.5;
}

function drawVenueHero(
  layout: PdfLayout,
  data: BookingSuccessData,
  venueImage: PdfImage | null
) {
  const { doc, marginX, contentWidth } = layout;
  const pad = 3;
  // Theatre image width in mm. Increase/decrease here to grow/shrink the left image block.
  const imageW = 73;
  const gap = 3;
  const details = [
    `Location: ${sanitizeDisplayText(data.locationName)}`,
    `Date: ${sanitizeDisplayText(data.date)}`,
    `Time: ${sanitizeDisplayText(bookingTimeRangeLabel(data.timeSlot))}`,
    `Duration: ${sanitizeDisplayText(formatDurationLabel(data))}`,
    `Guests: ${data.guestCount} People`,
    `Name: ${sanitizeDisplayText(data.contact.name)}`,
    `Phone: ${sanitizeDisplayText(data.contact.phone)}`,
    ...(data.contact.email
      ? [`Email: ${sanitizeDisplayText(data.contact.email)}`]
      : []),
  ];
  // Overall hero-card height in mm. The fixed `60` is the minimum height;
  // `22 + details.length * 5.8` expands the card as more lines are added.
  const cardH = Math.max(60, 22 + details.length * 5.8);

  ensureSpace(layout, cardH + 2);

  setFill(doc, COLORS.sectionBg);
  setDraw(doc, COLORS.border);
  doc.rect(marginX, layout.y, contentWidth, cardH, "FD");

  const imageX = marginX + pad;
  const imageY = layout.y + pad;
  const imageH = cardH - pad * 2;

  if (venueImage) {
    doc.addImage(venueImage.dataUrl, venueImage.format, imageX, imageY, imageW, imageH);
  } else {
    setFill(doc, COLORS.sectionHeadBg);
    doc.rect(imageX, imageY, imageW, imageH, "F");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.8);
    doc.setTextColor(...COLORS.textMuted);
    doc.text("Venue Image", imageX + imageW / 2, imageY + imageH / 2, {
      align: "center",
    });
  }

  const infoX = imageX + imageW + gap;
  // Right-side details panel width is the remaining space after image width + side padding + gap.
  const infoW = contentWidth - pad * 2 - imageW - gap;

  setFill(doc, COLORS.paper);
  setDraw(doc, COLORS.border);
  doc.rect(infoX, imageY, infoW, imageH, "FD");

  // Vertical positions for the right-side content stack.
  // `sectionHeaderY`: top offset for the BOOKING DETAILS pill.
  // `theatreNameY`: gap below the pill before theatre name.
  // `detailStartY`: gap below theatre name before the detail list starts.
  const sectionHeaderY = imageY + 2;
  const sectionHeaderH = 6.6;
  const theatreNameY = sectionHeaderY + sectionHeaderH + 5;
  const detailStartY = theatreNameY + 5;
  const detailTextX = infoX + 2.5;

  // Match the other section headers instead of the muted grey treatment.
  setFill(doc, COLORS.sectionBg);
  doc.rect(infoX + 2, sectionHeaderY, infoW - 4, sectionHeaderH, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.6);
  doc.setTextColor(...COLORS.textStrong);
  doc.text("BOOKING DETAILS", detailTextX, sectionHeaderY + 4.3);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11.2);
  doc.setTextColor(...COLORS.textStrong);
  doc.text(sanitizeDisplayText(data.theatreName), detailTextX, theatreNameY);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.1);
  doc.setTextColor(...COLORS.textNormal);
  details.forEach((line, i) => {
    doc.text(line, detailTextX, detailStartY + i * 5.6);
  });

  layout.y += cardH + 2;
}

function drawSectionCard(layout: PdfLayout, title: string, rows: SectionRow[]) {
  const h = measureSectionCardHeight(layout, layout.contentWidth, rows);
  ensureSpace(layout, h + 2);
  drawSectionCardAt(
    layout,
    layout.marginX,
    layout.y,
    layout.contentWidth,
    h,
    title,
    rows
  );
  layout.y += h + 2.2;
}

function drawSectionCardAt(
  layout: PdfLayout,
  x: number,
  y: number,
  w: number,
  h: number,
  title: string,
  rows: SectionRow[]
) {
  const { doc } = layout;
  const titleH = 6.8;
  const rowInset = 1.8; // ~5px border-to-text space
  const rowPadX = 0; // no extra left/right padding beyond inset

  setFill(doc, COLORS.sectionBg);
  setDraw(doc, COLORS.border);
  doc.rect(x, y, w, h, "FD");

  setFill(doc, COLORS.sectionHeadBg);
  doc.rect(x + 1.4, y + 1.2, w - 2.8, titleH, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.3);
  doc.setTextColor(...COLORS.textStrong);
  doc.text(title, x + 2.6, y + 5.5);

  let rowY = y + titleH + 2.3;
  const leftX = x + rowInset + rowPadX;
  const rightX = x + w - rowInset - rowPadX;
  const valueLeft = x + w * 0.49;
  const maxLabelWidth = valueLeft - leftX - 1.2;
  const maxValueWidth = rightX - valueLeft;

  rows.forEach((row, idx) => {
    if (idx > 0) {
      doc.setDrawColor(...COLORS.border);
      doc.line(x + rowInset, rowY - 0.9, x + w - rowInset, rowY - 0.9);
    }

    const label = sanitizeDisplayText(row.label);
    const value = sanitizeDisplayText(row.value);
    const labelLines = doc.splitTextToSize(label, maxLabelWidth) as string[];
    const valueLines = doc.splitTextToSize(value, maxValueWidth) as string[];
    const lineCount = Math.max(labelLines.length, valueLines.length);
    const rowHeight = lineCount * 4.2 + 1.1;

    const tone = row.tone ?? "normal";
    const color =
      tone === "success"
        ? COLORS.textSuccess
        : tone === "muted"
        ? COLORS.textMuted
        : tone === "strong"
        ? COLORS.textStrong
        : COLORS.textNormal;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.1);
    setText(doc, COLORS.textMuted);
    doc.text(labelLines, leftX, rowY + 3.5);

    doc.setFont("helvetica", tone === "strong" ? "bold" : "normal");
    setText(doc, color);
    doc.text(valueLines, rightX, rowY + 3.5, { align: "right" });

    rowY += rowHeight;
  });
}

function measureSectionCardHeight(
  layout: PdfLayout,
  width: number,
  rows: SectionRow[]
): number {
  const { doc } = layout;
  const titleH = 6.8;
  const rowInset = 1.8; // keep measurement in sync with drawSectionCardAt
  const rowPadX = 0;
  const innerX = rowInset + rowPadX;
  const valueLeft = width * 0.49;
  const maxLabelWidth = valueLeft - innerX - 1.2;
  const maxValueWidth = width - (rowInset + rowPadX) - valueLeft;

  let totalRowsHeight = 0;
  rows.forEach((row) => {
    const labelLines = doc.splitTextToSize(
      sanitizeDisplayText(row.label),
      maxLabelWidth
    ) as string[];
    const valueLines = doc.splitTextToSize(
      sanitizeDisplayText(row.value),
      maxValueWidth
    ) as string[];
    const lineCount = Math.max(labelLines.length, valueLines.length);
    totalRowsHeight += lineCount * 4.2 + 1.1;
  });

  return 1.2 + titleH + 2.3 + totalRowsHeight + 2.2;
}

function drawPaymentTable(layout: PdfLayout, rows: SectionRow[]) {
  const { doc, marginX, contentWidth } = layout;

  const titleH = 6.8;
  const tableTopPad = 2.2;
  const lineBase = 4.4;
  const rowInset = 1.8; // ~5px border-to-text space
  const rowPadX = 0; // no extra left/right padding beyond inset
  const valueColX = marginX + contentWidth * 0.66;

  const rowMeasures = rows.map((row) => {
    if (row.label === "Note") {
      const wrapped = doc.splitTextToSize(
        sanitizeDisplayText(row.value),
        contentWidth - rowInset * 2
      ) as string[];
      return { row, labelLines: [] as string[], valueLines: wrapped, h: wrapped.length * lineBase + 1.1, note: true };
    }

    const labelLines = doc.splitTextToSize(
      sanitizeDisplayText(row.label),
      valueColX - (marginX + rowInset + rowPadX) - 2
    ) as string[];
    const valueLines = doc.splitTextToSize(
      sanitizeDisplayText(row.value),
      marginX + contentWidth - (rowInset + rowPadX) - valueColX
    ) as string[];
    const lines = Math.max(labelLines.length, valueLines.length);
    return {
      row,
      labelLines,
      valueLines,
      h: lines * lineBase + 1.1,
      note: false,
    };
  });

  const bodyH = rowMeasures.reduce((sum, item) => sum + item.h, 0);
  const cardH = 1.2 + titleH + tableTopPad + bodyH + 2;

  ensureSpace(layout, cardH + 2);

  setFill(doc, COLORS.sectionBg);
  setDraw(doc, COLORS.border);
  doc.rect(marginX, layout.y, contentWidth, cardH, "FD");

  setFill(doc, COLORS.sectionHeadBg);
  doc.rect(marginX + 1.4, layout.y + 1.2, contentWidth - 2.8, titleH, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.3);
  doc.setTextColor(...COLORS.textStrong);
  doc.text("Payment Summary", marginX + 2.6, layout.y + 5.5);

  let rowY = layout.y + titleH + tableTopPad + 1.2;
  rowMeasures.forEach((item, index) => {
    if (index > 0) {
      doc.setDrawColor(...COLORS.border);
      doc.line(
        marginX + rowInset,
        rowY - 0.8,
        marginX + contentWidth - rowInset,
        rowY - 0.8
      );
    }

    const tone = item.row.tone ?? "normal";
    const color =
      tone === "success"
        ? COLORS.textSuccess
        : tone === "muted"
        ? COLORS.textMuted
        : tone === "strong"
        ? COLORS.textStrong
        : COLORS.textNormal;

    if (item.note) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.9);
      setText(doc, COLORS.textMuted);
      doc.text(item.valueLines, marginX + rowInset + rowPadX, rowY + 3.3);
      rowY += item.h;
      return;
    }

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.3);
    setText(doc, COLORS.textMuted);
    doc.text(item.labelLines, marginX + rowInset + rowPadX, rowY + 3.4);

    doc.setFont("helvetica", tone === "strong" ? "bold" : "normal");
    setText(doc, color);
    doc.text(
      item.valueLines,
      marginX + contentWidth - rowInset - rowPadX,
      rowY + 3.4,
      {
        align: "right",
      }
    );

    rowY += item.h;
  });

  layout.y += cardH + 2.2;
}

function drawProductsGrid(
  layout: PdfLayout,
  items: BookingSuccessData["items"],
  imageMap: Map<string, PdfImage | null>
) {
  const { doc, marginX, contentWidth } = layout;
  const contentPadX = 2.6;
  const gap = 2.2;
  const innerX = marginX + contentPadX;
  const innerWidth = contentWidth - contentPadX * 2;
  const colW = (innerWidth - gap * 2) / 3;
  const cardH = 20.4;
  const rowCount = Math.ceil(items.length / 3);
  const sectionH = 10.4 + rowCount * (cardH + 1.8) + 0.6;
  const sectionY = layout.y;

  ensureSpace(layout, sectionH + 2);
  setFill(doc, COLORS.sectionBg);
  setDraw(doc, COLORS.border);
  doc.rect(marginX, sectionY, contentWidth, sectionH, "FD");

  setFill(doc, COLORS.sectionHeadBg);
  doc.rect(marginX + 1.4, sectionY + 1.2, contentWidth - 2.8, 6.2, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.3);
  doc.setTextColor(...COLORS.textStrong);
  doc.text("Package Inclusions & Add-ons", marginX + 2.6, sectionY + 5.7);
  layout.y = sectionY + 10.4;

  for (let i = 0; i < items.length; i += 3) {
    const rowItems = items.slice(i, i + 3);
    ensureSpace(layout, cardH + 1.8);

    rowItems.forEach((item, col) => {
      const x = innerX + col * (colW + gap);
      drawProductCard(layout, x, layout.y, colW, cardH, item, imageMap.get(item.id) ?? null);
    });

    layout.y += cardH + 1.8;
  }

  layout.y = sectionY + sectionH + 2.2;
}

function drawProductCard(
  layout: PdfLayout,
  x: number,
  y: number,
  w: number,
  h: number,
  item: BookingSuccessData["items"][number],
  image: PdfImage | null
) {
  const { doc } = layout;
  const cardPadding = 2;
  const imageSize = h - cardPadding * 2;
  const rawProductName = sanitizeDisplayText(item.productName);
  const fallbackNumberValue =
    rawProductName.match(/\bNo:\s*([A-Za-z0-9]+)/i)?.[1] ?? "";
  const numberValue = sanitizeDisplayText(item.numberValue ?? fallbackNumberValue);
  const productTitle = rawProductName
    .replace(/\s*\bNo:\s*[A-Za-z0-9]*\s*$/i, "")
    .trim();
  const includedQuantity = Math.max(Number(item.includedQuantity ?? 0), 0);
  const extraQuantity =
    item.extraQuantity ??
    (item.unitPrice > 0 ? Math.max(Math.round(item.totalPrice / item.unitPrice), 0) : 0);
  const isEffectivelyIncluded = extraQuantity === 0 && includedQuantity > 0;
  const isIncluded = isEffectivelyIncluded || item.totalPrice <= 0;

  setFill(doc, COLORS.sectionBg);
  setDraw(doc, COLORS.border);
  doc.rect(x, y, w, h, "FD");

  if (image) {
    doc.addImage(
      image.dataUrl,
      image.format,
      x + cardPadding,
      y + cardPadding,
      imageSize,
      imageSize
    );
  } else {
    setFill(doc, COLORS.sectionHeadBg);
    doc.rect(
      x + cardPadding,
      y + cardPadding,
      imageSize,
      imageSize,
      "F"
    );
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.6);
    doc.setTextColor(...COLORS.textMuted);
    doc.text(
      "IMG",
      x + cardPadding + imageSize / 2,
      y + cardPadding + imageSize / 2 + 0.4,
      { align: "center" }
    );
  }

  const textX = x + cardPadding + imageSize + 1.8;
  const statusRight = x + w - cardPadding;
  const statusWidth = isIncluded ? 14 : 12;
  const textW = Math.max(statusRight - statusWidth - textX - 1.5, 12);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.3);
  doc.setTextColor(...COLORS.textStrong);
  const nameLines = doc.splitTextToSize(
    productTitle,
    textW
  ) as string[];
  doc.text(nameLines.slice(0, 1), textX, y + 4.8);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.6);
  doc.setTextColor(...COLORS.textMuted);
  doc.text(
    sanitizeDisplayText(`${item.variantLabel} · Qty ${item.quantity}`),
    textX,
    y + 9.5
  );

  if (numberValue) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.9);
    doc.setTextColor(...COLORS.textNormal);
    doc.text(`No: ${numberValue}`, textX, y + 13.3);
  }

  if (isIncluded) {
    const badgeW = 13.8;
    const badgeH = 5;
    const badgeX = statusRight - badgeW;
    const badgeY = y + 2;
    doc.setFillColor(237, 243, 241);
    doc.setDrawColor(185, 216, 211);
    doc.rect(badgeX, badgeY, badgeW, badgeH, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.6);
    doc.setTextColor(36, 94, 91);
    doc.text("Included", badgeX + badgeW / 2, badgeY + 3.4, {
      align: "center",
    });
  } else {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.6);
    doc.setTextColor(...COLORS.textStrong);
    doc.text(formatCurrency(item.totalPrice), statusRight, y + 5.2, {
      align: "right",
    });
  }
}

function drawFooter(layout: PdfLayout) {
  const { doc, marginX, contentWidth } = layout;
  ensureSpace(layout, 7.5);

  doc.setDrawColor(...COLORS.border);
  doc.line(marginX, layout.y + 0.8, marginX + contentWidth, layout.y + 0.8);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...COLORS.textMuted);
  doc.text("This is a system-generated ticket.", marginX, layout.y + 4.5);
  doc.text("Haven Retreat", marginX + contentWidth, layout.y + 4.5, {
    align: "right",
  });
}

function ensureSpace(layout: PdfLayout, requiredHeight: number) {
  if (layout.y + requiredHeight <= layout.pageHeight - layout.marginY) return;
  layout.doc.addPage();
  layout.y = layout.marginY;
}

function setFill(doc: import("jspdf").jsPDF, rgb: readonly [number, number, number]) {
  doc.setFillColor(rgb[0], rgb[1], rgb[2]);
}

function setDraw(doc: import("jspdf").jsPDF, rgb: readonly [number, number, number]) {
  doc.setDrawColor(rgb[0], rgb[1], rgb[2]);
}

function setText(doc: import("jspdf").jsPDF, rgb: readonly [number, number, number]) {
  doc.setTextColor(rgb[0], rgb[1], rgb[2]);
}

type ImageProcessOptions = {
  width: number;
  height: number;
  radius: number;
  mode: "cover" | "contain";
};

async function loadProcessedImage(
  sourceUrl: string | null,
  options: ImageProcessOptions
): Promise<PdfImage | null> {
  if (!sourceUrl) return null;
  if (
    typeof window === "undefined" ||
    typeof document === "undefined" ||
    typeof Image === "undefined"
  ) {
    return null;
  }

  try {
    const response = await fetch(sourceUrl, {
      mode: "cors",
      cache: "force-cache",
    });
    if (!response.ok) return null;

    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);

    try {
      const image = await loadHtmlImage(objectUrl);
      const canvas = document.createElement("canvas");
      canvas.width = options.width;
      canvas.height = options.height;

      const ctx = canvas.getContext("2d");
      if (!ctx) return null;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (options.radius > 0) {
        ctx.save();
        roundedRectPath(ctx, 0, 0, canvas.width, canvas.height, options.radius);
        ctx.clip();
      }

      drawImageFit(ctx, image, canvas.width, canvas.height, options.mode);

      if (options.radius > 0) {
        ctx.restore();
      }

      return {
        dataUrl: canvas.toDataURL("image/png"),
        format: "PNG",
      };
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  } catch {
    return null;
  }
}

function loadHtmlImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Unable to load image for PDF."));
    image.src = source;
  });
}

function roundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  const r = Math.max(0, Math.min(radius, Math.min(width, height) / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function drawImageFit(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  targetWidth: number,
  targetHeight: number,
  mode: "cover" | "contain"
) {
  const imageRatio = image.width / image.height;
  const targetRatio = targetWidth / targetHeight;

  let drawWidth = targetWidth;
  let drawHeight = targetHeight;

  if (mode === "contain") {
    if (imageRatio > targetRatio) {
      drawHeight = targetWidth / imageRatio;
    } else {
      drawWidth = targetHeight * imageRatio;
    }
  } else if (imageRatio > targetRatio) {
    drawWidth = targetHeight * imageRatio;
  } else {
    drawHeight = targetWidth / imageRatio;
  }

  const offsetX = (targetWidth - drawWidth) / 2;
  const offsetY = (targetHeight - drawHeight) / 2;

  ctx.drawImage(image, offsetX, offsetY, drawWidth, drawHeight);
}

function formatMoney(value: number): string {
  return Number(value || 0).toLocaleString("en-IN");
}

function formatCurrency(value: number): string {
  return `$${formatMoney(value)}`;
}

function sanitizeDisplayText(value: string): string {
  return String(value || "")
    .replace(/[\r\n]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function sanitizeFilename(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}
