import type { PdfImage } from "@/components/booking/success/pdf/downloadBookingTicketPdf";

/**
 * Reads an image the PDF asks for off the local public directory. The browser
 * fetches these over the network; a server drawing the same PDF cannot, so it
 * reads the file and hands jsPDF a data URL.
 */
export async function loadServerPdfImage(
  sourceUrl: string | null
): Promise<PdfImage | null> {
  if (!sourceUrl || !sourceUrl.startsWith("/")) return null;

  const extension = sourceUrl.split(".").pop()?.toLowerCase();

  try {
    const [{ readFile }, path] = await Promise.all([
      import("node:fs/promises"),
      import("node:path"),
    ]);
    const filePath = path.join(
      process.cwd(),
      "public",
      sourceUrl.replace(/^\/+/, "")
    );
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
