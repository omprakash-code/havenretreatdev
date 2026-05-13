export type PendingOnlineCreateBooking = {
  bookingId: string;
  bookingRef: string;
};

type HandlePendingOnlineCreateRetryParams = {
  isEditMode: boolean;
  pendingOnlineCreateBooking: PendingOnlineCreateBooking | null;
  paymentType: "OFFLINE" | "ONLINE";
  collectOnlinePaymentForCreate: (params: { bookingId: string }) => Promise<boolean>;
  setSubmitting: (value: boolean) => void;
  clearPendingOnlineCreateBooking: () => void;
  onModeMismatch: (bookingRef: string) => void;
  onRetryPending: (bookingRef: string) => void;
  onCollectedSuccess: (bookingRef: string) => void;
  onError: () => void;
  onSettledCreated: (bookingRef: string) => void;
};

export async function handlePendingOnlineCreateRetry({
  isEditMode,
  pendingOnlineCreateBooking,
  paymentType,
  collectOnlinePaymentForCreate,
  setSubmitting,
  clearPendingOnlineCreateBooking,
  onModeMismatch,
  onRetryPending,
  onCollectedSuccess,
  onError,
  onSettledCreated,
}: HandlePendingOnlineCreateRetryParams) {
  if (isEditMode || !pendingOnlineCreateBooking) return false;

  if (paymentType !== "ONLINE") {
    onModeMismatch(pendingOnlineCreateBooking.bookingRef);
    return true;
  }

  try {
    setSubmitting(true);
    const collected = await collectOnlinePaymentForCreate({
      bookingId: pendingOnlineCreateBooking.bookingId,
    });
    if (!collected) {
      onRetryPending(pendingOnlineCreateBooking.bookingRef);
      return true;
    }

    const settledBookingRef = pendingOnlineCreateBooking.bookingRef;
    clearPendingOnlineCreateBooking();
    onCollectedSuccess(settledBookingRef);
    onSettledCreated(settledBookingRef);
  } catch {
    onError();
  } finally {
    setSubmitting(false);
  }

  return true;
}

type DiscardPendingOnlineCreateParams = {
  pendingOnlineCreateBooking: PendingOnlineCreateBooking | null;
  confirmDiscard: (bookingRef: string) => boolean;
  deletePendingBooking: (bookingId: string) => Promise<boolean>;
  clearPendingOnlineCreateBooking: () => void;
  onDiscardSuccess: (bookingRef: string) => void;
  onDiscardFailure: () => void;
};

export async function discardPendingOnlineCreateBooking({
  pendingOnlineCreateBooking,
  confirmDiscard,
  deletePendingBooking,
  clearPendingOnlineCreateBooking,
  onDiscardSuccess,
  onDiscardFailure,
}: DiscardPendingOnlineCreateParams) {
  if (!pendingOnlineCreateBooking) return false;
  const { bookingId, bookingRef } = pendingOnlineCreateBooking;

  if (!confirmDiscard(bookingRef)) {
    return false;
  }

  const deleted = await deletePendingBooking(bookingId);
  if (!deleted) {
    onDiscardFailure();
    return false;
  }

  clearPendingOnlineCreateBooking();
  onDiscardSuccess(bookingRef);
  return true;
}
