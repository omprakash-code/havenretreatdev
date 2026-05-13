import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { formatInTimeZone } from "date-fns-tz";
import { getAuthenticatedAdminIdFromCookies } from "@/services/auth/adminAuth.server";

const IST_TIMEZONE = "Asia/Kolkata";

export async function GET(req: Request) {
  try {
    const adminId = await getAuthenticatedAdminIdFromCookies();
    if (!adminId) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const locationId = searchParams.get("locationId");
    const theatreId = searchParams.get("theatreId");
    const date = searchParams.get("date");
    const includeContext = searchParams.get("includeContext") === "true";
    const slotIds = (searchParams.get("slotIds") ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);

    const hasFilterParams = Boolean(locationId && theatreId && date);
    if (!hasFilterParams && slotIds.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Provide either locationId/theatreId/date or slotIds to fetch slot options.",
        },
        { status: 400 }
      );
    }

    const responseRows = new Map<
      string,
      {
        id: string;
        date: string;
        startTime: string;
        endTime: string;
        status: string;
        theatreId: string;
        theatreName: string;
        locationId: string;
        locationName: string;
      }
    >();

    if (hasFilterParams) {
      const requestedDateKey = String(date);
      const [year, month, day] = requestedDateKey.split("-").map(Number);
      const anchorDate = new Date(`${requestedDateKey}T00:00:00+05:30`);
      if (
        !Number.isFinite(year) ||
        !Number.isFinite(month) ||
        !Number.isFinite(day) ||
        Number.isNaN(anchorDate.getTime())
      ) {
        return NextResponse.json(
          { success: false, message: "Invalid date format. Use YYYY-MM-DD." },
          { status: 400 }
        );
      }

      const roughStart = new Date(year, month - 1, day - 1);
      const roughEnd = new Date(year, month - 1, day + 1, 23, 59, 59, 999);

      const slots = await prisma.slot.findMany({
        where: {
          theatreId: String(theatreId),
          theatre: {
            locationId: String(locationId),
            isActive: true,
          },
          date: {
            gte: roughStart,
            lte: roughEnd,
          },
        },
        select: {
          id: true,
          date: true,
          startTime: true,
          endTime: true,
          status: true,
          theatreId: true,
          theatre: {
            select: {
              name: true,
              locationId: true,
              location: {
                select: { name: true },
              },
            },
          },
        },
        orderBy: [{ startTime: "asc" }],
      });

      slots
        .filter(
          (slot) =>
            formatInTimeZone(slot.date, IST_TIMEZONE, "yyyy-MM-dd") ===
            requestedDateKey
        )
        .forEach((slot) => {
          const slotDateKey = formatInTimeZone(
            slot.date,
            IST_TIMEZONE,
            "yyyy-MM-dd"
          );
          responseRows.set(slot.id, {
            id: slot.id,
            date: slotDateKey,
            startTime: slot.startTime,
            endTime: slot.endTime,
            status: slot.status,
            theatreId: slot.theatreId,
            theatreName: slot.theatre.name,
            locationId: slot.theatre.locationId,
            locationName: slot.theatre.location?.name ?? "—",
          });
        });
    }

    let selectedSlots:
      | Array<{
          id: string;
          date: Date;
          startTime: string;
          endTime: string;
          status: string;
          theatreId: string;
          theatre: {
            name: string;
            locationId: string;
            location: {
              name: string;
            } | null;
          };
        }>
      | null = null;

    if (slotIds.length > 0) {
      selectedSlots = await prisma.slot.findMany({
        where: {
          id: {
            in: slotIds,
          },
        },
        select: {
          id: true,
          date: true,
          startTime: true,
          endTime: true,
          status: true,
          theatreId: true,
          theatre: {
            select: {
              name: true,
              locationId: true,
              location: {
                select: { name: true },
              },
            },
          },
        },
      });

      if (includeContext && !hasFilterParams && selectedSlots.length > 0) {
        const selectedSlotRows = selectedSlots.map((slot) => ({
          ...slot,
          dateKey: formatInTimeZone(slot.date, IST_TIMEZONE, "yyyy-MM-dd"),
        }));
        const firstSlot = selectedSlotRows[0];
        const shareSameContext = selectedSlotRows.every(
          (slot) =>
            slot.theatre.locationId === firstSlot.theatre.locationId &&
            slot.theatreId === firstSlot.theatreId &&
            slot.dateKey === firstSlot.dateKey
        );

        if (shareSameContext) {
          const requestedDateKey = firstSlot.dateKey;
          const [year, month, day] = requestedDateKey.split("-").map(Number);
          const roughStart = new Date(year, month - 1, day - 1);
          const roughEnd = new Date(year, month - 1, day + 1, 23, 59, 59, 999);

          const contextualSlots = await prisma.slot.findMany({
            where: {
              theatreId: firstSlot.theatreId,
              theatre: {
                locationId: firstSlot.theatre.locationId,
                isActive: true,
              },
              date: {
                gte: roughStart,
                lte: roughEnd,
              },
            },
            select: {
              id: true,
              date: true,
              startTime: true,
              endTime: true,
              status: true,
              theatreId: true,
              theatre: {
                select: {
                  name: true,
                  locationId: true,
                  location: {
                    select: { name: true },
                  },
                },
              },
            },
            orderBy: [{ startTime: "asc" }],
          });

          contextualSlots
            .filter(
              (slot) =>
                formatInTimeZone(slot.date, IST_TIMEZONE, "yyyy-MM-dd") ===
                requestedDateKey
            )
            .forEach((slot) => {
              const slotDateKey = formatInTimeZone(
                slot.date,
                IST_TIMEZONE,
                "yyyy-MM-dd"
              );
              responseRows.set(slot.id, {
                id: slot.id,
                date: slotDateKey,
                startTime: slot.startTime,
                endTime: slot.endTime,
                status: slot.status,
                theatreId: slot.theatreId,
                theatreName: slot.theatre.name,
                locationId: slot.theatre.locationId,
                locationName: slot.theatre.location?.name ?? "—",
              });
            });
        }
      }

      selectedSlots.forEach((slot) => {
        const slotDateKey = formatInTimeZone(slot.date, IST_TIMEZONE, "yyyy-MM-dd");
        responseRows.set(slot.id, {
          id: slot.id,
          date: slotDateKey,
          startTime: slot.startTime,
          endTime: slot.endTime,
          status: slot.status,
          theatreId: slot.theatreId,
          theatreName: slot.theatre.name,
          locationId: slot.theatre.locationId,
          locationName: slot.theatre.location?.name ?? "—",
        });
      });
    }

    const data = Array.from(responseRows.values()).sort((a, b) => {
      const dateSort = a.date.localeCompare(b.date);
      if (dateSort !== 0) return dateSort;
      return a.startTime.localeCompare(b.startTime);
    });

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("[COUPON_SLOT_OPTIONS]", error);
    return NextResponse.json(
      { success: false, message: "Failed to fetch slot options" },
      { status: 500 }
    );
  }
}
