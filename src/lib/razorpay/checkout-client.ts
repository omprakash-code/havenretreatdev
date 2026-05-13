"use client";

export type RazorpaySuccessResponse = {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
};

type RazorpayModalOptions = {
  orderId: string;
  amountInPaise: number;
  name: string;
  description: string;
  currency?: string;
  prefill?: {
    name?: string;
    email?: string;
    contact?: string;
  };
  themeColor?: string;
  onSuccess: (response: RazorpaySuccessResponse) => void | Promise<void>;
  onDismiss?: () => void;
  onOpen?: () => void;
  onOpenFailed?: () => void;
};

type RazorpayCheckoutOptions = {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  handler: (response: RazorpaySuccessResponse) => void;
  prefill?: {
    name?: string;
    email?: string;
    contact?: string;
  };
  modal?: {
    ondismiss?: () => void;
  };
  theme?: {
    color?: string;
  };
};

type RazorpayCheckoutConstructor = new (
  options: RazorpayCheckoutOptions
) => { open: () => void };

const RAZORPAY_CHECKOUT_SRC = "https://checkout.razorpay.com/v1/checkout.js";
const RAZORPAY_LOAD_STATE_ATTR = "data-razorpay-load-state";
const RAZORPAY_LOAD_TIMEOUT_MS = 8_000;

let razorpayLoadPromise: Promise<boolean> | null = null;

function waitForCheckoutScript(script: HTMLScriptElement) {
  if (typeof window !== "undefined" && window.Razorpay) {
    script.setAttribute(RAZORPAY_LOAD_STATE_ATTR, "loaded");
    return Promise.resolve(true);
  }

  return new Promise<boolean>((resolve) => {
    let settled = false;
    let timeoutId: number | null = null;

    const finish = (loaded: boolean) => {
      if (settled) return;
      settled = true;

      script.removeEventListener("load", handleLoad);
      script.removeEventListener("error", handleError);
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }

      script.setAttribute(
        RAZORPAY_LOAD_STATE_ATTR,
        loaded ? "loaded" : "error"
      );
      resolve(loaded);
    };

    const handleLoad = () => finish(Boolean(window.Razorpay));
    const handleError = () => finish(false);

    script.addEventListener("load", handleLoad);
    script.addEventListener("error", handleError);

    timeoutId = window.setTimeout(() => {
      finish(Boolean(window.Razorpay));
    }, RAZORPAY_LOAD_TIMEOUT_MS);
  });
}

export async function ensureRazorpayCheckoutLoaded() {
  if (typeof window === "undefined") return false;
  if (window.Razorpay) return true;
  if (razorpayLoadPromise) return razorpayLoadPromise;

  razorpayLoadPromise = (async () => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${RAZORPAY_CHECKOUT_SRC}"]`
    );
    const existingState = existing?.getAttribute(RAZORPAY_LOAD_STATE_ATTR);

    const shouldReuseExisting = Boolean(existing) && existingState !== "error";
    const script = shouldReuseExisting
      ? (existing as HTMLScriptElement)
      : document.createElement("script");

    if (!shouldReuseExisting) {
      existing?.remove();
      script.src = RAZORPAY_CHECKOUT_SRC;
      script.async = true;
      script.setAttribute("data-razorpay-checkout", "true");
      script.setAttribute(RAZORPAY_LOAD_STATE_ATTR, "loading");
      document.body.appendChild(script);
    }

    const loaded = await waitForCheckoutScript(script);
    return loaded && Boolean(window.Razorpay);
  })();

  const loaded = await razorpayLoadPromise;
  if (!loaded) {
    // Allow future retries to attempt a fresh script load.
    razorpayLoadPromise = null;
  }

  return loaded;
}

export function openRazorpayModal({
  orderId,
  amountInPaise,
  name,
  description,
  currency = "INR",
  prefill,
  themeColor = "#1b1b1bff",
  onSuccess,
  onDismiss,
  onOpen,
  onOpenFailed,
}: RazorpayModalOptions) {
  const key = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
  if (!key) {
    onOpenFailed?.();
    return false;
  }

  const RazorpayConstructor = window.Razorpay as RazorpayCheckoutConstructor | undefined;
  if (!RazorpayConstructor) {
    onOpenFailed?.();
    return false;
  }

  const options: RazorpayCheckoutOptions = {
    key,
    amount: amountInPaise,
    currency,
    name,
    description,
    order_id: orderId,
    handler: (response) => {
      void onSuccess(response);
    },
    prefill,
    modal: {
      ondismiss: onDismiss,
    },
    theme: {
      color: themeColor,
    },
  };

  try {
    new RazorpayConstructor(options).open();
    onOpen?.();
    return true;
  } catch {
    onOpenFailed?.();
    return false;
  }
}
