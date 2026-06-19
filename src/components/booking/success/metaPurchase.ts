import { buildMetaPurchaseEventId } from "@/lib/meta/shared";
import type { BookingSuccessData } from "./types";

type StorageLike = Pick<Storage, "getItem" | "setItem">;
type TrackableBookingSuccessData = Pick<
  BookingSuccessData,
  "bookingRef" | "paymentStatus" | "payment" | "totalAmount" | "advancePaid"
>;

export function shouldTrackBookingSuccessPurchase(
  data: TrackableBookingSuccessData | null | undefined
) {
  if (!data) return false;

  return (
    data.paymentStatus === "PAID" &&
    data.payment?.provider?.toLowerCase() === "square"
  );
}

export function buildBookingSuccessPurchaseEvent(
  data: TrackableBookingSuccessData,
  token: string
) {
  return {
    eventId: buildMetaPurchaseEventId({
      bookingRef: data.bookingRef,
      paymentReference: data.payment?.transactionId,
    }),
    storageKey: `meta:purchase:${data.bookingRef}:${token}`,
    params: {
      currency: "USD",
      value: data.totalAmount,
      advance_paid_value: data.advancePaid,
      total_booking_value: data.totalAmount,
      order_id: data.bookingRef,
      content_name: "Haven Retreat Booking",
      content_category: "event_venue",
      payment_method:
        data.payment?.method ?? data.payment?.provider ?? "square",
    },
  };
}

export function hasTrackedBookingSuccessPurchase(
  storage: StorageLike,
  key: string
) {
  try {
    return storage.getItem(key) === "1";
  } catch {
    return false;
  }
}

export function markBookingSuccessPurchaseTracked(
  storage: StorageLike,
  key: string
) {
  try {
    storage.setItem(key, "1");
  } catch {
    // Ignore storage failures so tracking does not break the page.
  }
}
