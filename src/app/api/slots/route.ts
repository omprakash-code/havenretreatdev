// src/app/api/slots/route.ts
// Availability API (Customer-side)
// Returns available slots for a given location and date

import { prisma } from "@/lib/db";
import { success } from "@/lib/response";

//Availability API (Customer-side)
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const locationId = searchParams.get("locationId");
  const date = searchParams.get("date");

  if (!locationId || !date) {
    return new Response("Missing params", { status: 400 });
  }

  const slots = await prisma.slot.findMany({
    where: {
      date: new Date(date),
      status: "AVAILABLE",
      theatre: {
        locationId,
        isActive: true,
      },
    },
    include: {
      theatre: true,
    },
    orderBy: {
      startTime: "asc",
    },
  });

  return success(slots);
}
