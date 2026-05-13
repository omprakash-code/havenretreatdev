import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

vi.mock("@/services/auth/adminSession.server", () => ({
  verifyAdminSessionToken: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
    appSetting: {
      findMany: vi.fn(),
      upsert: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { verifyAdminSessionToken } from "@/services/auth/adminSession.server";
import { GET, PATCH } from "@/app/api/admin/settings/route";

function createCookieStore(token?: string) {
  return {
    get: vi.fn((key: string) => {
      if (key === "ds_admin_session" && token) {
        return { value: token };
      }
      return undefined;
    }),
  };
}

describe("/api/admin/settings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 for unauthenticated request", async () => {
    (cookies as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      createCookieStore()
    );

    const res = await GET();
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json).toMatchObject({
      success: false,
      message: "Unauthorized",
    });
  });

  it("returns defaults when settings table is empty", async () => {
    (cookies as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      createCookieStore("admin-token")
    );
    (
      verifyAdminSessionToken as unknown as ReturnType<typeof vi.fn>
    ).mockReturnValue({
      userId: "admin-1",
      role: "ADMIN",
      sessionVersion: 2,
    });
    (
      prisma.user.findUnique as unknown as ReturnType<typeof vi.fn>
    ).mockResolvedValue({
      id: "admin-1",
      role: "ADMIN",
      isActive: true,
      lockUntil: null,
      sessionVersion: 2,
    });
    (
      prisma.appSetting.findMany as unknown as ReturnType<typeof vi.fn>
    ).mockResolvedValue([]);

    const res = await GET();
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data).toEqual([
      { key: "SPECIAL_SLOT_TEXT", value: "Special Price" },
      { key: "ADVANCE_PAYMENT_AMOUNT", value: "750" },
      { key: "BOOKING_LOCK_MINUTES", value: "10" },
      { key: "SLOT_EXPIRY_MODE", value: "START_TIME" },
      { key: "SLOT_EXPIRY_GRACE_MINUTES", value: "30" },
    ]);
  });

  it("rejects invalid advance amount updates", async () => {
    (cookies as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      createCookieStore("admin-token")
    );
    (
      verifyAdminSessionToken as unknown as ReturnType<typeof vi.fn>
    ).mockReturnValue({
      userId: "admin-1",
      role: "ADMIN",
      sessionVersion: 2,
    });
    (
      prisma.user.findUnique as unknown as ReturnType<typeof vi.fn>
    ).mockResolvedValue({
      id: "admin-1",
      role: "ADMIN",
      isActive: true,
      lockUntil: null,
      sessionVersion: 2,
    });
    (
      prisma.appSetting.findMany as unknown as ReturnType<typeof vi.fn>
    ).mockResolvedValue([{ key: "ADVANCE_PAYMENT_AMOUNT" }]);

    const req = new Request("http://localhost/api/admin/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        settings: [{ key: "ADVANCE_PAYMENT_AMOUNT", value: "abc" }],
      }),
    });

    const res = await PATCH(req);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.success).toBe(false);
    expect(json.message).toBe("Enter a valid number.");
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("rejects zero advance amount updates", async () => {
    (cookies as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      createCookieStore("admin-token")
    );
    (
      verifyAdminSessionToken as unknown as ReturnType<typeof vi.fn>
    ).mockReturnValue({
      userId: "admin-1",
      role: "ADMIN",
      sessionVersion: 2,
    });
    (
      prisma.user.findUnique as unknown as ReturnType<typeof vi.fn>
    ).mockResolvedValue({
      id: "admin-1",
      role: "ADMIN",
      isActive: true,
      lockUntil: null,
      sessionVersion: 2,
    });
    (
      prisma.appSetting.findMany as unknown as ReturnType<typeof vi.fn>
    ).mockResolvedValue([{ key: "ADVANCE_PAYMENT_AMOUNT" }]);

    const req = new Request("http://localhost/api/admin/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        settings: [{ key: "ADVANCE_PAYMENT_AMOUNT", value: "0" }],
      }),
    });

    const res = await PATCH(req);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.success).toBe(false);
    expect(json.message).toBe("Amount must be at least 1.");
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("accepts low positive advance amount updates", async () => {
    (cookies as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      createCookieStore("admin-token")
    );
    (
      verifyAdminSessionToken as unknown as ReturnType<typeof vi.fn>
    ).mockReturnValue({
      userId: "admin-1",
      role: "ADMIN",
      sessionVersion: 2,
    });
    (
      prisma.user.findUnique as unknown as ReturnType<typeof vi.fn>
    ).mockResolvedValue({
      id: "admin-1",
      role: "ADMIN",
      isActive: true,
      lockUntil: null,
      sessionVersion: 2,
    });
    (
      prisma.appSetting.findMany as unknown as ReturnType<typeof vi.fn>
    )
      .mockResolvedValueOnce([{ key: "ADVANCE_PAYMENT_AMOUNT" }])
      .mockResolvedValueOnce([{ key: "ADVANCE_PAYMENT_AMOUNT", value: "1" }]);
    (
      prisma.appSetting.upsert as unknown as ReturnType<typeof vi.fn>
    ).mockResolvedValue({});
    (prisma.$transaction as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      []
    );

    const req = new Request("http://localhost/api/admin/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        settings: [{ key: "ADVANCE_PAYMENT_AMOUNT", value: "1" }],
      }),
    });

    const res = await PATCH(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data).toEqual([
      { key: "SPECIAL_SLOT_TEXT", value: "Special Price" },
      { key: "ADVANCE_PAYMENT_AMOUNT", value: "1" },
      { key: "BOOKING_LOCK_MINUTES", value: "10" },
      { key: "SLOT_EXPIRY_MODE", value: "START_TIME" },
      { key: "SLOT_EXPIRY_GRACE_MINUTES", value: "30" },
    ]);
    expect(prisma.appSetting.upsert).toHaveBeenCalledWith({
      where: { key: "ADVANCE_PAYMENT_AMOUNT" },
      update: { value: "1" },
      create: {
        key: "ADVANCE_PAYMENT_AMOUNT",
        value: "1",
      },
    });
  });

  it("updates known settings and returns merged response", async () => {
    (cookies as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      createCookieStore("admin-token")
    );
    (
      verifyAdminSessionToken as unknown as ReturnType<typeof vi.fn>
    ).mockReturnValue({
      userId: "admin-1",
      role: "ADMIN",
      sessionVersion: 2,
    });
    (
      prisma.user.findUnique as unknown as ReturnType<typeof vi.fn>
    ).mockResolvedValue({
      id: "admin-1",
      role: "ADMIN",
      isActive: true,
      lockUntil: null,
      sessionVersion: 2,
    });
    (
      prisma.appSetting.findMany as unknown as ReturnType<typeof vi.fn>
    )
      .mockResolvedValueOnce([
        { key: "SPECIAL_SLOT_TEXT" },
        { key: "ADVANCE_PAYMENT_AMOUNT" },
      ])
      .mockResolvedValueOnce([
        { key: "ADVANCE_PAYMENT_AMOUNT", value: "1200" },
      ]);
    (
      prisma.appSetting.upsert as unknown as ReturnType<typeof vi.fn>
    ).mockResolvedValue({});
    (prisma.$transaction as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      []
    );

    const req = new Request("http://localhost/api/admin/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        settings: [{ key: "ADVANCE_PAYMENT_AMOUNT", value: "1200" }],
      }),
    });

    const res = await PATCH(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data).toEqual([
      { key: "SPECIAL_SLOT_TEXT", value: "Special Price" },
      { key: "ADVANCE_PAYMENT_AMOUNT", value: "1200" },
      { key: "BOOKING_LOCK_MINUTES", value: "10" },
      { key: "SLOT_EXPIRY_MODE", value: "START_TIME" },
      { key: "SLOT_EXPIRY_GRACE_MINUTES", value: "30" },
    ]);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.appSetting.upsert).toHaveBeenCalledWith({
      where: { key: "ADVANCE_PAYMENT_AMOUNT" },
      update: { value: "1200" },
      create: {
        key: "ADVANCE_PAYMENT_AMOUNT",
        value: "1200",
      },
    });
  });
});
