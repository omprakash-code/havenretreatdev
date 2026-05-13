import {
  getNumberDecorationLabel,
  isNumberDecorationProduct,
} from "@/lib/product-numbering";

export type BookingCelebrationDetail = {
  label: string;
  value: string;
};

type OccasionData = Record<string, unknown> | null | undefined;

type NumberDecorationSource = {
  productName: string;
  productSlug?: string | null;
};

type NumberDecorationItem<T extends NumberDecorationSource> = T & {
  numberLabel?: string | null;
  numberValue?: string | null;
};

const DIRECT_NUMBER_KEYS = [
  "ledNumber",
  "led_number",
  "ledNo",
  "ledno",
  "led",
  "numberBalloonTower",
  "number_balloon_tower",
  "balloonTowerNumber",
  "balloon_tower_number",
];

function normalizeOccasionKey(key: string) {
  return key.trim().toLowerCase().replace(/[_\-\s]+/g, "");
}

export function formatOccasionFieldLabel(key: string) {
  const normalized = key
    .replace(/[_-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/([a-zA-Z])(\d)/g, "$1 $2")
    .replace(/(\d)([a-zA-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();

  return normalized.replace(/\b\w/g, (char) => char.toUpperCase());
}

export function stringifyCelebrationValue(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value
      .map((item) => stringifyCelebrationValue(item))
      .filter((item) => item.length > 0)
      .join(", ");
  }
  return "";
}

export function isOccasionNumberKey(key: string) {
  const normalized = normalizeOccasionKey(key);
  return (
    normalized === "lednumber" ||
    normalized === "ledno" ||
    normalized === "led" ||
    normalized === "numberballoontower" ||
    normalized === "balloontowernumber" ||
    normalized === "balloonnumber"
  );
}

export function buildOccasionDetails(
  occasionData: OccasionData
): BookingCelebrationDetail[] {
  if (!occasionData || Array.isArray(occasionData)) {
    return [];
  }

  return Object.entries(occasionData)
    .filter(([key]) => !isOccasionNumberKey(key))
    .map(([key, value]) => ({
      label: formatOccasionFieldLabel(key),
      value: stringifyCelebrationValue(value),
    }))
    .filter((entry) => entry.value.length > 0);
}

function extractNumberValues(value: unknown): string[] {
  if (typeof value === "string") {
    const clean = value.trim();
    return clean ? [clean] : [];
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return [String(value)];
  }
  if (Array.isArray(value)) {
    return value
      .map((entry) => String(entry ?? "").trim())
      .filter((entry) => entry.length > 0);
  }
  return [];
}

export function extractNumberDecorationValuesFromOccasionData(
  occasionData: OccasionData
) {
  if (!occasionData || Array.isArray(occasionData)) {
    return [] as string[];
  }

  for (const key of DIRECT_NUMBER_KEYS) {
    if (key in occasionData) {
      const values = extractNumberValues(occasionData[key]);
      if (values.length > 0) {
        return values;
      }
    }
  }

  for (const [key, value] of Object.entries(occasionData)) {
    if (!isOccasionNumberKey(key)) continue;
    const values = extractNumberValues(value);
    if (values.length > 0) {
      return values;
    }
  }

  return [] as string[];
}

export function assignNumberDecorationDetails<T extends NumberDecorationSource>(
  items: T[],
  occasionData: OccasionData
): Array<NumberDecorationItem<T>> {
  const numberValues = extractNumberDecorationValuesFromOccasionData(occasionData);
  let numberIndex = 0;

  return items.map((item) => {
    const isNumberItem = isNumberDecorationProduct({
      slug: item.productSlug,
      name: item.productName,
    });

    if (!isNumberItem) {
      return {
        ...item,
        numberLabel: null,
        numberValue: null,
      };
    }

    return {
      ...item,
      numberLabel: getNumberDecorationLabel({
        slug: item.productSlug,
        name: item.productName,
      }),
      numberValue: numberValues[numberIndex++] ?? null,
    };
  });
}
