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
  const marginX = 14;
  const marginY = 14;
  const contentWidth = pageWidth - marginX * 2;
  const acknowledgedSet = new Set(agreement.acknowledgedClauses);
  const clauses = extractStoredClauses(agreement.agreementHtmlSnapshot);
  let y = marginY;

  const addPage = () => {
    doc.addPage();
    y = marginY;
  };

  const ensureSpace = (height: number) => {
    if (y + height <= pageHeight - marginY) return;
    addPage();
  };

  doc.setDrawColor(52, 127, 124);
  doc.setLineWidth(0.7);
  doc.line(marginX, y, marginX + contentWidth, y);
  y += 8;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.setTextColor(15, 23, 42);
  doc.text("Haven Retreat Signed Agreement", marginX, y);
  y += 7;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(71, 84, 103);
  const metadata = [
    `Booking reference: ${normalizePdfText(data.bookingRef)}`,
    `Signer: ${normalizePdfText(agreement.signerName)}`,
    `Signed: ${normalizePdfText(formatISTDateTime(agreement.signedAt))}`,
    `Agreement version: ${normalizePdfText(
      agreement.agreementVersion ?? "Not specified"
    )}`,
    `Agreement ID: ${normalizePdfText(agreement.id)}`,
    `Acknowledgments: ${agreement.acknowledgedClauses.length} of ${clauses.length}`,
  ];
  metadata.forEach((line) => {
    doc.text(line, marginX, y);
    y += 4.8;
  });

  y += 2;
  doc.setFillColor(242, 248, 246);
  doc.setDrawColor(185, 216, 211);
  doc.rect(marginX, y, contentWidth, 11, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(36, 94, 91);
  doc.text(
    "Each clause below was individually acknowledged before signing.",
    marginX + 3,
    y + 6.8
  );
  y += 16;

  clauses.forEach((clause) => {
    const title = normalizePdfText(clause.title);
    const body = normalizePdfText(clause.body);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.3);
    const titleLines = doc.splitTextToSize(
      title,
      contentWidth - 13
    ) as string[];
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.4);
    const bodyLines = doc.splitTextToSize(
      body,
      contentWidth - 13
    ) as string[];
    const clauseHeight =
      6 + titleLines.length * 4.1 + bodyLines.length * 3.8 + 5;

    ensureSpace(clauseHeight + 2);
    doc.setDrawColor(226, 232, 240);
    doc.setFillColor(248, 250, 252);
    doc.rect(marginX, y, contentWidth, clauseHeight, "FD");

    const checkboxX = marginX + 3;
    const checkboxY = y + 4;
    doc.setDrawColor(52, 127, 124);
    doc.setFillColor(52, 127, 124);
    doc.rect(checkboxX, checkboxY, 5, 5, "FD");
    if (acknowledgedSet.has(clause.number)) {
      doc.setDrawColor(255, 255, 255);
      doc.setLineWidth(0.55);
      doc.line(checkboxX + 1.1, checkboxY + 2.7, checkboxX + 2.2, checkboxY + 3.8);
      doc.line(checkboxX + 2.2, checkboxY + 3.8, checkboxX + 4.1, checkboxY + 1.3);
    }

    const textX = marginX + 11;
    let textY = y + 6.6;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.3);
    doc.setTextColor(15, 23, 42);
    doc.text(titleLines, textX, textY);
    textY += titleLines.length * 4.1 + 1.2;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.4);
    doc.setTextColor(71, 84, 103);
    doc.text(bodyLines, textX, textY);
    textY += bodyLines.length * 3.8 + 1.5;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.8);
    doc.setTextColor(52, 127, 124);
    doc.text(
      acknowledgedSet.has(clause.number)
        ? "ACKNOWLEDGED"
        : "ACKNOWLEDGMENT NOT RECORDED",
      textX,
      textY
    );

    y += clauseHeight + 2;
  });

  ensureSpace(62);
  doc.setDrawColor(226, 232, 240);
  doc.setFillColor(255, 255, 255);
  doc.rect(marginX, y, contentWidth, 57, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text("Electronic Signature", marginX + 3, y + 7);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.8);
  doc.setTextColor(71, 84, 103);
  doc.text(
    normalizePdfText(
      `I, ${agreement.signerName}, confirm that this electronic signature is mine and that I agree to the terms above.`
    ),
    marginX + 3,
    y + 13,
    { maxWidth: contentWidth - 6 }
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
      marginX + 3,
      y + 20,
      70,
      24
    );
  } catch {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8.5);
    doc.text("Stored signature image could not be rendered.", marginX + 3, y + 31);
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(71, 84, 103);
  doc.text(`Signed by: ${normalizePdfText(agreement.signerName)}`, marginX + 80, y + 27);
  doc.text(
    `Signed at: ${normalizePdfText(formatISTDateTime(agreement.signedAt))}`,
    marginX + 80,
    y + 33
  );
  doc.text(
    `Signature consent: ${
      agreement.confirmationAccepted ? "Accepted" : "Not recorded"
    }`,
    marginX + 80,
    y + 39
  );

  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(
      `Haven Retreat - ${normalizePdfText(data.bookingRef)}`,
      marginX,
      pageHeight - 7
    );
    doc.text(`Page ${page} of ${pageCount}`, pageWidth - marginX, pageHeight - 7, {
      align: "right",
    });
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
