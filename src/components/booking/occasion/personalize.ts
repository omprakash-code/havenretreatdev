type OccasionValues = Record<string, string>;

function normalizeEntries(data: OccasionValues) {
  return Object.entries(data)
    .map(([key, value]) => ({
      key,
      normalizedKey: key.toLowerCase().replace(/[^a-z0-9]/g, ""),
      value: String(value ?? "").trim(),
    }))
    .filter((entry) => entry.value.length > 0);
}

function toDisplayName(input: string) {
  return input
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function findByKeyIncludes(entries: ReturnType<typeof normalizeEntries>, patterns: string[]) {
  const match = entries.find((entry) =>
    patterns.some((pattern) => entry.normalizedKey.includes(pattern))
  );
  return match?.value;
}

function findAnyName(entries: ReturnType<typeof normalizeEntries>) {
  return (
    findByKeyIncludes(entries, [
      "name",
      "person",
      "guest",
      "celebrant",
      "partner",
      "bride",
      "groom",
      "for",
      "to",
    ]) ?? entries[0]?.value
  );
}

export function buildOccasionPersonalizedMessage(
  occasionKey: string,
  occasionLabel: string,
  data: OccasionValues
): string {
  const entries = normalizeEntries(data);
  const key = occasionKey.toLowerCase();

  const partnerOne = findByKeyIncludes(entries, [
    "partner1",
    "partnerone",
    "name1",
    "firstpartner",
    "husband",
    "wife",
    "spouse1",
  ]);
  const partnerTwo = findByKeyIncludes(entries, [
    "partner2",
    "partnertwo",
    "name2",
    "secondpartner",
    "spouse2",
  ]);
  const genericName = findAnyName(entries);

  if (key.includes("birthday")) {
    return genericName
      ? `Happy Birthday, ${toDisplayName(genericName)}!`
      : "Birthday Celebration";
  }

  if (key.includes("anniversary")) {
    if (partnerOne && partnerTwo) {
      return `Happy Anniversary, ${toDisplayName(partnerOne)} & ${toDisplayName(partnerTwo)}!`;
    }
    if (partnerOne || genericName) {
      return `Happy Anniversary, ${toDisplayName(partnerOne || genericName || "")}!`;
    }
    return "Anniversary Celebration";
  }

  if (key.includes("romantic")) {
    return genericName
      ? `A Romantic Evening for ${toDisplayName(genericName)}`
      : "Romantic Date Night";
  }

  if (key.includes("proposal")) {
    return genericName
      ? `Proposal for ${toDisplayName(genericName)}`
      : "Marriage Proposal";
  }

  if (key.includes("bride")) {
    return genericName
      ? `Celebrating ${toDisplayName(genericName)}!`
      : "Bride To Be Celebration";
  }

  if (key.includes("farewell")) {
    return genericName
      ? `Farewell, ${toDisplayName(genericName)}!`
      : "Farewell Celebration";
  }

  if (key.includes("congrat")) {
    return genericName
      ? `Congratulations, ${toDisplayName(genericName)}!`
      : "Congratulations!";
  }

  if (key.includes("baby")) {
    return genericName
      ? `Baby Shower for ${toDisplayName(genericName)}`
      : "Baby Shower Celebration";
  }

  return `${occasionLabel} Celebration`;
}
