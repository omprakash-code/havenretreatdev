import Image from "next/image";
import { motion } from "framer-motion";
import { GalleryItem } from "./types";

export default function GalleryCard({
  item,
  delay,
  onClick,
}: {
  item: GalleryItem;
  delay: number;
  onClick: () => void;
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12, scale: 0.985, rotate: -0.5 }}
      animate={{ opacity: 1, y: 0, scale: 1, rotate: 0 }}
      transition={{ duration: 0.32, delay, ease: [0.22, 1, 0.36, 1] }}
      whileTap={{ scale: 0.99 }}
      className="group relative aspect-[4/5] cursor-pointer overflow-hidden rounded-2xl border border-black/5 bg-black/5 shadow-sm"
      onClick={onClick}
    >
      <Image
        src={item.src}
        alt={item.caption}
        fill
        sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
        className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
      />
    </motion.div>
  );
}
