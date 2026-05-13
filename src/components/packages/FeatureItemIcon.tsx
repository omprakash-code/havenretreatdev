import {
  Armchair,
  BrushCleaning,
  Check,
  Clock3,
  Flower2,
  Hourglass,
  Refrigerator,
  Table2,
  Volume2,
  WavesLadder,
  Wifi,
} from "lucide-react";

function resolveIcon(
  label: string,
  className: string,
  strokeWidth: number
) {
  const token = label.toLowerCase();

  if (token.includes("setup")) {
    return <Hourglass className={className} strokeWidth={strokeWidth} />;
  }

  if (token.includes("hour") || token.includes("rental")) {
    return <Clock3 className={className} strokeWidth={strokeWidth} />;
  }

  if (
    token.includes("pool") ||
    token.includes("backyard") ||
    token.includes("water")
  ) {
    return <WavesLadder className={className} strokeWidth={strokeWidth} />;
  }

  if (token.includes("cooler") || token.includes("ice")) {
    return <Refrigerator className={className} strokeWidth={strokeWidth} />;
  }

  if (
    token.includes("speaker") ||
    token.includes("music") ||
    token.includes("sound")
  ) {
    return <Volume2 className={className} strokeWidth={strokeWidth} />;
  }

  if (token.includes("wifi") || token.includes("wi-fi")) {
    return <Wifi className={className} strokeWidth={strokeWidth} />;
  }

  if (
    token.includes("table") ||
    token.includes("spandex")
  ) {
    return <Table2 className={className} strokeWidth={strokeWidth} />;
  }

  if (token.includes("chair") || token.includes("seat")) {
    return <Armchair className={className} strokeWidth={strokeWidth} />;
  }

  if (
    token.includes("decor") ||
    token.includes("balloon") ||
    token.includes("led") ||
    token.includes("cake") ||
    token.includes("celebration")
  ) {
    return <Flower2 className={className} strokeWidth={strokeWidth} />;
  }

  if (
    token.includes("clean") ||
    token.includes("trash") ||
    token.includes("removal")
  ) {
    return <BrushCleaning className={className} strokeWidth={strokeWidth} />;
  }

  return <Check className={className} strokeWidth={strokeWidth} />;
}

export default function FeatureItemIcon({
  label,
  className = "mt-1 h-4 w-4 shrink-0 text-[#347f7c]",
}: {
  label: string;
  className?: string;
}) {
  return resolveIcon(label, className, 2.2);
}
