"use client";

import { useState } from "react";

type PdfItem = {
  id: string;
  url: string;
  name: string;
};

type Props = {
  value?: PdfItem | null;
  onChange: (item: PdfItem | null) => void;
};

export default function PdfUploader({ value, onChange }: Props) {
  const [uploading, setUploading] = useState(false);

  async function handleFile(file: File) {
    if (file.type !== "application/pdf") {
      alert("Please select a PDF file");
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/admin/theatres/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (data.success) {
        onChange({
          id: Date.now().toString(),
          url: data.url,
          name: file.name,
        });
      } else {
        alert("Upload failed");
      }
    } catch (error) {
      console.error("UPLOAD_ERROR", error);
      alert("Upload failed");
    } finally {
      setUploading(false);
    }
  }

  function handleRemove() {
    onChange(null);
  }

  return (
    <div className="space-y-4">
      {value ? (
        <div className="relative rounded-lg border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-12 h-12 rounded bg-red-100 flex items-center justify-center">
              <svg
                className="w-6 h-6 text-red-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-900 truncate">
                {value.name}
              </p>
              <p className="text-xs text-slate-500">PDF Menu</p>
            </div>
            <button
              type="button"
              onClick={handleRemove}
              className="cursor-pointer rounded-full p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>
      ) : (
        <label className="block cursor-pointer rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 p-6 text-center hover:border-slate-400 hover:bg-slate-100 transition">
          <input
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
            }}
          />
          <div className="flex flex-col items-center gap-2">
            <div className="w-12 h-12 rounded-full bg-slate-200 flex items-center justify-center">
              {uploading ? (
                <svg
                  className="w-6 h-6 text-slate-500 animate-spin"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
              ) : (
                <svg
                  className="w-6 h-6 text-slate-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                  />
                </svg>
              )}
            </div>
            <div>
              <p className="text-sm font-medium text-slate-700">
                Upload PDF Menu
              </p>
              <p className="text-xs text-slate-500">
                Click to browse or drag and drop
              </p>
            </div>
          </div>
        </label>
      )}
    </div>
  );
}
