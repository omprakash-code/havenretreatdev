"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { GalleryItem } from "./types";
import { ChevronLeft, ChevronRight, X } from "@/components/icons";

export default function StoryViewer({
  items,
  index,
  onClose,
}: {
  items: GalleryItem[];
  index: number;
  onClose: () => void;
}) {
  const [currentIndex, setCurrentIndex] = useState(index);
  const touchStartX = useRef<number | null>(null);

  useEffect(() => {
    setCurrentIndex(index);
  }, [index]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowRight") {
        setCurrentIndex((prev) => (prev + 1) % items.length);
      }
      if (event.key === "ArrowLeft") {
        setCurrentIndex((prev) => (prev - 1 + items.length) % items.length);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [items.length, onClose]);

  if (items.length === 0) return null;
  const item = items[currentIndex];

  const goNext = () => {
    setCurrentIndex((prev) => (prev + 1) % items.length);
  };

  const goPrev = () => {
    setCurrentIndex((prev) => (prev - 1 + items.length) % items.length);
  };

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (diff > 50) goNext();
    if (diff < -50) goPrev();
    touchStartX.current = null;
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center"
      onClick={onClose}
    >
      <button
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        className="absolute top-5 right-5 sm:top-6 sm:right-6 text-white/75 hover:text-white transition"
      >
        <X size={28} />
      </button>

      <button
        onClick={(e) => {
          e.stopPropagation();
          goPrev();
        }}
        className="absolute left-3 sm:left-6 text-white/70 hover:text-white transition"
      >
        <ChevronLeft size={34} />
      </button>

      <div
        className="max-w-5xl w-full px-12 sm:px-16"
        onClick={(e) => e.stopPropagation()}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <Image
          src={item.src}
          alt={item.caption}
          width={1600}
          height={1000}
          className="rounded-xl object-contain w-full max-h-[84vh]"
        />
        <p className="mt-3 text-center text-xs sm:text-sm text-white/70">
          {currentIndex + 1} / {items.length}
        </p>
      </div>

      <button
        onClick={(e) => {
          e.stopPropagation();
          goNext();
        }}
        className="absolute right-3 sm:right-6 text-white/70 hover:text-white transition"
      >
        <ChevronRight size={34} />
      </button>
    </div>
  );
}
