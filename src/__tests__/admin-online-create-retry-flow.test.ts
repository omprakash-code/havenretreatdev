import { describe, expect, it, vi } from "vitest";

import {
  discardPendingOnlineCreateBooking,
  handlePendingOnlineCreateRetry,
  type PendingOnlineCreateBooking,
} from "@/components/admin/bookings/add/admin-online-create-retry";

describe("admin online create retry flow", () => {
  it("returns false when there is no pending online booking", async () => {
    const handled = await handlePendingOnlineCreateRetry({
      isEditMode: false,
      pendingOnlineCreateBooking: null,
      paymentType: "ONLINE",
      collectOnlinePaymentForCreate: vi.fn(),
      setSubmitting: vi.fn(),
      clearPendingOnlineCreateBooking: vi.fn(),
      onModeMismatch: vi.fn(),
      onRetryPending: vi.fn(),
      onCollectedSuccess: vi.fn(),
      onError: vi.fn(),
      onSettledCreated: vi.fn(),
    });

    expect(handled).toBe(false);
  });

  it("blocks mode change while pending online payment exists", async () => {
    const onModeMismatch = vi.fn();
    const pending: PendingOnlineCreateBooking = {
      bookingId: "booking-1",
      bookingRef: "DS-BOOK-1",
    };

    const handled = await handlePendingOnlineCreateRetry({
      isEditMode: false,
      pendingOnlineCreateBooking: pending,
      paymentType: "OFFLINE",
      collectOnlinePaymentForCreate: vi.fn(),
      setSubmitting: vi.fn(),
      clearPendingOnlineCreateBooking: vi.fn(),
      onModeMismatch,
      onRetryPending: vi.fn(),
      onCollectedSuccess: vi.fn(),
      onError: vi.fn(),
      onSettledCreated: vi.fn(),
    });

    expect(handled).toBe(true);
    expect(onModeMismatch).toHaveBeenCalledWith("DS-BOOK-1");
  });

  it("retries payment on same pending booking and prevents duplicate create submissions", async () => {
    let pending: PendingOnlineCreateBooking | null = {
      bookingId: "booking-1",
      bookingRef: "DS-BOOK-1",
    };
    const createMutation = vi.fn();
    const setSubmitting = vi.fn();
    const onModeMismatch = vi.fn();
    const onRetryPending = vi.fn();
    const onCollectedSuccess = vi.fn();
    const onError = vi.fn();
    const onSettledCreated = vi.fn();

    const collectOnlinePaymentForCreate = vi
      .fn<({ bookingId }: { bookingId: string }) => Promise<boolean>>()
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);

    async function submitOnce() {
      const handled = await handlePendingOnlineCreateRetry({
        isEditMode: false,
        pendingOnlineCreateBooking: pending,
        paymentType: "ONLINE",
        collectOnlinePaymentForCreate,
        setSubmitting,
        clearPendingOnlineCreateBooking: () => {
          pending = null;
        },
        onModeMismatch,
        onRetryPending,
        onCollectedSuccess,
        onError,
        onSettledCreated,
      });

      // Real form calls create mutation only when pending-retry branch does not handle submit.
      if (!handled) {
        createMutation();
      }
    }

    await submitOnce();
    await submitOnce();

    expect(createMutation).not.toHaveBeenCalled();
    expect(collectOnlinePaymentForCreate).toHaveBeenCalledTimes(2);
    expect(collectOnlinePaymentForCreate).toHaveBeenNthCalledWith(1, {
      bookingId: "booking-1",
    });
    expect(collectOnlinePaymentForCreate).toHaveBeenNthCalledWith(2, {
      bookingId: "booking-1",
    });
    expect(onRetryPending).toHaveBeenCalledTimes(1);
    expect(onCollectedSuccess).toHaveBeenCalledTimes(1);
    expect(onCollectedSuccess).toHaveBeenCalledWith("DS-BOOK-1");
    expect(onSettledCreated).toHaveBeenCalledTimes(1);
    expect(onSettledCreated).toHaveBeenCalledWith("DS-BOOK-1");
    expect(onModeMismatch).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
    expect(pending).toBeNull();
    expect(setSubmitting).toHaveBeenCalledWith(true);
    expect(setSubmitting).toHaveBeenLastCalledWith(false);
  });

  it("does not discard when user rejects confirmation", async () => {
    const pending: PendingOnlineCreateBooking = {
      bookingId: "booking-1",
      bookingRef: "DS-BOOK-1",
    };
    const deletePendingBooking = vi.fn();
    const clearPendingOnlineCreateBooking = vi.fn();
    const onDiscardSuccess = vi.fn();
    const onDiscardFailure = vi.fn();

    const discarded = await discardPendingOnlineCreateBooking({
      pendingOnlineCreateBooking: pending,
      confirmDiscard: vi.fn().mockReturnValue(false),
      deletePendingBooking,
      clearPendingOnlineCreateBooking,
      onDiscardSuccess,
      onDiscardFailure,
    });

    expect(discarded).toBe(false);
    expect(deletePendingBooking).not.toHaveBeenCalled();
    expect(clearPendingOnlineCreateBooking).not.toHaveBeenCalled();
    expect(onDiscardSuccess).not.toHaveBeenCalled();
    expect(onDiscardFailure).not.toHaveBeenCalled();
  });

  it("discards pending booking and clears state when delete succeeds", async () => {
    const pending: PendingOnlineCreateBooking = {
      bookingId: "booking-1",
      bookingRef: "DS-BOOK-1",
    };
    const deletePendingBooking = vi.fn().mockResolvedValue(true);
    const clearPendingOnlineCreateBooking = vi.fn();
    const onDiscardSuccess = vi.fn();
    const onDiscardFailure = vi.fn();

    const discarded = await discardPendingOnlineCreateBooking({
      pendingOnlineCreateBooking: pending,
      confirmDiscard: vi.fn().mockReturnValue(true),
      deletePendingBooking,
      clearPendingOnlineCreateBooking,
      onDiscardSuccess,
      onDiscardFailure,
    });

    expect(discarded).toBe(true);
    expect(deletePendingBooking).toHaveBeenCalledWith("booking-1");
    expect(clearPendingOnlineCreateBooking).toHaveBeenCalledTimes(1);
    expect(onDiscardSuccess).toHaveBeenCalledWith("DS-BOOK-1");
    expect(onDiscardFailure).not.toHaveBeenCalled();
  });

  it("keeps pending booking when delete fails", async () => {
    const pending: PendingOnlineCreateBooking = {
      bookingId: "booking-1",
      bookingRef: "DS-BOOK-1",
    };
    const deletePendingBooking = vi.fn().mockResolvedValue(false);
    const clearPendingOnlineCreateBooking = vi.fn();
    const onDiscardSuccess = vi.fn();
    const onDiscardFailure = vi.fn();

    const discarded = await discardPendingOnlineCreateBooking({
      pendingOnlineCreateBooking: pending,
      confirmDiscard: vi.fn().mockReturnValue(true),
      deletePendingBooking,
      clearPendingOnlineCreateBooking,
      onDiscardSuccess,
      onDiscardFailure,
    });

    expect(discarded).toBe(false);
    expect(deletePendingBooking).toHaveBeenCalledWith("booking-1");
    expect(clearPendingOnlineCreateBooking).not.toHaveBeenCalled();
    expect(onDiscardSuccess).not.toHaveBeenCalled();
    expect(onDiscardFailure).toHaveBeenCalledTimes(1);
  });
});
