import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock, authMock } = vi.hoisted(() => ({
  prismaMock: {
    slot: {
      findMany: vi.fn(),
    },
  },
  authMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: prismaMock,
}));

vi.mock("@/services/auth/adminAuth.server", () => ({
  getAuthenticatedAdminIdFromCookies: authMock,
}));

import { GET } from "@/app/api/admin/coupons/options/slots/route";

function makeRequest(url: string) {
  return new Request(url, { method: "GET" });
}

describe("GET /api/admin/coupons/options/slots", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue("admin-1");
  });

  it("returns 400 when neither filter params nor slotIds are provided", async () => {
    const res = await GET(
      makeRequest("http://localhost/api/admin/coupons/options/slots")
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.success).toBe(false);
  });

  it("returns selected slot context by slotIds for SLOT rule prefill", async () => {
    prismaMock.slot.findMany.mockResolvedValue([
      {
        id: "slot_2",
        date: new Date("2026-02-26T08:00:00.000Z"),
        startTime: "13:30",
        endTime: "16:30",
        status: "BOOKED",
        theatreId: "theatre_3",
        theatre: {
          name: "Theatre 3",
          locationId: "loc_pitampura",
          location: { name: "Pitampura" },
        },
      },
    ]);

    const res = await GET(
      makeRequest(
        "http://localhost/api/admin/coupons/options/slots?slotIds=slot_2"
      )
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toEqual([
      {
        id: "slot_2",
        date: "2026-02-26",
        startTime: "13:30",
        endTime: "16:30",
        status: "BOOKED",
        theatreId: "theatre_3",
        theatreName: "Theatre 3",
        locationId: "loc_pitampura",
        locationName: "Pitampura",
      },
    ]);

    expect(prismaMock.slot.findMany).toHaveBeenCalledTimes(1);
    expect(prismaMock.slot.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: {
            in: ["slot_2"],
          },
        },
      })
    );
  });

  it("loads full slot context in one request when includeContext is enabled", async () => {
    prismaMock.slot.findMany
      .mockResolvedValueOnce([
        {
          id: "slot_2",
          date: new Date("2026-02-26T08:00:00.000Z"),
          startTime: "13:30",
          endTime: "16:30",
          status: "BOOKED",
          theatreId: "theatre_3",
          theatre: {
            name: "Theatre 3",
            locationId: "loc_pitampura",
            location: { name: "Pitampura" },
          },
        },
      ])
      .mockResolvedValueOnce([
        {
          id: "slot_1",
          date: new Date("2026-02-26T08:00:00.000Z"),
          startTime: "10:00",
          endTime: "13:00",
          status: "AVAILABLE",
          theatreId: "theatre_3",
          theatre: {
            name: "Theatre 3",
            locationId: "loc_pitampura",
            location: { name: "Pitampura" },
          },
        },
        {
          id: "slot_2",
          date: new Date("2026-02-26T08:00:00.000Z"),
          startTime: "13:30",
          endTime: "16:30",
          status: "BOOKED",
          theatreId: "theatre_3",
          theatre: {
            name: "Theatre 3",
            locationId: "loc_pitampura",
            location: { name: "Pitampura" },
          },
        },
      ]);

    const res = await GET(
      makeRequest(
        "http://localhost/api/admin/coupons/options/slots?slotIds=slot_2&includeContext=true"
      )
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toEqual([
      {
        id: "slot_1",
        date: "2026-02-26",
        startTime: "10:00",
        endTime: "13:00",
        status: "AVAILABLE",
        theatreId: "theatre_3",
        theatreName: "Theatre 3",
        locationId: "loc_pitampura",
        locationName: "Pitampura",
      },
      {
        id: "slot_2",
        date: "2026-02-26",
        startTime: "13:30",
        endTime: "16:30",
        status: "BOOKED",
        theatreId: "theatre_3",
        theatreName: "Theatre 3",
        locationId: "loc_pitampura",
        locationName: "Pitampura",
      },
    ]);
    expect(prismaMock.slot.findMany).toHaveBeenCalledTimes(2);
  });
});
