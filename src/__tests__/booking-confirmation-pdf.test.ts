import { describe, expect, it } from "vitest";
import { buildBookingConfirmationPdfAttachment } from "@/lib/pdf/booking-confirmation";

describe("buildBookingConfirmationPdfAttachment", () => {
  it("returns a valid PDF attachment payload", async () => {
    const attachment = await buildBookingConfirmationPdfAttachment("DS-BOOK-123", {
      bookingRef: "DS-BOOK-123",
      customerName: "Test User",
      customerPhone: "9999999999",
      customerEmail: "test@example.com",
      theatreName: "Gold Screen",
      locationName: "Pitampura",
      date: "Mon, 02 Mar 2026",
      timeSlot: "10:00 - 12:00",
      guestCount: 2,
      occasionLabel: "Birthday",
      occasionDetails: [{ label: "Celebrant", value: "Aarav" }],
      addonItems: [
        {
          name: "Rose Bouquet",
          variantLabel: "Premium",
          quantity: 1,
          totalPrice: 999,
        },
      ],
      paymentType: "OFFLINE",
      paymentMethod: "CASH",
      paymentStatus: "PAID",
      paymentReference: "OFF-123",
      baseAmount: 2000,
      extrasAmount: 999,
      productsAmount: 0,
      decorationAmount: 0,
      discountAmount: 100,
      totalAmount: 2899,
      advancePaid: 1000,
      remainingPayable: 1899,
      successUrl: "https://example.com/booking/success?t=token",
    });

    expect(attachment.filename).toBe("ds-book-123.pdf");
    expect(attachment.contentType).toBe("application/pdf");
    expect(attachment.content.length).toBeGreaterThan(0);

    const decoded = Buffer.from(attachment.content, "base64");
    expect(decoded.byteLength).toBeGreaterThan(1500);
    expect(decoded.subarray(0, 4).toString()).toBe("%PDF");
  });
});
