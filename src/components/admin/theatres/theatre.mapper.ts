import type { AdminTheatre } from "@/types/admin/theatre-admin";
import type { TheatreFormValues } from "./theatre.schema";
import { normalizeTheatreCardContent } from "@/lib/theatre-card-content";

export function mapAdminTheatreToForm(
  theatre: AdminTheatre
): Partial<TheatreFormValues> {
  return {
    name: theatre.name,
    locationId: theatre.location.id,

    capacity: theatre.capacity,
    baseGuests: theatre.baseGuests,
    extraPersonPrice: theatre.extraPersonPrice,
    decorationPrice: theatre.decorationPrice,
    hasFood: theatre.hasFood,
    isActive: theatre.isActive,
    sortOrder: theatre.sortOrder,

    images: theatre.images.map((media) => ({
      url: media.url,
      type: media.type,
    })),

    footerMessage: theatre.footerMessage ?? undefined,
    mapUrl: theatre.mapUrl ?? undefined,
    menuFile: theatre.menuFile ?? undefined,
    cardContent: normalizeTheatreCardContent(theatre.cardContent),
  };
}
