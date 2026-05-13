import { NextResponse } from "next/server";
import { access, readFile } from "fs/promises";
import path from "path";

function getContentType(fileName: string): string {
  const ext = path.extname(fileName).toLowerCase();
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  if (ext === ".gif") return "image/gif";
  if (ext === ".svg") return "image/svg+xml";
  if (ext === ".mp4") return "video/mp4";
  if (ext === ".webm") return "video/webm";
  if (ext === ".pdf") return "application/pdf";
  return "application/octet-stream";
}

function isSafeFileName(fileName: string): boolean {
  if (!fileName) return false;
  if (fileName.includes("/") || fileName.includes("\\")) return false;
  if (fileName.includes("..")) return false;
  return true;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ fileName: string }> }
) {
  try {
    const { fileName } = await params;

    if (!isSafeFileName(fileName)) {
      return NextResponse.json(
        { success: false, message: "Invalid file name" },
        { status: 400 }
      );
    }

    const uploadDir = path.join(process.cwd(), "public/media/admin-uploads/theatres");
    const safeName = path.basename(fileName);
    const filePath = path.join(uploadDir, safeName);

    await access(filePath);
    const fileBuffer = await readFile(filePath);

    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": getContentType(safeName),
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return NextResponse.json(
      { success: false, message: "File not found" },
      { status: 404 }
    );
  }
}
