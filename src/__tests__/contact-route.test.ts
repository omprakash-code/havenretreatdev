import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    contactInquiry: {
      create: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/db";
import { POST } from "@/app/api/contact/submit/route";

describe("POST /api/contact/submit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 for invalid mobile number", async () => {
    const req = new Request("http://localhost/api/contact/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "John",
        mobile: "1234",
        message: "Please call me",
      }),
    });

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.success).toBe(false);
    expect(json.code).toBe("INVALID_REQUEST");
    expect(prisma.contactInquiry.create).not.toHaveBeenCalled();
  });

  it("creates inquiry and returns success", async () => {
    (
      prisma.contactInquiry.create as unknown as ReturnType<typeof vi.fn>
    ).mockResolvedValue({
      id: "contact-1",
    });

    const req = new Request("http://localhost/api/contact/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "John Doe",
        mobile: "+91 99999 99999",
        message: "Need details for private booking.",
      }),
    });

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data).toBeUndefined();
    expect(prisma.contactInquiry.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: "John Doe",
          mobile: "9999999999",
          message: "Need details for private booking.",
          status: "NEW",
          isRead: false,
        }),
      })
    );
  });
});
