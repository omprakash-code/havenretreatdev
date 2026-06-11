"use client";

import Script from "next/script";
import { Cookie, ShieldCheck } from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import {
  ensureMetaAttributionFromLocation,
  getMetaConsentState,
  setMetaConsentState,
  trackMetaStandardEvent,
} from "@/lib/meta/browser";
import {
  META_CONSENT_ACCEPTED,
  META_CONSENT_REJECTED,
  type MetaConsentState,
} from "@/lib/meta/shared";
import { getClientMetaSiteConfig } from "@/lib/meta/config";

function shouldTrackViewContent(pathname: string) {
  return pathname === "/" || pathname.startsWith("/booking");
}

function subscribeMetaConsent(onStoreChange: () => void) {
  if (typeof window === "undefined") {
    return () => {};
  }

  const handleConsentChange = () => {
    onStoreChange();
  };

  const handleStorage = (event: StorageEvent) => {
    if (event.key && !event.key.endsWith("_cookie_consent")) return;
    onStoreChange();
  };

  window.addEventListener("meta-consent-change", handleConsentChange);
  window.addEventListener("storage", handleStorage);

  return () => {
    window.removeEventListener("meta-consent-change", handleConsentChange);
    window.removeEventListener("storage", handleStorage);
  };
}

function buildViewContentPayload(pathname: string) {
  if (pathname === "/") {
    return {
      content_name: "Home",
      content_category: "landing_page",
      content_type: "service",
    };
  }

  if (pathname === "/booking") {
    return {
      content_name: "Booking Start",
      content_category: "booking_flow",
      content_type: "service",
    };
  }

  if (pathname.startsWith("/booking/extras/")) {
    return {
      content_name: "Booking Extras",
      content_category: "booking_flow",
      content_type: "service",
    };
  }

  if (pathname === "/booking/payment") {
    return {
      content_name: "Booking Payment",
      content_category: "booking_flow",
      content_type: "service",
    };
  }

  if (pathname === "/booking/success") {
    return {
      content_name: "Booking Success",
      content_category: "booking_flow",
      content_type: "service",
    };
  }

  return {
    content_name: "Booking Flow",
    content_category: "booking_flow",
    content_type: "service",
  };
}

function CookieConsentBanner({
  title,
  description,
  onAccept,
  onReject,
  onPreferencesChange,
}: {
  title: string;
  description: string;
  onAccept: () => void;
  onReject: () => void;
  onPreferencesChange: (marketingEnabled: boolean) => void;
}) {
  const [isVisible, setIsVisible] = useState(false);
  const [isClosed, setIsClosed] = useState(false);
  const [showPreferences, setShowPreferences] = useState(false);
  const [marketingEnabled, setMarketingEnabled] = useState(true);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setIsVisible(true);
    });

    return () => window.cancelAnimationFrame(frame);
  }, []);

  if (isClosed) {
    return null;
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-[240] flex justify-end px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] sm:px-4">
      <div
        className={[
          "w-full max-w-[34rem] overflow-hidden border border-[#d7e4e1] bg-white shadow-[0_16px_48px_rgba(15,23,42,0.12)] transition-all duration-300 ease-out",
          isVisible ? "translate-y-0 opacity-100" : "translate-y-5 opacity-0",
        ].join(" ")}
      >
        <div className="flex flex-col gap-3 px-5 py-4 sm:px-6 sm:py-5">
          <div className="flex items-start justify-between gap-4">
            <div className="max-w-[28rem]">
              <p className="font-playfair text-[1.1rem] font-semibold tracking-tight text-[#101828] sm:text-[1.2rem]">
                {title}
              </p>
              <p className="mt-2.5 text-[13px] leading-6 text-[#4b5563] sm:text-[14px]">
                {description}
              </p>
            </div>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center border border-[#d7e4e1] bg-[#edf3f1] text-[#347f7c]">
              <Cookie className="h-4 w-4" />
            </div>
          </div>

          <div
            className={[
              "overflow-hidden transition-all duration-300 ease-out",
              showPreferences ? "max-h-[28rem] opacity-100" : "max-h-0 opacity-0",
            ].join(" ")}
          >
            <div className="border border-[#d7e4e1] bg-[#f8fbfa] p-3.5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-[#101828]">
                    Cookie Preferences
                  </p>
                  <p className="mt-1 text-[13px] leading-5 text-[#667085]">
                    Essential cookies keep booking, checkout, and session security working.
                  </p>
                </div>
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#347f7c]" />
              </div>

              <div className="mt-3 grid gap-2">
                <div className="flex items-start justify-between gap-3 border border-[#d7e4e1] bg-[#edf3f1] px-3 py-2.5">
                  <div>
                    <p className="text-[13px] font-semibold text-[#101828] sm:text-sm">
                      Essential Cookies
                    </p>
                    <p className="mt-0.5 text-xs leading-5 text-[#667085] sm:text-[13px]">
                      Required for booking flow, payment, and security.
                    </p>
                  </div>
                  <button
                    type="button"
                    aria-label="Essential cookies are always enabled"
                    aria-checked={true}
                    role="switch"
                    disabled
                    className="relative mt-0.5 inline-flex h-6 w-11 shrink-0 cursor-not-allowed items-center rounded-full border border-[#d7e4e1] bg-[#d7e4e1] opacity-70"
                  >
                    <span className="inline-block h-4 w-4 translate-x-6 rounded-full bg-white shadow" />
                  </button>
                </div>

                <label className="flex items-start justify-between gap-3 border border-[#d7e4e1] bg-white px-3 py-2.5">
                  <div>
                    <p className="text-[13px] font-semibold text-[#101828] sm:text-sm">
                      Marketing Cookies
                    </p>
                    <p className="mt-0.5 text-xs leading-5 text-[#667085] sm:text-[13px]">
                      Helps us measure how users interact with booking pages.
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={marketingEnabled}
                    onClick={() => {
                      const nextValue = !marketingEnabled;
                      setMarketingEnabled(nextValue);
                      onPreferencesChange(nextValue);
                    }}
                    className={[
                      "relative mt-0.5 inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border transition",
                      marketingEnabled
                        ? "border-[#347f7c] bg-[#347f7c]"
                        : "border-[#d7e4e1] bg-[#f6f8f7]",
                    ].join(" ")}
                  >
                    <span
                      className={[
                        "inline-block h-4 w-4 rounded-full bg-white shadow transition",
                        marketingEnabled ? "translate-x-6" : "translate-x-1",
                      ].join(" ")}
                    />
                  </button>
                </label>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2 border-t border-[#d7e4e1] pt-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
            <button
              type="button"
              onClick={() => setShowPreferences((current) => !current)}
              className="inline-flex h-9 cursor-pointer items-center justify-center border border-[#d7e4e1] bg-white px-4 text-[12px] font-semibold uppercase tracking-[0.08em] text-[#245e5b] transition hover:bg-[#edf3f1]"
            >
              Customize
            </button>
            <button
              type="button"
              onClick={() => { setIsClosed(true); onReject(); }}
              className="inline-flex h-9 cursor-pointer items-center justify-center border border-[#d7e4e1] bg-white px-4 text-[12px] font-semibold uppercase tracking-[0.08em] text-[#667085] transition hover:bg-[#f6f8f7]"
            >
              Reject All
            </button>
            <button
              type="button"
              onClick={() => { setIsClosed(true); onAccept(); }}
              className="inline-flex h-9 cursor-pointer items-center justify-center bg-[#0d3b24] px-5 text-[12px] font-semibold uppercase tracking-[0.08em] text-white transition hover:bg-[#245e5b]"
            >
              Accept All Cookies
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function MetaBootstrap() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const siteConfig = getClientMetaSiteConfig();
  const pixelId = siteConfig.pixelId;
  const routeKey = useMemo(() => {
    const query = searchParams.toString();
    return query ? `${pathname}?${query}` : pathname;
  }, [pathname, searchParams]);
  const initialViewContentPayload = useMemo(() => {
    if (!shouldTrackViewContent(pathname)) return null;
    return JSON.stringify(buildViewContentPayload(pathname));
  }, [pathname]);
  const consent = useSyncExternalStore(
    subscribeMetaConsent,
    getMetaConsentState,
    (): MetaConsentState => null
  );
  const [keepBannerOpen, setKeepBannerOpen] = useState(false);
  const [pixelReady, setPixelReady] = useState(false);
  const lastTrackedRouteRef = useRef<string | null>(null);
  const showBanner = consent === null || keepBannerOpen;

  useEffect(() => {
    if (consent !== META_CONSENT_ACCEPTED) return;
    ensureMetaAttributionFromLocation();
  }, [consent, routeKey]);

  useEffect(() => {
    if (consent !== META_CONSENT_ACCEPTED || !pixelId || !pixelReady) return;
    if (typeof window === "undefined" || !window.fbq) return;
    if (lastTrackedRouteRef.current === routeKey) return;

    lastTrackedRouteRef.current = routeKey;
    trackMetaStandardEvent("PageView");

    if (shouldTrackViewContent(pathname)) {
      trackMetaStandardEvent("ViewContent", buildViewContentPayload(pathname));
    }
  }, [consent, pathname, pixelId, pixelReady, routeKey]);

  if (!pixelId) {
    return null;
  }

  return (
    <>
      {consent === META_CONSENT_ACCEPTED ? (
        <Script
          id="meta-pixel"
          strategy="afterInteractive"
          onReady={() => {
            setPixelReady(Boolean(window.fbq));
            lastTrackedRouteRef.current = routeKey;
          }}
          dangerouslySetInnerHTML={{
            __html: `
              !function(f,b,e,v,n,t,s)
              {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
              n.callMethod.apply(n,arguments):n.queue.push(arguments)};
              if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
              n.queue=[];t=b.createElement(e);t.async=!0;
              t.src=v;s=b.getElementsByTagName(e)[0];
              s.parentNode.insertBefore(t,s)}(window, document,'script',
              'https://connect.facebook.net/en_US/fbevents.js');
              fbq('init', '${pixelId}');
              fbq('track', 'PageView');
              ${
                initialViewContentPayload
                  ? `fbq('track', 'ViewContent', ${initialViewContentPayload});`
                  : ""
              }
            `,
          }}
        />
      ) : null}

      {showBanner ? (
        <CookieConsentBanner
          onAccept={() => {
            setKeepBannerOpen(false);
            setMetaConsentState(META_CONSENT_ACCEPTED);
            ensureMetaAttributionFromLocation();
          }}
          onReject={() => {
            setKeepBannerOpen(false);
            setMetaConsentState(META_CONSENT_REJECTED);
          }}
          onPreferencesChange={(marketingEnabled) => {
            setKeepBannerOpen(true);
            const nextConsent = marketingEnabled
              ? META_CONSENT_ACCEPTED
              : META_CONSENT_REJECTED;
            setMetaConsentState(nextConsent);
            if (marketingEnabled) ensureMetaAttributionFromLocation();
          }}
          title={siteConfig.consentTitle}
          description={siteConfig.consentDescription}
        />
      ) : null}
    </>
  );
}
