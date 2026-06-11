import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const locationId = url.searchParams.get("locationId")?.trim();
  const date = url.searchParams.get("date")?.trim();

  if (!locationId || !date) {
    return NextResponse.json(
      { success: false, message: "locationId and date are required" },
      { status: 400 }
    );
  }

  // Find the active venue for this location via EventPackage.locationId
  const packages = await prisma.eventPackage.findMany({
    where: {
      locationId,
      isActive: true,
      venue: { isActive: true },
    },
    include: { venue: true },
    orderBy: { sortOrder: "asc" },
    take: 1,
  });

  let venue = packages[0]?.venue ?? null;

  if (!venue) {
    const fallback = await prisma.venue.findFirst({ where: { isActive: true } });
    if (fallback) venue = fallback;
  }

  if (!venue) {
    return NextResponse.json({ success: true, data: { theatres: [] } });
  }

  const firstPackage = packages[0];

  return NextResponse.json({
    success: true,
    data: {
      theatres: [
        {
          id: venue.id,
          name: venue.name,
          capacity: venue.maxGuests ?? 50,
          baseGuests: firstPackage?.guestLimit ?? 20,
          extraPersonPrice: 0,
          decorationPrice: firstPackage?.decorationAddonPrice ?? 375,
          // Range bookings use the TimeRangePicker; no predefined slots needed
          slots: [],
        },
      ],
    },
  });
}
