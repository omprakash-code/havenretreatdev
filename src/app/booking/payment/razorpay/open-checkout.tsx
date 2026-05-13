"use client";

import { toast } from "sonner";
import { openRazorpayModal } from "@/lib/razorpay/checkout-client";
import { trackMetaStandardEvent } from "@/lib/meta/browser";

/* -----------------------------
   Public API
------------------------------ */
type OpenRazorpayProps = {
  orderId: string;
  amountInPaise: number;
  bookingId: string;
  contact?: {
    name?: string;
    email?: string;
    phone?: string;
  };
  onPaymentCancel?: () => void;
  onOpenFailed?: () => void;
  onOpen?: () => void;
  onVerificationError?: (errorJson?: {
    success?: boolean;
    code?: string;
    message?: string;
    title?: string;
    paymentCaptured?: boolean;
    cancelledReason?: string;
    bookingRef?: string;
    successToken?: string;
    bookingStatus?: string;
    slotStatus?: string;
    orderId?: string;
    amount?: number;
    advancePayable?: number;
    totalAmount?: number;
    remainingPayable?: number;
  } | null) => void;
};

export function openRazorpayCheckout({
  orderId,
  amountInPaise,
  bookingId,
  contact,
  onPaymentCancel,
  onOpenFailed,
  onOpen,
  onVerificationError,
}: OpenRazorpayProps) {
  const wait = (ms: number) =>
    new Promise((resolve) => setTimeout(resolve, ms));
  const runDuplicateRedirectCountdown = async (hasSuccessToken: boolean) => {
    const prefix = hasSuccessToken
      ? "This booking has already been confirmed."
      : "This payment has already been processed.";
    const destination = hasSuccessToken
      ? "order success page"
      : "booking page";

    for (let seconds = 5; seconds >= 1; seconds -= 1) {
      toast.error(
        `${prefix} Redirecting to the ${destination} in ${seconds}s.`,
        { id: "verify", duration: 1100 }
      );
      await wait(1000);
    }
  };

  let handled = false;

  return openRazorpayModal({
    orderId,
    amountInPaise,
    name: "Haven Retreat",
    description: "Private Venue Booking",
    prefill: {
      name: contact?.name,
      email: contact?.email,
      contact: contact?.phone,
    },
    onSuccess: async (response) => {
      if (handled) return;
      handled = true;

      toast.loading("Verifying payment…", { id: "verify" });

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);

        const res = await fetch("/api/payments/razorpay/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            bookingId,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_order_id: response.razorpay_order_id,
            razorpay_signature: response.razorpay_signature,
          }),
        });

        clearTimeout(timeout);
        const json = await res.json().catch(() => null);

        if (!res.ok || !json?.success) {
          const code = json?.code as string | undefined;

          if (code === "DUPLICATE_PAYMENT_ATTEMPT") {
            onVerificationError?.(json);
            const hasSuccessToken = Boolean(json?.successToken);
            await runDuplicateRedirectCountdown(hasSuccessToken);
            if (json?.successToken) {
              window.location.href = `/booking/success?t=${encodeURIComponent(json.successToken)}`;
            } else {
              window.location.href = "/booking";
            }
            return;
          }

          if (code === "SLOT_ALREADY_BOOKED") {
            onVerificationError?.(json);
            if (json?.paymentCaptured) {
              toast.dismiss("verify");
              return;
            }
            toast.error(
              json?.message ||
                "This slot is already booked. Please choose another slot.",
              { id: "verify" }
            );
            window.location.href = "/booking";
            return;
          }

          if (code === "SLOT_EXPIRED") {
            onVerificationError?.(json);
            toast.error(
              json?.message ||
                "This slot is no longer available. Please rebook.",
              { id: "verify" }
            );
            window.location.href = "/booking";
            return;
          }

          if (code === "SESSION_EXPIRED") {
            toast.dismiss("verify");
            onVerificationError?.(json);
            return;
          }

          if (code === "UNAUTHORIZED") {
            onVerificationError?.(json);
            toast.error(
              json?.message || "This payment attempt is not authorized.",
              { id: "verify" }
            );
            window.location.href = "/booking";
            return;
          }

          if (code === "BOOKING_FINALIZED" && json?.successToken) {
            onVerificationError?.(json);
            toast.success("Booking is already confirmed.", {
              id: "verify",
            });
            window.location.href = `/booking/success?t=${encodeURIComponent(json.successToken)}`;
            return;
          }

          onVerificationError?.(json);
          toast.error(
            json?.message || "Payment verification failed",
            { id: "verify" }
          );
          return;
        }

        if (!json?.successToken) {
          onVerificationError?.(json);
          toast.error(
            "Payment received, but booking confirmation failed. Please contact support.",
            { id: "verify" }
          );
          return;
        }

        toast.success("Booking confirmed 🎉", {
          id: "verify",
        });

        // REDIRECT USER
        window.location.href = `/booking/success?t=${encodeURIComponent(json.successToken)}`;
      } catch (err) {
        onVerificationError?.(
          err instanceof Error
            ? { message: err.message }
            : null
        );
        toast.error(
          err instanceof Error
            ? err.message
            : "Payment verification failed",
          { id: "verify" }
        );
      }
    },
    onDismiss: () => {
      if (handled) return;
      void fetch("/api/payments/razorpay/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingId,
          source: "checkout_modal",
          reason: "dismissed_by_user",
        }),
        keepalive: true,
      }).catch(() => null);
      onPaymentCancel?.();
    },
    onOpenFailed,
    themeColor: "#1b1b1bff",
    onOpen: () => {
      trackMetaStandardEvent("InitiateCheckout", {
        currency: "INR",
        value: Number((amountInPaise / 100).toFixed(2)),
        content_name: "Private Theatre Booking",
        content_type: "service",
        booking_id: bookingId,
      });
      onOpen?.();
    },
  });
}
