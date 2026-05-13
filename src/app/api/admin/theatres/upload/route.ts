import { NextResponse } from "next/server";
import { access, mkdir, writeFile } from "fs/promises";
import path from "path";
import { getAuthenticatedAdminIdFromCookies } from "@/services/auth/adminAuth.server";

function sanitizeSegment(value: string, fallback = "file") {
  const cleaned = value
    .normalize("NFKD")
    .replace(/[^\x00-\x7F]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-_.]+|[-_.]+$/g, "");

  return cleaned || fallback;
}

async function getUniqueFileName(uploadDir: string, originalName: string) {
  const parsed = path.parse(path.basename(originalName || "file"));
  const base = sanitizeSegment(parsed.name || "file");
  const ext = sanitizeSegment(parsed.ext.replace(/^\./, ""), "");
  let attempt = 0;

  while (true) {
    const suffix = attempt === 0 ? "" : `-${attempt}`;
    const fileName = ext ? `${base}${suffix}.${ext}` : `${base}${suffix}`;
    const fullPath = path.join(uploadDir, fileName);

    try {
      await access(fullPath);
      attempt += 1;
    } catch {
      return fileName;
    }
  }
}

export async function POST(req: Request) {
  try {
    const adminId = await getAuthenticatedAdminIdFromCookies();
    if (!adminId) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { success: false, message: "No file uploaded" },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const uploadDir = path.join(process.cwd(), "public/media/admin-uploads/theatres");
    const fileName = await getUniqueFileName(uploadDir, file.name);
    const filePath = path.join(uploadDir, fileName);

    await mkdir(uploadDir, { recursive: true });
    await writeFile(filePath, buffer);

    return NextResponse.json({
      success: true,
      url: `/api/admin/theatres/upload/${encodeURIComponent(fileName)}`,
      type: file.type.startsWith("video") 
        ? "video" 
        : file.type.startsWith("application/pdf") 
          ? "pdf" 
          : "image",
    });
  } catch (error) {
    console.error("UPLOAD_ERROR", error);
    return NextResponse.json(
      { success: false, message: "Upload failed" },
      { status: 500 }
    );
  }
}
