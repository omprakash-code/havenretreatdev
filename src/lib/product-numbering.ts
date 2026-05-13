type NumberDecorationProductInput = {
  slug?: string | null;
  name?: string | null;
};

export type NumberDecorationKind = "LED_NUMBER" | "BALLOON_TOWER_NUMBER";

const NUMBER_DECORATION_SLUG_MARKERS = ["led-number", "number-balloon-tower"];
const NUMBER_DECORATION_NAME_MARKERS = ["led number", "number balloon tower"];

function normalizeName(value: string | null | undefined) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function isNumberDecorationProduct(input: NumberDecorationProductInput) {
  const slug = String(input.slug ?? "").toLowerCase();
  const normalizedName = normalizeName(input.name);

  return (
    NUMBER_DECORATION_SLUG_MARKERS.some((marker) => slug.includes(marker)) ||
    NUMBER_DECORATION_NAME_MARKERS.some((marker) =>
      normalizedName.includes(marker)
    )
  );
}

export function getNumberDecorationKind(
  input: NumberDecorationProductInput
): NumberDecorationKind | null {
  const slug = String(input.slug ?? "").toLowerCase();
  const normalizedName = normalizeName(input.name);

  const isLed =
    slug.includes("led-number") || normalizedName.includes("led number");
  if (isLed) return "LED_NUMBER";

  const isBalloonTower =
    slug.includes("number-balloon-tower") ||
    normalizedName.includes("number balloon tower");
  if (isBalloonTower) return "BALLOON_TOWER_NUMBER";

  return null;
}

export function getNumberDecorationLabel(input: NumberDecorationProductInput) {
  const kind = getNumberDecorationKind(input);
  if (kind === "LED_NUMBER") return "LED Number";
  if (kind === "BALLOON_TOWER_NUMBER") return "Balloon Tower Number";
  return "Number";
}
