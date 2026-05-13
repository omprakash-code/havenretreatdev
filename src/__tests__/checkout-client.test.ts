import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type EventHandler = () => void;

type FakeScriptElement = {
  src: string;
  async: boolean;
  setAttribute: (key: string, value: string) => void;
  getAttribute: (key: string) => string | null;
  addEventListener: (event: "load" | "error", handler: EventHandler) => void;
  removeEventListener: (event: "load" | "error", handler: EventHandler) => void;
  dispatch: (event: "load" | "error") => void;
  remove: () => void;
};

function createFakeDom() {
  const scripts: FakeScriptElement[] = [];

  function createScript(): FakeScriptElement {
    const attrs = new Map<string, string>();
    const listeners = {
      load: new Set<EventHandler>(),
      error: new Set<EventHandler>(),
    };

    const script: FakeScriptElement = {
      src: "",
      async: false,
      setAttribute: (key, value) => {
        attrs.set(key, value);
      },
      getAttribute: (key) => attrs.get(key) ?? null,
      addEventListener: (event, handler) => {
        listeners[event].add(handler);
      },
      removeEventListener: (event, handler) => {
        listeners[event].delete(handler);
      },
      dispatch: (event) => {
        for (const handler of listeners[event]) {
          handler();
        }
      },
      remove: () => {
        const idx = scripts.indexOf(script);
        if (idx >= 0) scripts.splice(idx, 1);
      },
    };

    return script;
  }

  const documentMock = {
    createElement: vi.fn((tag: string) => {
      if (tag !== "script") {
        throw new Error(`Unsupported element: ${tag}`);
      }
      return createScript();
    }),
    querySelector: vi.fn((selector: string) => {
      const match = selector.match(/^script\[src="(.+)"\]$/);
      if (!match) return null;
      const [, src] = match;
      return scripts.find((script) => script.src === src) ?? null;
    }),
    body: {
      appendChild: vi.fn((script: FakeScriptElement) => {
        scripts.push(script);
        return script;
      }),
    },
  };

  return { documentMock, scripts };
}

async function loadCheckoutClientModule() {
  vi.resetModules();
  return import("@/lib/razorpay/checkout-client");
}

describe("checkout-client", () => {
  const originalWindow = (globalThis as { window?: unknown }).window;
  const originalDocument = (globalThis as { document?: unknown }).document;
  const originalKey = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
  });

  afterEach(() => {
    (globalThis as { window?: unknown }).window = originalWindow;
    (globalThis as { document?: unknown }).document = originalDocument;
    if (originalKey === undefined) {
      delete process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
    } else {
      process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID = originalKey;
    }
  });

  it("loads checkout script once and resolves true when Razorpay becomes available", async () => {
    const { documentMock, scripts } = createFakeDom();
    const fakeWindow: { Razorpay?: unknown; setTimeout: typeof setTimeout; clearTimeout: typeof clearTimeout } = {
      setTimeout,
      clearTimeout,
    };

    (globalThis as { window?: unknown }).window = fakeWindow;
    (globalThis as { document?: unknown }).document = documentMock;

    const { ensureRazorpayCheckoutLoaded } = await loadCheckoutClientModule();

    const loadingPromise = ensureRazorpayCheckoutLoaded();
    expect(scripts).toHaveLength(1);
    expect(scripts[0].getAttribute("data-razorpay-load-state")).toBe("loading");

    fakeWindow.Razorpay = class RazorpayMock {};
    scripts[0].dispatch("load");

    await expect(loadingPromise).resolves.toBe(true);

    const secondLoad = await ensureRazorpayCheckoutLoaded();
    expect(secondLoad).toBe(true);
    expect(scripts).toHaveLength(1);
  });

  it("retries by replacing an errored script and succeeds on next load", async () => {
    const { documentMock, scripts } = createFakeDom();
    const fakeWindow: { Razorpay?: unknown; setTimeout: typeof setTimeout; clearTimeout: typeof clearTimeout } = {
      setTimeout,
      clearTimeout,
    };

    (globalThis as { window?: unknown }).window = fakeWindow;
    (globalThis as { document?: unknown }).document = documentMock;

    const errored = documentMock.createElement("script") as FakeScriptElement;
    errored.src = "https://checkout.razorpay.com/v1/checkout.js";
    errored.setAttribute("data-razorpay-load-state", "error");
    documentMock.body.appendChild(errored);

    const { ensureRazorpayCheckoutLoaded } = await loadCheckoutClientModule();
    const promise = ensureRazorpayCheckoutLoaded();

    expect(scripts).toHaveLength(1);
    const replacement = scripts[0];
    expect(replacement).not.toBe(errored);

    fakeWindow.Razorpay = class RazorpayMock {};
    replacement.dispatch("load");
    await expect(promise).resolves.toBe(true);
  });

  it("openRazorpayModal fails fast when key/constructor are unavailable", async () => {
    const { openRazorpayModal } = await loadCheckoutClientModule();
    const onOpenFailed = vi.fn();

    (globalThis as { window?: unknown }).window = { Razorpay: undefined };
    const withoutKey = openRazorpayModal({
      orderId: "order-1",
      amountInPaise: 1000,
      name: "Haven Retreat",
      description: "Booking",
      onSuccess: vi.fn(),
      onOpenFailed,
    });
    expect(withoutKey).toBe(false);
    expect(onOpenFailed).toHaveBeenCalledTimes(1);

    process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID = "rzp_test_123";
    const withoutConstructor = openRazorpayModal({
      orderId: "order-1",
      amountInPaise: 1000,
      name: "Haven Retreat",
      description: "Booking",
      onSuccess: vi.fn(),
      onOpenFailed,
    });
    expect(withoutConstructor).toBe(false);
    expect(onOpenFailed).toHaveBeenCalledTimes(2);
  });

  it("openRazorpayModal opens checkout and invokes success handler", async () => {
    process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID = "rzp_test_123";
    const { openRazorpayModal } = await loadCheckoutClientModule();

    const response = {
      razorpay_payment_id: "pay-1",
      razorpay_order_id: "order-1",
      razorpay_signature: "sig-1",
    };

    const onOpen = vi.fn();
    const onSuccess = vi.fn();
    const openSpy = vi.fn();
    type RazorpayOptionsShape = {
      handler: (input: typeof response) => void;
    };
    let capturedOptions: RazorpayOptionsShape | null = null;

    class RazorpayCtor {
      constructor(options: RazorpayOptionsShape) {
        capturedOptions = options;
      }

      open() {
        openSpy();
        capturedOptions?.handler(response);
      }
    }

    (globalThis as { window?: unknown }).window = {
      Razorpay: RazorpayCtor,
    };

    const opened = openRazorpayModal({
      orderId: "order-1",
      amountInPaise: 1000,
      name: "Haven Retreat",
      description: "Booking",
      onSuccess,
      onOpen,
    });

    expect(opened).toBe(true);
    expect(openSpy).toHaveBeenCalledTimes(1);
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onSuccess).toHaveBeenCalledWith(response);
  });
});
