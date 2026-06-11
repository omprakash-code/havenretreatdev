import { access, readFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";

function getContentType(fileName: string) {
  const extension = path.extname(fileName).toLowerCase();
  if (extension === ".jpg" || extension === ".jpeg") return "image/jpeg";
  if (extension === ".png") return "image/png";
  if (extension === ".webp") return "image/webp";
  if (extension === ".gif") return "image/gif";
  if (extension === ".svg") return "image/svg+xml";
  return "application/octet-stream";
}

function isSafeFileName(fileName: string) {
  return Boolean(
    fileName &&
      !fileName.includes("/") &&
      !fileName.includes("\\") &&
      !fileName.includes("..")
  );
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

    const safeName = path.basename(fileName);
    const filePath = path.join(
      process.cwd(),
      "public/media/admin-uploads/products",
      safeName
    );

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
