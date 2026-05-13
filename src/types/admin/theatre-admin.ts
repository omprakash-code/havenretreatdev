import type { TheatreCardContent } from "@/lib/theatre-card-content";

export type AdminTheatre = {
  id: string;
  name: string;
  images: {
    url: string;
    type: "image" | "video";
  }[];

  locationId: string;
  location: {
    id: string;
    name: string;
  };

  capacity: number;
  baseGuests: number;
  extraPersonPrice: number;

  decorationPrice: number;

  footerMessage?: string | null;
  mapUrl?: string | null;
  menuFile?: string | null;

  hasFood: boolean;
  isActive: boolean;
  sortOrder: number;
  cardContent: TheatreCardContent;

  startingPrice: number | null;
  createdAt: string;
  createdAtFormatted: string;
  updatedAt: string;
  updatedAtFormatted: string;
};
