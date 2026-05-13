"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useBooking } from "@/context/BookingContext";
import { toast } from "sonner";
import { openRazorpayCheckout } from "./razorpay/open-checkout";
import { ensureRazorpayCheckoutLoaded } from "@/lib/razorpay/checkout-client";
import { ShieldCheck } from "@/components/icons";
import { BOOKING_ROUTES } from "@/constants/routes";
import { handleBookingError } from "@/utils/handleBookingError";
import {
  clearPaymentPageBlockedNotice,
  getPaymentPageBlockedNotice,
  persistPaymentPageBlockedNotice,
} from "@/lib/booking-session-expiry";
import {
  PAYMENT_CAPTURED_FAILURE_MODAL_MESSAGE,
  PAYMENT_CAPTURED_FAILURE_MODAL_TITLE,
} from "@/lib/payment-capture-failure";

type ApiErrorResponse = {
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
};

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function RazorpayPaymentPage() {
  const router = useRouter();
  const pathname = usePathname();
  const { booking, hydrated, resetBooking } = useBooking();

  const pricing = booking.pricing;
  const bookingId = booking.bookingId;

  const [razorReady, setRazorReady] = useState(
    () =>
      typeof window !== "undefined" && Boolean(window.Razorpay)
  );
  const [retryVisible, setRetryVisible] = useState(false);
  const hasOpenedRef = useRef(false);
  const [processing, setProcessing] = useState(true);
  const [payableAmount, setPayableAmount] = useState<number | null>(null);
  const [paymentLabel, setPaymentLabel] = useState<"Advance" | "Full Payment">("Advance");
  const [blockedPaymentNotice, setBlockedPaymentNotice] = useState<{
    title: string;
    message: string;
  } | null>(null);
  const displayPayableAmount = payableAmount ?? pricing?.advancePay ?? 0;
  const isCheckoutOpenRef = useRef(false);
  const paymentAttemptKey = `${bookingId ?? ""}:${pricing?.total ?? 0}:${pricing?.discount ?? 0}:${booking.bookingItems.length}:${booking.guestCount}:${booking.decorationRequired}:${booking.occasion?.key ?? ""}`;
  const dismissPayToast = useCallback(() => {
    toast.dismiss("pay");
  }, []);
  const dismissVerifyToast = useCallback(() => {
    toast.dismiss("verify");
  }, []);

  const resetToRetryState = useCallback(() => {
    dismissPayToast();
    dismissVerifyToast();
    isCheckoutOpenRef.current = false;
    setProcessing(false);
    setRetryVisible(true);
    setBlockedPaymentNotice(null);
    hasOpenedRef.current = false;
  }, [dismissPayToast, dismissVerifyToast]);

  useEffect(() => {
    let cancelled = false;

    void ensureRazorpayCheckoutLoaded().then((loaded) => {
      if (cancelled) return;
      setRazorReady(loaded);
      if (!loaded) {
        resetToRetryState();
        toast.error("Razorpay is not ready. Please try again.");
      }
    });

    return () => {
      cancelled = true;
    };
  }, [resetToRetryState]);

  /* -----------------------------
     Guard (single source)
  ------------------------------ */
  useEffect(() => {
    if (!hydrated) return;
    if (!bookingId || !pricing) {
      router.replace(BOOKING_ROUTES.ROOT);
    }
  }, [hydrated, bookingId, pricing, router]);

  /* -----------------------------
     Start Payment (SAFE)
  ------------------------------ */
  const startPayment = useCallback(async () => {
    if (!bookingId || !pricing || !hydrated) return;
    if (isCheckoutOpenRef.current) return;
    const blockedNotice = getPaymentPageBlockedNotice(bookingId);
    if (blockedNotice) {
      dismissPayToast();
      dismissVerifyToast();
      clearPaymentPageBlockedNotice();
      setBlockedPaymentNotice(null);
      setProcessing(false);
      setRetryVisible(false);
      resetBooking();
      router.replace(BOOKING_ROUTES.ROOT);
      return;
    }
    let checkoutOpened = false;

    try {
      if (
        !razorReady ||
        typeof window === "undefined" ||
        !window.Razorpay
      ) {
        toast.error("Razorpay is not ready. Please try again.");
        resetToRetryState();
        return;
      }

      setProcessing(true);
      setRetryVisible(false);

      toast.loading("Preparing secure payment…", { id: "pay" });
      const orderRes = await fetch("/api/payments/razorpay/create-order",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            bookingId,
          }),
        }
      );

      const orderJson =
        (await orderRes
          .json()
          .catch(() => null)) as ApiErrorResponse | null;

      if (!orderRes.ok || !orderJson?.success) {
        dismissPayToast();
        if (
          orderJson?.code === "PAID_EXPIRED" ||
          orderJson?.bookingStatus === "PAID_EXPIRED" ||
          (orderJson?.paymentCaptured &&
            (orderJson?.code === "SESSION_EXPIRED" ||
              orderJson?.code === "SLOT_ALREADY_BOOKED"))
        ) {
          clearPaymentPageBlockedNotice();
          setBlockedPaymentNotice(null);
          setProcessing(false);
          setRetryVisible(false);
          resetBooking();
          router.replace(BOOKING_ROUTES.ROOT);
          return;
        }
        handleBookingError(orderJson, router, {
          resetBooking,
          fallbackMessage:
            orderJson?.message || "Unable to create payment order.",
        });
        return;
      }

      if (!orderJson.orderId || !orderJson.amount) {
        toast.error("Unable to create payment order", {
          id: "pay",
        });
        resetToRetryState();
        return;
      }

      setPayableAmount(Math.round(orderJson.amount / 100));
      if (
        typeof orderJson.totalAmount === "number" &&
        Number.isFinite(orderJson.totalAmount) &&
        typeof orderJson.remainingPayable === "number" &&
        Number.isFinite(orderJson.remainingPayable)
      ) {
        const payable = Math.round(orderJson.amount / 100);
        const isFullPayment =
          orderJson.remainingPayable <= 0 || payable >= orderJson.totalAmount;
        setPaymentLabel(isFullPayment ? "Full Payment" : "Advance");
      }

      toast.success("Opening secure payment gateway…", { id: "pay", });

      const opened = openRazorpayCheckout({
        orderId: orderJson.orderId,
        amountInPaise: orderJson.amount,
        bookingId, // guaranteed string
        contact: booking.contact,
        onPaymentCancel: () => {
          dismissPayToast();
          dismissVerifyToast();
          isCheckoutOpenRef.current = false;
          setProcessing(false);
          setRetryVisible(true);
          hasOpenedRef.current = false;
          toast.error("Payment cancelled. You can retry safely.");
        },
        onOpenFailed: () => {
          resetToRetryState();
          toast.error("Razorpay is not ready. Please try again.");
        },
        onVerificationError: (errorJson) => {
          dismissPayToast();
          dismissVerifyToast();
          isCheckoutOpenRef.current = false;
          const isDelayedRedirectCase =
            errorJson?.code === "DUPLICATE_PAYMENT_ATTEMPT" ||
            errorJson?.code === "BOOKING_FINALIZED";

          if (isDelayedRedirectCase) {
            setProcessing(false);
            setRetryVisible(false);
            hasOpenedRef.current = false;
            return;
          }

          if (
            errorJson?.code === "SLOT_ALREADY_BOOKED" ||
            errorJson?.code === "SESSION_EXPIRED"
          ) {
            if (
              errorJson?.bookingStatus === "PAID_EXPIRED" ||
              errorJson?.paymentCaptured
            ) {
              const notice = {
                bookingId,
                title: PAYMENT_CAPTURED_FAILURE_MODAL_TITLE,
                message: PAYMENT_CAPTURED_FAILURE_MODAL_MESSAGE,
              };
              persistPaymentPageBlockedNotice(notice);
              setBlockedPaymentNotice({
                title: notice.title,
                message: notice.message,
              });
              setRetryVisible(false);
            }
            handleBookingError(errorJson, router, {
              resetBooking,
              suppressUnhandledToast: true,
            });
          } else {
            const handled = handleBookingError(errorJson, router, {
              resetBooking,
              fallbackMessage: "Payment verification failed.",
              suppressUnhandledToast: true,
            });
            if (!handled) {
              toast.error(
                errorJson?.message || "Payment verification failed.",
                { id: "verify" }
              );
            }
          }
          setProcessing(false);
          setRetryVisible(true);
          hasOpenedRef.current = false;
        },
      });

      if (!opened) {
        resetToRetryState();
        toast.error("Razorpay is not ready. Please try again.");
        return;
      }
      isCheckoutOpenRef.current = true;
      checkoutOpened = true;
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Unable to create payment order",
        { id: "pay" }
      );
    } finally {
      if (!checkoutOpened) {
        isCheckoutOpenRef.current = false;
        setProcessing(false);
        setRetryVisible(true);
        hasOpenedRef.current = false;
      }
    }
  }, [
    hydrated,
    booking.contact,
    bookingId,
    pricing,
    razorReady,
    resetBooking,
    resetToRetryState,
    dismissPayToast,
    dismissVerifyToast,
    router,
  ]);

  useEffect(() => {
    if (pathname === BOOKING_ROUTES.PAYMENT) return;
    dismissPayToast();
    dismissVerifyToast();
    // Ensure next entry to /booking/payment always starts fresh.
    hasOpenedRef.current = false;
    isCheckoutOpenRef.current = false;
  }, [dismissPayToast, dismissVerifyToast, pathname]);

  useEffect(() => {
    return () => {
      dismissPayToast();
      dismissVerifyToast();
    };
  }, [dismissPayToast, dismissVerifyToast]);

  useEffect(() => {
    if (pathname !== BOOKING_ROUTES.PAYMENT) return;
    if (!hydrated || !bookingId || !pricing) return;
    const blockedNotice = getPaymentPageBlockedNotice(bookingId);
    if (blockedNotice) {
      dismissPayToast();
      dismissVerifyToast();
      hasOpenedRef.current = false;
      isCheckoutOpenRef.current = false;
      clearPaymentPageBlockedNotice();
      setBlockedPaymentNotice(null);
      setRetryVisible(false);
      setProcessing(false);
      resetBooking();
      router.replace(BOOKING_ROUTES.ROOT);
      return;
    }

    // Fresh route entry (or updated booking snapshot) should always
    // start a fresh auto-open attempt instead of persisting cancelled state.
    setBlockedPaymentNotice(null);
    hasOpenedRef.current = false;
    isCheckoutOpenRef.current = false;
    setRetryVisible(false);
    setProcessing(true);
  }, [
    pathname,
    hydrated,
    bookingId,
    pricing,
    paymentAttemptKey,
    dismissPayToast,
    dismissVerifyToast,
    resetBooking,
    router,
  ]);

  useEffect(() => {
    if (pathname !== BOOKING_ROUTES.PAYMENT) return;
    if (!processing || retryVisible) return;
    if (isCheckoutOpenRef.current) return;
    if (!hasOpenedRef.current) return;

    // Recovery for cached/kept-alive page state where auto-open flag
    // can remain true even though checkout is no longer open.
    const timer = window.setTimeout(() => {
      hasOpenedRef.current = false;
      setProcessing(false);
      setRetryVisible(true);
    }, 2500);

    return () => window.clearTimeout(timer);
  }, [pathname, processing, retryVisible]);

  /* -----------------------------
     Auto open once
  ------------------------------ */
  useEffect(() => {
    if (pathname !== BOOKING_ROUTES.PAYMENT) return;
    if (blockedPaymentNotice) return;
    if (!razorReady || hasOpenedRef.current) return;
    if (!hydrated || !bookingId || !pricing) return;

    hasOpenedRef.current = true;
    const timer = window.setTimeout(() => {
      void startPayment();
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [
    pathname,
    razorReady,
    hydrated,
    bookingId,
    pricing,
    blockedPaymentNotice,
    startPayment,
  ]);

  return (
    <div className="min-h-screen bg-[#f6f8f7]">
      <main className="flex items-center justify-center px-6 py-24">
        <div className="w-full max-w-md border border-[#2f7e7a]/20 bg-white p-8 text-center space-y-6 shadow-sm">
          {/* Logo */}
          <div className="flex justify-center">
            <Image
              src="/assets/logo.png"
              alt="Haven Retreat Logo"
              width={140}
              height={40}
              priority
            />
          </div>

          {/* Spinner */}
          {processing && !blockedPaymentNotice && (
            <div className="flex justify-center">
              <div className="h-10 w-10 rounded-full border-4 border-[#d7e4e1] border-t-[#347f7c] animate-spin" />
            </div>
          )}

          {!processing && retryVisible && !blockedPaymentNotice && (
            <p className="text-sm text-gray-600">
              Payment was cancelled. You can retry safely.
            </p>
          )}

          <h2 className="text-lg font-semibold text-[#1f2937]">
            {blockedPaymentNotice?.title ?? "Processing Secure Payment"}
          </h2>

          {blockedPaymentNotice ? (
            <p className="whitespace-pre-line text-sm text-gray-600">
              {blockedPaymentNotice.message}
            </p>
          ) : !retryVisible ? (
            <p className="text-sm text-gray-600">
              Please do not refresh or go back.
              Your booking is being securely processed.
            </p>
          ) : null}

          {!blockedPaymentNotice ? (
            <div className="border border-[#d7e4e1] bg-[#f8fbfa] p-4 text-sm space-y-1">
            {/* <p>
              <strong>Booking ID:</strong> {bookingId}
            </p> */}
            <p>
              <strong>{paymentLabel} Payable:</strong> {formatCurrency(displayPayableAmount)}
            </p>
            </div>
          ) : null}

          {!blockedPaymentNotice ? (
            <div className="flex items-center justify-center gap-2 text-xs text-gray-500">
            <ShieldCheck size={14} className="text-[#347f7c]" />
            SSL Secured · Razorpay · PCI-DSS
            </div>
          ) : null}

          {blockedPaymentNotice ? (
            <div className="space-y-2">
              <button
                onClick={() => router.push("/contact")}
                className="h-12 w-full border border-[#d7e4e1] bg-white font-semibold text-gray-700 transition hover:bg-[#f8fbfa] cursor-pointer"
              >
                Contact Support
              </button>
              <button
                onClick={() => {
                  clearPaymentPageBlockedNotice();
                  dismissPayToast();
                  dismissVerifyToast();
                  resetBooking();
                  router.push(BOOKING_ROUTES.THEATRE);
                }}
                className="h-12 w-full border border-[#347f7c] bg-[#347f7c] font-semibold text-white transition hover:bg-[#245e5b] cursor-pointer"
              >
                Restart Booking
              </button>
            </div>
          ) : retryVisible ? (
            <div className="space-y-2">
              <button
                onClick={startPayment}
                className="h-12 w-full border border-[#347f7c] bg-[#347f7c] font-semibold text-white transition hover:bg-[#245e5b] cursor-pointer"
              >
                Retry Payment
              </button>
              <button
                onClick={() => router.push(BOOKING_ROUTES.THEATRE)}
                className="h-12 w-full border border-[#d7e4e1] bg-white font-semibold text-gray-700 transition hover:bg-[#f8fbfa] cursor-pointer"
              >
                Change Booking Details
              </button>
            </div>
          ) : null}
        </div>
      </main>

    </div>
  );
}
