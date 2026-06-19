import type {
  BookingSuccessData,
  BookingSuccessSignedAgreement,
} from "@/components/booking/success/types";
import {
  HAVEN_AGREEMENT_REQUIRED_ACKNOWLEDGMENTS,
  HAVEN_AGREEMENT_SECTIONS,
} from "@/constants/haven-agreement-content";
import { formatISTDateTime } from "@/lib/formatters";

type AgreementClause = {
  number: number;
  title: string;
  body: string;
};

// Palette aligned with the booking flow UI tokens (teal #347f7c family).
const PDF_COLORS = {
  teal: [52, 127, 124] as const, // #347f7c
  tealDark: [36, 94, 91] as const, // #245e5b
  tealSoft: [237, 243, 241] as const, // #edf3f1
  tealBorder: [215, 228, 225] as const, // #d7e4e1
  ink: [16, 24, 40] as const, // #101828
  body: [71, 84, 103] as const, // #475467
  muted: [102, 112, 133] as const, // #667085
  border: [215, 228, 225] as const, // #d7e4e1 (teal-tinted, matches booking cards)
  surface: [248, 251, 250] as const, // #f8fbfa
  white: [255, 255, 255] as const,
};

// Flat style to match the booking flow UI (sharp corners, no border radius).
const PDF_RADIUS = {
  card: 0,
  inner: 0,
  pill: 0,
};

function normalizePdfText(value: string) {
  return String(value ?? "")
    .replaceAll("\u2018", "'")
    .replaceAll("\u2019", "'")
    .replaceAll("\u201c", '"')
    .replaceAll("\u201d", '"')
    .replaceAll("\u2013", "-")
    .replaceAll("\u2014", "-")
    .replaceAll("\u2022", "-")
    .replace(/[^\x20-\x7E\n]/g, "");
}

function getElementTextWithBreaks(element: Element | null) {
  if (!element) return "";

  return Array.from(element.childNodes)
    .map((node) =>
      node.nodeName === "BR" ? "\n" : node.textContent ?? ""
    )
    .join("")
    .trim();
}

function getFallbackClauses(): AgreementClause[] {
  return [
    ...HAVEN_AGREEMENT_SECTIONS.map((section, index) => ({
      number: index + 1,
      title: section.title,
      body: section.body.join("\n"),
    })),
    ...HAVEN_AGREEMENT_REQUIRED_ACKNOWLEDGMENTS.map((section) => ({
      number: section.number,
      title: `${section.number}. ${section.title}`,
      body: section.body.join("\n"),
    })),
  ];
}

function decodeSnapshotText(value: string) {
  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&")
    .trim();
}

function extractStoredClausesWithoutDom(snapshot: string) {
  return Array.from(
    snapshot.matchAll(
      /<section[^>]*data-clause-number="(\d+)"[^>]*>[\s\S]*?<h2>([\s\S]*?)<\/h2>\s*<p>([\s\S]*?)<\/p>/gi
    )
  )
    .map((match) => ({
      number: Number(match[1]),
      title: decodeSnapshotText(match[2] ?? ""),
      body: decodeSnapshotText(match[3] ?? ""),
    }))
    .filter(
      (clause): clause is AgreementClause =>
        Number.isInteger(clause.number) &&
        clause.number > 0 &&
        Boolean(clause.title)
    )
    .sort((left, right) => left.number - right.number);
}

function extractStoredClauses(snapshot: string | null | undefined) {
  if (!snapshot) {
    return getFallbackClauses();
  }
  if (typeof DOMParser === "undefined") {
    const clauses = extractStoredClausesWithoutDom(snapshot);
    return clauses.length > 0 ? clauses : getFallbackClauses();
  }

  const document = new DOMParser().parseFromString(snapshot, "text/html");
  const clauses = Array.from(
    document.querySelectorAll<HTMLElement>("section[data-clause-number]")
  )
    .map((section) => {
      const number = Number(section.dataset.clauseNumber);
      const title = section.querySelector("h2")?.textContent?.trim() ?? "";
      const body = getElementTextWithBreaks(
        section.querySelector("h2 + p")
      );

      return { number, title, body };
    })
    .filter(
      (clause): clause is AgreementClause =>
        Number.isInteger(clause.number) &&
        clause.number > 0 &&
        Boolean(clause.title)
    )
    .sort((left, right) => left.number - right.number);

  return clauses.length > 0 ? clauses : getFallbackClauses();
}

function sanitizeFilename(value: string) {
  return value.replace(/[^a-z0-9-_]+/gi, "-").replace(/^-+|-+$/g, "");
}

function downloadPdf(filename: string, arrayBuffer: ArrayBuffer) {
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

function requireSignedAgreement(
  data: BookingSuccessData
): BookingSuccessSignedAgreement {
  if (!data.signedAgreement) {
    throw new Error("SIGNED_AGREEMENT_NOT_FOUND");
  }
  return data.signedAgreement;
}

export async function buildSignedAgreementPdf(
  data: BookingSuccessData
): Promise<{ filename: string; arrayBuffer: ArrayBuffer }> {
  const agreement = requireSignedAgreement(data);
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
    compress: true,
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 16;
  const marginY = 15;
  const contentWidth = pageWidth - marginX * 2;
  const acknowledgedSet = new Set(agreement.acknowledgedClauses);
  const clauses = extractStoredClauses(agreement.agreementHtmlSnapshot);
  let y = marginY;

  const drawContinuationHeader = () => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...PDF_COLORS.tealDark);
    doc.text("HAVEN RETREAT", marginX, marginY);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...PDF_COLORS.muted);
    doc.text("SIGNED EVENT RENTAL AGREEMENT", pageWidth - marginX, marginY, {
      align: "right",
    });
    doc.setDrawColor(...PDF_COLORS.tealBorder);
    doc.setLineWidth(0.35);
    doc.line(marginX, marginY + 3, pageWidth - marginX, marginY + 3);
    y = marginY + 9;
  };

  const addPage = () => {
    doc.addPage();
    drawContinuationHeader();
  };

  const ensureSpace = (height: number) => {
    if (y + height <= pageHeight - 15) return;
    addPage();
  };

  doc.setFillColor(...PDF_COLORS.teal);
  doc.rect(marginX, y, 4, 25, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...PDF_COLORS.tealDark);
  doc.text("HAVEN RETREAT", marginX + 8, y + 4);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(...PDF_COLORS.ink);
  doc.text("Event Rental Agreement", marginX + 8, y + 13);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.7);
  doc.setTextColor(...PDF_COLORS.muted);
  doc.text(
    "ELECTRONICALLY SIGNED AND INDIVIDUALLY ACKNOWLEDGED",
    marginX + 8,
    y + 19
  );

  doc.setFillColor(...PDF_COLORS.tealSoft);
  doc.setDrawColor(...PDF_COLORS.tealBorder);
  doc.roundedRect(
    pageWidth - marginX - 31,
    y + 2,
    31,
    9,
    PDF_RADIUS.pill,
    PDF_RADIUS.pill,
    "FD"
  );
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...PDF_COLORS.tealDark);
  doc.text("SIGNED", pageWidth - marginX - 15.5, y + 7.7, {
    align: "center",
  });
  y += 32;

  const metadata = [
    ["BOOKING REFERENCE", normalizePdfText(data.bookingRef)],
    ["AGREEMENT ID", normalizePdfText(agreement.id)],
    ["SIGNED BY", normalizePdfText(agreement.signerName)],
    ["SIGNED AT", normalizePdfText(formatISTDateTime(agreement.signedAt))],
    [
      "AGREEMENT VERSION",
      normalizePdfText(agreement.agreementVersion ?? "Not specified"),
    ],
    [
      "ACKNOWLEDGMENTS",
      `${agreement.acknowledgedClauses.length} of ${clauses.length} completed`,
    ],
  ];

  const summaryHeight = 31;
  const summaryColumnWidth = contentWidth / 2;
  doc.setFillColor(...PDF_COLORS.surface);
  doc.setDrawColor(...PDF_COLORS.border);
  doc.roundedRect(
    marginX,
    y,
    contentWidth,
    summaryHeight,
    PDF_RADIUS.card,
    PDF_RADIUS.card,
    "FD"
  );
  doc.setDrawColor(...PDF_COLORS.border);
  doc.line(
    marginX + summaryColumnWidth,
    y + 4,
    marginX + summaryColumnWidth,
    y + summaryHeight - 4
  );

  metadata.forEach(([label, value], index) => {
    const column = index % 2;
    const row = Math.floor(index / 2);
    const x = marginX + column * summaryColumnWidth + 4;
    const rowY = y + 6 + row * 9;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.7);
    doc.setTextColor(...PDF_COLORS.muted);
    doc.text(label, x, rowY);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.7);
    doc.setTextColor(...PDF_COLORS.ink);
    doc.text(value, x, rowY + 3.8, {
      maxWidth: summaryColumnWidth - 8,
    });
  });
  y += summaryHeight + 9;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...PDF_COLORS.ink);
  doc.text("Terms and Acknowledgments", marginX, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...PDF_COLORS.muted);
  doc.text(
    "Each clause was reviewed and acknowledged before the electronic signature was submitted.",
    marginX,
    y + 5
  );
  y += 11;

  clauses.forEach((clause) => {
    const title = normalizePdfText(clause.title).replace(
      new RegExp(`^\\s*${clause.number}\\.\\s*`),
      ""
    );
    const body = normalizePdfText(clause.body);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    const titleLines = doc.splitTextToSize(
      title,
      contentWidth - 18
    ) as string[];
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.15);
    const bodyLines = doc.splitTextToSize(
      body,
      contentWidth - 18
    ) as string[];
    const clauseHeight =
      6 + titleLines.length * 3.9 + bodyLines.length * 3.55 + 4.5;

    ensureSpace(clauseHeight + 1.5);
    doc.setFillColor(...PDF_COLORS.white);
    doc.setDrawColor(...PDF_COLORS.border);
    doc.roundedRect(
      marginX,
      y,
      contentWidth,
      clauseHeight,
      PDF_RADIUS.card,
      PDF_RADIUS.card,
      "FD"
    );
    // Left accent strip (flat).
    const accentWidth = 13;
    doc.setFillColor(...PDF_COLORS.tealSoft);
    doc.rect(marginX, y, accentWidth, clauseHeight, "F");

    const checkboxX = marginX + 4;
    const checkboxY = y + 4;
    doc.setDrawColor(...PDF_COLORS.teal);
    doc.setFillColor(...PDF_COLORS.teal);
    doc.circle(checkboxX + 2.5, checkboxY + 2.5, 2.6, "FD");
    if (acknowledgedSet.has(clause.number)) {
      doc.setDrawColor(...PDF_COLORS.white);
      doc.setLineWidth(0.45);
      doc.line(checkboxX + 1.1, checkboxY + 2.6, checkboxX + 2.2, checkboxY + 3.7);
      doc.line(checkboxX + 2.2, checkboxY + 3.7, checkboxX + 4.1, checkboxY + 1.4);
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(...PDF_COLORS.tealDark);
    doc.text(String(clause.number).padStart(2, "0"), marginX + 6.5, y + clauseHeight - 4, {
      align: "center",
    });

    const textX = marginX + 17;
    let textY = y + 6.6;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...PDF_COLORS.ink);
    doc.text(titleLines, textX, textY);
    textY += titleLines.length * 3.9 + 1;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.15);
    doc.setTextColor(...PDF_COLORS.body);
    doc.text(bodyLines, textX, textY);
    textY += bodyLines.length * 3.55 + 1.2;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.8);
    doc.setTextColor(...PDF_COLORS.teal);
    doc.text(
      acknowledgedSet.has(clause.number)
        ? "ACKNOWLEDGED ELECTRONICALLY"
        : "ACKNOWLEDGMENT NOT RECORDED",
      textX,
      textY
    );

    y += clauseHeight + 1.5;
  });

  ensureSpace(66);
  y += 5;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...PDF_COLORS.ink);
  doc.text("Electronic Signature Certificate", marginX, y);
  y += 5;

  doc.setDrawColor(...PDF_COLORS.tealBorder);
  doc.setFillColor(...PDF_COLORS.tealSoft);
  doc.roundedRect(
    marginX,
    y,
    contentWidth,
    54,
    PDF_RADIUS.card,
    PDF_RADIUS.card,
    "FD"
  );
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...PDF_COLORS.tealDark);
  doc.text("SIGNATURE ON FILE", marginX + 5, y + 7);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.2);
  doc.setTextColor(...PDF_COLORS.body);
  doc.text(
    normalizePdfText(
      `I, ${agreement.signerName}, confirm that this electronic signature is mine and that I agree to the terms above.`
    ),
    marginX + 5,
    y + 13,
    { maxWidth: contentWidth - 10 }
  );

  const signatureBoxY = y + 19;
  const signatureBoxWidth = 76;
  doc.setFillColor(...PDF_COLORS.white);
  doc.setDrawColor(...PDF_COLORS.tealBorder);
  doc.roundedRect(
    marginX + 5,
    signatureBoxY,
    signatureBoxWidth,
    27,
    PDF_RADIUS.inner,
    PDF_RADIUS.inner,
    "FD"
  );

  try {
    const signatureFormat = agreement.signatureImage.startsWith(
      "data:image/jpeg"
    )
      ? "JPEG"
      : "PNG";
    doc.addImage(
      agreement.signatureImage,
      signatureFormat,
      marginX + 8,
      signatureBoxY + 3,
      70,
      18
    );
  } catch {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.text(
      "Stored signature image could not be rendered.",
      marginX + 9,
      signatureBoxY + 14
    );
  }
  doc.setDrawColor(...PDF_COLORS.border);
  doc.line(
    marginX + 10,
    signatureBoxY + 22,
    marginX + signatureBoxWidth,
    signatureBoxY + 22
  );
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.6);
  doc.setTextColor(...PDF_COLORS.muted);
  doc.text("ELECTRONIC SIGNATURE", marginX + 10, signatureBoxY + 25);

  const certificateX = marginX + 90;
  const certificateRows = [
    ["SIGNER", normalizePdfText(agreement.signerName)],
    ["SIGNED AT", normalizePdfText(formatISTDateTime(agreement.signedAt))],
    [
      "CONSENT",
      agreement.confirmationAccepted ? "Electronically accepted" : "Not recorded",
    ],
    ["AGREEMENT ID", normalizePdfText(agreement.id)],
  ];
  certificateRows.forEach(([label, value], index) => {
    const rowY = signatureBoxY + 3 + index * 6.2;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.4);
    doc.setTextColor(...PDF_COLORS.muted);
    doc.text(label, certificateX, rowY);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...PDF_COLORS.ink);
    doc.text(value, certificateX, rowY + 3.1, {
      maxWidth: pageWidth - marginX - certificateX - 3,
    });
  });

  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    doc.setDrawColor(...PDF_COLORS.border);
    doc.setLineWidth(0.25);
    doc.line(marginX, pageHeight - 12, pageWidth - marginX, pageHeight - 12);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.8);
    doc.setTextColor(...PDF_COLORS.muted);
    doc.text(
      `HAVEN RETREAT  |  ${normalizePdfText(agreement.id)}`,
      marginX,
      pageHeight - 7.5
    );
    doc.text(
      `Booking ${normalizePdfText(data.bookingRef)}  |  Page ${page} of ${pageCount}`,
      pageWidth - marginX,
      pageHeight - 7.5,
      { align: "right" }
    );
  }

  const filename = `${sanitizeFilename(
    agreement.id || data.bookingRef || "agreement"
  )}-signed-agreement.pdf`;
  return { filename, arrayBuffer: doc.output("arraybuffer") };
}

export async function downloadSignedAgreementPdf(data: BookingSuccessData) {
  const { filename, arrayBuffer } = await buildSignedAgreementPdf(data);
  downloadPdf(filename, arrayBuffer);
}
