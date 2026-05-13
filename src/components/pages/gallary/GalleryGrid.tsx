"use client";

import { motion } from "framer-motion";
import { GalleryItem } from "./types";
import GalleryCard from "./GalleryCard";

function getShuffleDelay(id: string, seed: string, total: number) {
  const input = `${seed}-${id}`;
  let hash = 0;

  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }

  const rank = total > 0 ? hash % total : 0;
  return Math.min(rank * 0.024, 0.22);
}

export default function GalleryGrid({
  items,
  animationSeed,
  onSelect,
}: {
  items: GalleryItem[];
  animationSeed: string;
  onSelect: (index: number) => void;
}) {
  return (
    <motion.div
      layout
      className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4"
    >
      {items.map((item, i) => (
        <GalleryCard
          key={`${animationSeed}-${item.id}`}
          item={item}
          delay={getShuffleDelay(item.id, animationSeed, items.length)}
          onClick={() => onSelect(i)}
        />
      ))}
    </motion.div>
  );
}
