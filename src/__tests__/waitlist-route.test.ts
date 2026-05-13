import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    waitlistEntry: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/db";
import { POST } from "@/app/api/waitlist/route";

describe("POST /api/waitlist", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 for invalid phone", async () => {
    const req = new Request("http://localhost/api/waitlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "John",
        phone: "123",
        locationPreference: "Pitampura, Delhi",
        peopleCount: 2,
      }),
    });

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.success).toBe(false);
    expect(json.message).toContain("10-digit phone");
    expect(prisma.waitlistEntry.findFirst).not.toHaveBeenCalled();
  });

  it("returns 409 for duplicate recent request", async () => {
    (
      prisma.waitlistEntry.findFirst as unknown as ReturnType<typeof vi.fn>
    ).mockResolvedValue({
      id: "wait-1",
      reference: "DS-20260218-0001",
      createdAt: new Date("2026-02-18T00:00:00.000Z"),
    });

    const req = new Request("http://localhost/api/waitlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "John",
        phone: "9999999999",
        locationPreference: "Pitampura, Delhi",
        peopleCount: 2,
      }),
    });

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(409);
    expect(json.success).toBe(false);
    expect(json.code).toBe("DUPLICATE_WAITLIST");
    expect(prisma.waitlistEntry.create).not.toHaveBeenCalled();
  });

  it("creates waitlist entry and returns reference", async () => {
    (
      prisma.waitlistEntry.findFirst as unknown as ReturnType<typeof vi.fn>
    ).mockResolvedValue(null);
    (
      prisma.waitlistEntry.create as unknown as ReturnType<typeof vi.fn>
    ).mockResolvedValue({
      id: "wait-2",
      reference: "DS-20260218-0002",
      status: "NEW",
      createdAt: new Date("2026-02-18T10:00:00.000Z"),
    });

    const req = new Request("http://localhost/api/waitlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "John Doe",
        phone: "+91 99999 99999",
        email: "john@example.com",
        city: "Delhi",
        locationPreference: "Pitampura, Delhi",
        preferredDate: "2026-02-20",
        preferredTime: "19:00",
        peopleCount: 4,
        notes: "Need birthday setup",
      }),
    });

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json.success).toBe(true);
    expect(json.data.reference).toBe("DS-20260218-0002");
    expect(prisma.waitlistEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: "John Doe",
          phone: "9999999999",
          locationPreference: "Pitampura, Delhi",
          peopleCount: 4,
        }),
      })
    );
  });
});
