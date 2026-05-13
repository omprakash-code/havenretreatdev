// src/app/api/occassions/route.ts
// read-only for users to get list of active occasions with their fields
// Used in booking flow to select occasion
// API route to fetch active occasions with their fields
// Example: GET /api/occassions
// Returns a JSON array of occasions with their associated fields

/*
// Example Response
[
  {
    "id": "oc1",
    "key": "BIRTHDAY",
    "label": "Birthday",
    "icon": "/icons/occasion/birthday.png",
    "subtext": "Make their special day unforgettable",
    "fields": [
      {
        "fieldKey": "name",
        "label": "Who are we celebrating today?",
        "isRequired": true
      }
    ]
  }
]
*/


import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const occasions = await prisma.occasion.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      include: {
        fields: {
          orderBy: { sortOrder: "asc" },
        },
      },
    });

    return NextResponse.json(occasions);
  } catch (error) {
    console.error("FETCH OCCASIONS ERROR:", error);
    return NextResponse.json(
      { message: "Failed to fetch occasions" },
      { status: 500 }
    );
  }
}
