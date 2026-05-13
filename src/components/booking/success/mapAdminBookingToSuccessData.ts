import type { BookingSuccessData } from "@/components/booking/success/types";
import { buildOccasionDetails } from "@/lib/booking-celebration";
import { formatISTDate, formatSlotTime } from "@/lib/formatters";
import { getNumberDecorationLabel } from "@/lib/product-numbering";
import type { AdminBooking } from "@/types/admin/booking-admin";

export type AdminBookingPdfSource = AdminBooking & {
  locationName: string;
  theatreImage?: string | null;
  decorationRequired?: boolean;
};

export function mapAdminBookingToSuccessData(
  booking: AdminBookingPdfSource
): BookingSuccessData {
  const date = formatISTDate(booking.slot.date);
  const timeSlot = formatSlotTime(booking.slot.startTime, booking.slot.endTime);

  return {
    bookingRef: booking.bookingRef,
    bookingStatus: booking.bookingStatus,
    paymentStatus: booking.paymentStatus,
    createdByRole: booking.createdByRole,
    payment: booking.paymentDetails
      ? {
          provider: booking.paymentDetails.provider,
          method: booking.paymentDetails.method,
          transactionId: booking.paymentDetails.transactionId,
          status: booking.paymentDetails.status,
          amount: booking.paymentDetails.amount,
          createdAt: booking.paymentDetails.createdAt,
        }
      : null,
    contact: {
      name: booking.customer?.name ?? "Guest",
      phone: booking.customer?.phone ?? "",
      email: booking.customer?.email ?? undefined,
    },
    theatreName: booking.theatre.name,
    theatreImage: booking.theatreImage ?? null,
    date,
    timeSlot,
    locationName: booking.locationName,
    dateTime: `${date}, ${timeSlot}`,
    occasionLabel: booking.occasionLabel ?? undefined,
    occasionDetails: buildOccasionDetails(booking.occasionData),
    guestCount: booking.guestCount,
    decorationRequired: booking.decorationRequired,
    totalAmount: booking.pricing.total,
    advancePaid: booking.pricing.advancePaid,
    remainingPayable: booking.pricing.remainingPayable,
    discountAmount: booking.pricing.discount,
    items: booking.items.map((item) => ({
      id: item.id,
      productName: item.productName,
      variantLabel: item.variantLabel,
      category: item.category,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      totalPrice: item.totalPrice,
      image: item.image ?? item.productImage ?? null,
      numberLabel: item.ledNumber
        ? getNumberDecorationLabel({
            slug: undefined,
            name: item.productName,
          })
        : null,
      numberValue: item.ledNumber ?? null,
    })),
  };
}
