"use client";

import Image from "next/image";

type GalleryItem = {
  id: string;
  url: string;
  file?: File;        // NEW
  type?: "image" | "video";
};

type Props = {
  value: GalleryItem[];
  onAdd: (item: Omit<GalleryItem, "id">) => void;
  onRemove: (index: number) => void;
};

export default function TheatreGalleryUploader({
  value,
  onAdd,
  onRemove,
}: Props) {

  async function handleFiles(files: FileList | null) {
    if (!files) return;

    for (const file of Array.from(files)) {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/admin/theatres/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (data.success) {
        onAdd({
          url: data.url,
          type: data.type,
        });
      }
    }
  }


  return (
    <div className="space-y-4">
      {/* Upload zone */}
      <label className="block cursor-pointer rounded-md border-2 border-dashed border-slate-300 bg-slate-50 px-6 py-8 text-center hover:border-slate-400 transition">
        <input
          type="file"
          multiple
          accept="image/*,video/*"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />

        <div className="flex flex-col items-center gap-2">
          <div className="w-12 h-12 rounded-full bg-slate-200 flex items-center justify-center">
            <svg className="w-6 h-6 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </div>
          <p className="text-sm font-medium text-slate-700">
            Upload images or videos
          </p>
          <p className="text-xs text-slate-500">
            Drag & drop or click to browse
          </p>
        </div>
      </label>

      {/* Preview grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {value.map((item, index) => (
          <div
            key={item.id}
            className="relative group rounded-lg overflow-hidden border border-slate-200 bg-slate-100 hover:shadow-md transition">
            {item.type === "video" ? (
              <>
                <video
                  src={item.url}
                  className="w-full h-28 object-cover"
                  controls
                  playsInline
                  muted
                />
                {/* Video indicator badge */}
                <div className="absolute top-2 left-2 rounded-full bg-black/70 text-white px-2 py-0.5 text-xs flex items-center gap-1">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                  Video
                </div>
              </>
            ) : (
              <Image
                src={item.url}
                alt=""
                width={300}
                height={200}
                className="w-full h-28 object-cover"
              />
            )}

            {/* Remove button */}
            <button
              type="button"
              onClick={() => onRemove(index)}
              className="absolute top-2 right-2 cursor-pointer rounded-full bg-white/90 p-1.5 text-slate-700 shadow-lg opacity-0 transition-all duration-200 group-hover:opacity-100 hover:scale-110 hover:bg-red-50 hover:text-red-600 backdrop-blur-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ))}
      </div>


    </div>
  );
}
