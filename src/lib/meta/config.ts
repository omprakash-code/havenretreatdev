export type MetaSiteConfig = {
  siteKey: string;
  brandName: string;
  appUrl: string;
  privacyPolicyPath: string;
  cookiePrefix: string;
  consentTitle: string;
  consentDescription: string;
  pixelId: string;
  accessToken: string;
  testEventCode?: string;
  graphApiVersion: string;
};

function buildDefaultMetaConfig(): MetaSiteConfig {
  return {
    siteKey: "havenreteat",
    brandName: "Haven Retreat",
    appUrl:
      process.env.NEXT_PUBLIC_APP_URL?.trim() ||
      process.env.APP_URL?.trim() ||
      "https://havenretreat.com",
    privacyPolicyPath: "/privacy-policy",
    cookiePrefix: "ds",
    consentTitle: "We value your privacy",
    consentDescription:
      "By clicking “Accept All Cookies”, you agree to the storing of cookies on your device to enhance site navigation, analyze site usage, and assist in our marketing efforts. You may click “Customize” to personalize the types of cookies you would like to allow.",
    pixelId: process.env.NEXT_PUBLIC_META_PIXEL_ID?.trim() ?? "",
    accessToken: process.env.META_ACCESS_TOKEN?.trim() ?? "",
    testEventCode: process.env.META_TEST_EVENT_CODE?.trim() || undefined,
    graphApiVersion: process.env.META_GRAPH_API_VERSION?.trim() || "v22.0",
  };
}

function normalizeHostname(hostname: string | null | undefined) {
  return String(hostname ?? "")
    .trim()
    .toLowerCase()
    .replace(/:\d+$/, "");
}

export function resolveMetaSiteConfig(hostname?: string | null) {
  const normalizedHostname = normalizeHostname(hostname);
  const defaultConfig = buildDefaultMetaConfig();

  if (
    !normalizedHostname ||
    normalizedHostname === "localhost" ||
    normalizedHostname === "127.0.0.1" ||
    normalizedHostname === "havenretreat.com" ||
    normalizedHostname.endsWith(".havenretreat.com")
  ) {
    return defaultConfig;
  }

  return defaultConfig;
}

export function getMetaCookieNames(config: MetaSiteConfig) {
  return {
    consent: `${config.cookiePrefix}_cookie_consent`,
    attributionStorage: `${config.cookiePrefix}_meta_attribution`,
    consentStorage: `${config.cookiePrefix}_cookie_consent`,
    fbc: `${config.cookiePrefix}_meta_fbc`,
    fbp: `${config.cookiePrefix}_meta_fbp`,
  };
}

export function getClientMetaSiteConfig() {
  if (typeof window === "undefined") {
    return resolveMetaSiteConfig();
  }

  return resolveMetaSiteConfig(window.location.hostname);
}
