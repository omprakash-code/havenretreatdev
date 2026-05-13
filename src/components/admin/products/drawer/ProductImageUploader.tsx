"use client";

import { useRef, useState } from "react";
import { Plus, Trash } from "@/components/icons";

type ProductImageUploaderProps = {
  value: string;
  disabled?: boolean;
  onChange: (url: string) => void;
};

export default function ProductImageUploader({
  value,
  disabled = false,
  onChange,
}: ProductImageUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  async function handleFile(file: File) {
    if (!file.type.startsWith("image/")) {
      setUploadError("Please select an image file.");
      return;
    }

    setUploadError(null);
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/admin/theatres/upload", {
        method: "POST",
        body: formData,
      });

      const data = (await res.json()) as {
        success: boolean;
        url?: string;
        message?: string;
      };

      if (!res.ok || !data.success || !data.url) {
        throw new Error(data.message ?? "Upload failed");
      }

      onChange(data.url);
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Image upload failed.");
    } finally {
      setUploading(false);
    }
  }

  function getFileNameFromUrl(url: string) {
    const raw = url.split("/").pop() ?? "";
    const clean = raw.split("?")[0] ?? raw;
    return decodeURIComponent(clean) || "uploaded-image";
  }

  return (
    <div className="space-y-3">
      {value ? (
        <div className="rounded-lg border border-slate-200 bg-white p-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
            <div className="relative h-24 w-24 overflow-hidden rounded-md border border-slate-200 bg-slate-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={value} alt="Product" className="h-full w-full object-cover" />
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Image</p>
              <p className="mt-1 break-all text-sm text-slate-700">
                {getFileNameFromUrl(value)}
              </p>
            </div>

            <button
              type="button"
              disabled={disabled || uploading}
              onClick={() => onChange("")}
              className="inline-flex h-9 items-center justify-center gap-1 rounded-md border border-red-200 px-3 text-xs font-medium text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Trash size={13} />
              Remove
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          disabled={disabled || uploading}
          onClick={() => fileInputRef.current?.click()}
          className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-7 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {uploading ? (
            <span className="inline-flex items-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-400 border-t-transparent" />
              Uploading...
            </span>
          ) : (
            <span className="inline-flex items-center gap-2">
              <Plus size={16} />
              Upload Product Image
            </span>
          )}
        </button>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) {
            void handleFile(file);
          }
          event.currentTarget.value = "";
        }}
      />

      {uploadError && <p className="text-xs text-red-600">{uploadError}</p>}
    </div>
  );
}
