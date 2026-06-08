import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  authMock,
  getSettingsMock,
  updateSettingsMock,
  listBlocksMock,
  createBlockMock,
  updateBlockMock,
  deactivateBlockMock,
} = vi.hoisted(() => ({
  authMock: vi.fn(),
  getSettingsMock: vi.fn(),
  updateSettingsMock: vi.fn(),
  listBlocksMock: vi.fn(),
  createBlockMock: vi.fn(),
  updateBlockMock: vi.fn(),
  deactivateBlockMock: vi.fn(),
}));

vi.mock("@/services/auth/adminAuth.server", () => ({
  getAuthenticatedAdminIdFromCookies: authMock,
}));

vi.mock("@/services/booking/booking-settings.service", async () => {
  const actual = await vi.importActual<
    typeof import("@/services/booking/booking-settings.service")
  >("@/services/booking/booking-settings.service");
  return {
    ...actual,
    getOrCreateBookingSettings: getSettingsMock,
    updateBookingSettings: updateSettingsMock,
  };
});

vi.mock("@/services/availability/availability-block.service", async () => {
  const actual = await vi.importActual<
    typeof import("@/services/availability/availability-block.service")
  >("@/services/availability/availability-block.service");
  return {
    ...actual,
    listAvailabilityBlocks: listBlocksMock,
    createAvailabilityBlock: createBlockMock,
    updateAvailabilityBlock: updateBlockMock,
    deactivateAvailabilityBlock: deactivateBlockMock,
  };
});

import {
  GET as getSettings,
  PATCH as patchSettings,
} from "@/app/api/admin/booking-settings/route";
import {
  GET as getBlocks,
  POST as postBlock,
} from "@/app/api/admin/availability-blocks/route";
import {
  PATCH as patchBlock,
  DELETE as deleteBlock,
} from "@/app/api/admin/availability-blocks/[id]/route";

describe("Phase 2A admin routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue("admin-1");
  });

  it("requires authentication for booking settings", async () => {
    authMock.mockResolvedValueOnce(null);

    const res = await getSettings(
      new Request("http://localhost/api/admin/booking-settings?theatreId=t1")
    );

    expect(res.status).toBe(401);
  });

  it("loads booking settings for a theatre", async () => {
    getSettingsMock.mockResolvedValue({ id: "settings-1", theatreId: "t1" });

    const res = await getSettings(
      new Request("http://localhost/api/admin/booking-settings?theatreId=t1")
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.theatreId).toBe("t1");
    expect(getSettingsMock).toHaveBeenCalledWith("t1");
  });

  it("updates validated booking settings", async () => {
    updateSettingsMock.mockResolvedValue({ id: "settings-1", maximumGuests: 60 });
    const res = await patchSettings(
      new Request("http://localhost/api/admin/booking-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          theatreId: "t1",
          businessOpenTime: "09:00",
          businessCloseTime: "23:00",
          minimumDurationMinutes: 240,
          bufferMinutes: 60,
          lockDurationMinutes: 10,
          maximumGuests: 60,
        }),
      })
    );

    expect(res.status).toBe(200);
    expect(updateSettingsMock).toHaveBeenCalledWith(
      "t1",
      expect.objectContaining({ maximumGuests: 60 })
    );
  });

  it("lists and creates availability blocks", async () => {
    listBlocksMock.mockResolvedValue([]);
    createBlockMock.mockResolvedValue({ id: "block-1" });

    const listRes = await getBlocks(
      new Request(
        "http://localhost/api/admin/availability-blocks?theatreId=t1&from=2026-07-01&to=2026-07-31"
      )
    );
    expect(listRes.status).toBe(200);

    const createRes = await postBlock(
      new Request("http://localhost/api/admin/availability-blocks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          theatreId: "t1",
          eventDate: "2026-07-04",
          isFullDay: true,
          internalNote: "Holiday",
        }),
      })
    );
    expect(createRes.status).toBe(201);
    expect(createBlockMock).toHaveBeenCalledWith(
      expect.objectContaining({ isFullDay: true }),
      "admin-1"
    );
  });

  it("soft-deactivates a block", async () => {
    deactivateBlockMock.mockResolvedValue(undefined);

    const res = await deleteBlock(
      new Request("http://localhost/api/admin/availability-blocks/block-1", {
        method: "DELETE",
      }),
      { params: Promise.resolve({ id: "block-1" }) }
    );

    expect(res.status).toBe(200);
    expect(deactivateBlockMock).toHaveBeenCalledWith("block-1");
  });

  it("updates an availability block", async () => {
    updateBlockMock.mockResolvedValue({ id: "block-1", startTime: "12:00" });

    const res = await patchBlock(
      new Request("http://localhost/api/admin/availability-blocks/block-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          theatreId: "t1",
          eventDate: "2026-07-04",
          isFullDay: false,
          startTime: "12:00",
          endTime: "14:00",
          internalNote: "Private maintenance",
        }),
      }),
      { params: Promise.resolve({ id: "block-1" }) }
    );

    expect(res.status).toBe(200);
    expect(updateBlockMock).toHaveBeenCalledWith(
      "block-1",
      expect.objectContaining({
        startTime: "12:00",
        endTime: "14:00",
      })
    );
  });
});
