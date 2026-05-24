export type TheatreCardTextToggle = {
  enabled: boolean;
  text: string;
};

export type TheatreCardListSection = {
  enabled: boolean;
  title: string;
  items: string[];
};

export type TheatreCardDetailGroup = {
  title: string;
  items: string[];
};

export type TheatreCardPriceBreakdownRow = {
  label: string;
  value: string;
};

export type TheatreCardContent = {
  capacity: TheatreCardTextToggle;
  food: TheatreCardTextToggle;
  decor: TheatreCardTextToggle;
  freeCancellation: TheatreCardTextToggle;
  idealFor: {
    enabled: boolean;
    title: string;
    linePrimary: string;
    lineSecondary: string;
  };
  nextStep: {
    enabled: boolean;
    title: string;
    addDetails: TheatreCardTextToggle;
    addCake: TheatreCardTextToggle;
    fogEntry: TheatreCardTextToggle;
    gifts: TheatreCardTextToggle;
  };
  badge: TheatreCardTextToggle;
  priceNote: TheatreCardTextToggle;
  included: TheatreCardListSection;
  packageDetails: {
    enabled: boolean;
    triggerLabel: string;
    sections: TheatreCardDetailGroup[];
  };
  priceBreakdown: {
    enabled: boolean;
    title: string;
    items: TheatreCardPriceBreakdownRow[];
    totalLabel: string;
    totalValue: string;
  };
  cta: {
    text: string;
  };
};

export type TheatreCardTemplateValues = {
  capacity: number;
  decorationPrice: number;
  baseGuests?: number;
  extraPersonPrice?: number;
  location?: string;
};

export const DEFAULT_THEATRE_CARD_CONTENT: TheatreCardContent = {
  capacity: {
    enabled: true,
    text: "Up to {{capacity}} People",
  },
  food: {
    enabled: true,
    text: "Food",
  },
  decor: {
    enabled: true,
    text: "Decor ₹{{decorationPrice}} Only",
  },
  freeCancellation: {
    enabled: true,
    text: "Free Cancellation*",
  },
  idealFor: {
    enabled: true,
    title: "Ideal for",
    linePrimary: "couple and",
    lineSecondary: "family",
  },
  nextStep: {
    enabled: true,
    title: "Next Step:",
    addDetails: {
      enabled: true,
      text: "Add Details",
    },
    addCake: {
      enabled: true,
      text: "Add Cake",
    },
    fogEntry: {
      enabled: true,
      text: "Fog Entry",
    },
    gifts: {
      enabled: true,
      text: "Gifts",
    },
  },
  badge: {
    enabled: false,
    text: "",
  },
  priceNote: {
    enabled: false,
    text: "",
  },
  included: {
    enabled: false,
    title: "Included",
    items: [],
  },
  packageDetails: {
    enabled: false,
    triggerLabel: "View Package Details",
    sections: [],
  },
  priceBreakdown: {
    enabled: false,
    title: "Price Breakdown",
    items: [],
    totalLabel: "Total",
    totalValue: "",
  },
  cta: {
    text: "Continue with This Package",
  },
};

export function createDefaultTheatreCardContent(): TheatreCardContent {
  return {
    capacity: { ...DEFAULT_THEATRE_CARD_CONTENT.capacity },
    food: { ...DEFAULT_THEATRE_CARD_CONTENT.food },
    decor: { ...DEFAULT_THEATRE_CARD_CONTENT.decor },
    freeCancellation: { ...DEFAULT_THEATRE_CARD_CONTENT.freeCancellation },
    idealFor: { ...DEFAULT_THEATRE_CARD_CONTENT.idealFor },
    nextStep: {
      ...DEFAULT_THEATRE_CARD_CONTENT.nextStep,
      addDetails: { ...DEFAULT_THEATRE_CARD_CONTENT.nextStep.addDetails },
      addCake: { ...DEFAULT_THEATRE_CARD_CONTENT.nextStep.addCake },
      fogEntry: { ...DEFAULT_THEATRE_CARD_CONTENT.nextStep.fogEntry },
      gifts: { ...DEFAULT_THEATRE_CARD_CONTENT.nextStep.gifts },
    },
    badge: { ...DEFAULT_THEATRE_CARD_CONTENT.badge },
    priceNote: { ...DEFAULT_THEATRE_CARD_CONTENT.priceNote },
    included: {
      ...DEFAULT_THEATRE_CARD_CONTENT.included,
      items: [...DEFAULT_THEATRE_CARD_CONTENT.included.items],
    },
    packageDetails: {
      ...DEFAULT_THEATRE_CARD_CONTENT.packageDetails,
      sections: DEFAULT_THEATRE_CARD_CONTENT.packageDetails.sections.map((section) => ({
        title: section.title,
        items: [...section.items],
      })),
    },
    priceBreakdown: {
      ...DEFAULT_THEATRE_CARD_CONTENT.priceBreakdown,
      items: DEFAULT_THEATRE_CARD_CONTENT.priceBreakdown.items.map((row) => ({
        label: row.label,
        value: row.value,
      })),
    },
    cta: { ...DEFAULT_THEATRE_CARD_CONTENT.cta },
  };
}

export function createEmptyTheatreCardContent(): TheatreCardContent {
  return {
    capacity: { enabled: true, text: "" },
    food: { enabled: true, text: "" },
    decor: { enabled: true, text: "" },
    freeCancellation: { enabled: true, text: "" },
    idealFor: {
      enabled: true,
      title: "",
      linePrimary: "",
      lineSecondary: "",
    },
    nextStep: {
      enabled: true,
      title: "",
      addDetails: { enabled: true, text: "" },
      addCake: { enabled: true, text: "" },
      fogEntry: { enabled: true, text: "" },
      gifts: { enabled: true, text: "" },
    },
    badge: { enabled: false, text: "" },
    priceNote: { enabled: false, text: "" },
    included: {
      enabled: false,
      title: "",
      items: [],
    },
    packageDetails: {
      enabled: false,
      triggerLabel: "",
      sections: [],
    },
    priceBreakdown: {
      enabled: false,
      title: "",
      items: [],
      totalLabel: "",
      totalValue: "",
    },
    cta: {
      text: "",
    },
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function readBoolean(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

function readString(value: unknown, fallback: string, allowEmpty = false) {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  if (trimmed.length > 0) return trimmed;
  return allowEmpty ? "" : fallback;
}

function normalizeTextToggle(
  value: unknown,
  fallback: TheatreCardTextToggle
): TheatreCardTextToggle {
  const record = asRecord(value);
  if (!record) return fallback;

  return {
    enabled: readBoolean(record.enabled, fallback.enabled),
    text: readString(record.text, fallback.text, true),
  };
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter((item) => item.length > 0);
}

function normalizeListSection(
  value: unknown,
  fallback: TheatreCardListSection
): TheatreCardListSection {
  const record = asRecord(value);
  if (!record) return fallback;

  return {
    enabled: readBoolean(record.enabled, fallback.enabled),
    title: readString(record.title, fallback.title, true),
    items: normalizeStringArray(record.items),
  };
}

function normalizeDetailGroups(value: unknown): TheatreCardDetailGroup[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((group) => {
      const record = asRecord(group);
      if (!record) return null;

      const items = normalizeStringArray(record.items);
      const title = readString(record.title, "", true);

      if (title.length === 0 && items.length === 0) return null;

      return {
        title,
        items,
      };
    })
    .filter((group): group is TheatreCardDetailGroup => group !== null);
}

function normalizePriceBreakdownRows(value: unknown): TheatreCardPriceBreakdownRow[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((row) => {
      const record = asRecord(row);
      if (!record) return null;

      const label = readString(record.label, "", true);
      const valueText = readString(record.value, "", true);

      if (label.length === 0 && valueText.length === 0) return null;

      return {
        label,
        value: valueText,
      };
    })
    .filter((row): row is TheatreCardPriceBreakdownRow => row !== null);
}

export function normalizeTheatreCardContent(value: unknown): TheatreCardContent {
  const record = asRecord(value);
  if (!record) return createDefaultTheatreCardContent();

  const idealForRaw = asRecord(record.idealFor);
  const nextStepRaw = asRecord(record.nextStep);
  const packageDetailsRaw = asRecord(record.packageDetails);
  const priceBreakdownRaw = asRecord(record.priceBreakdown);

  return {
    capacity: normalizeTextToggle(record.capacity, DEFAULT_THEATRE_CARD_CONTENT.capacity),
    food: normalizeTextToggle(record.food, DEFAULT_THEATRE_CARD_CONTENT.food),
    decor: normalizeTextToggle(record.decor, DEFAULT_THEATRE_CARD_CONTENT.decor),
    freeCancellation: normalizeTextToggle(
      record.freeCancellation,
      DEFAULT_THEATRE_CARD_CONTENT.freeCancellation
    ),
    idealFor: {
      enabled: readBoolean(
        idealForRaw?.enabled,
        DEFAULT_THEATRE_CARD_CONTENT.idealFor.enabled
      ),
      title: readString(idealForRaw?.title, DEFAULT_THEATRE_CARD_CONTENT.idealFor.title, true),
      linePrimary: readString(
        idealForRaw?.linePrimary,
        DEFAULT_THEATRE_CARD_CONTENT.idealFor.linePrimary,
        true
      ),
      lineSecondary: readString(
        idealForRaw?.lineSecondary,
        DEFAULT_THEATRE_CARD_CONTENT.idealFor.lineSecondary,
        true
      ),
    },
    nextStep: {
      enabled: readBoolean(
        nextStepRaw?.enabled,
        DEFAULT_THEATRE_CARD_CONTENT.nextStep.enabled
      ),
      title: readString(nextStepRaw?.title, DEFAULT_THEATRE_CARD_CONTENT.nextStep.title, true),
      addDetails: normalizeTextToggle(
        nextStepRaw?.addDetails,
        DEFAULT_THEATRE_CARD_CONTENT.nextStep.addDetails
      ),
      addCake: normalizeTextToggle(
        nextStepRaw?.addCake,
        DEFAULT_THEATRE_CARD_CONTENT.nextStep.addCake
      ),
      fogEntry: normalizeTextToggle(
        nextStepRaw?.fogEntry,
        DEFAULT_THEATRE_CARD_CONTENT.nextStep.fogEntry
      ),
      gifts: normalizeTextToggle(nextStepRaw?.gifts, DEFAULT_THEATRE_CARD_CONTENT.nextStep.gifts),
    },
    badge: normalizeTextToggle(record.badge, DEFAULT_THEATRE_CARD_CONTENT.badge),
    priceNote: normalizeTextToggle(record.priceNote, DEFAULT_THEATRE_CARD_CONTENT.priceNote),
    included: normalizeListSection(record.included, DEFAULT_THEATRE_CARD_CONTENT.included),
    packageDetails: {
      enabled: readBoolean(
        packageDetailsRaw?.enabled,
        DEFAULT_THEATRE_CARD_CONTENT.packageDetails.enabled
      ),
      triggerLabel: readString(
        packageDetailsRaw?.triggerLabel,
        DEFAULT_THEATRE_CARD_CONTENT.packageDetails.triggerLabel,
        true
      ),
      sections: normalizeDetailGroups(packageDetailsRaw?.sections),
    },
    priceBreakdown: {
      enabled: readBoolean(
        priceBreakdownRaw?.enabled,
        DEFAULT_THEATRE_CARD_CONTENT.priceBreakdown.enabled
      ),
      title: readString(
        priceBreakdownRaw?.title,
        DEFAULT_THEATRE_CARD_CONTENT.priceBreakdown.title,
        true
      ),
      items: normalizePriceBreakdownRows(priceBreakdownRaw?.items),
      totalLabel: readString(
        priceBreakdownRaw?.totalLabel,
        DEFAULT_THEATRE_CARD_CONTENT.priceBreakdown.totalLabel,
        true
      ),
      totalValue: readString(
        priceBreakdownRaw?.totalValue,
        DEFAULT_THEATRE_CARD_CONTENT.priceBreakdown.totalValue,
        true
      ),
    },
    cta: {
      text: readString(
        asRecord(record.cta)?.text,
        DEFAULT_THEATRE_CARD_CONTENT.cta.text,
        true
      ),
    },
  };
}

function applyTemplate(text: string, values: TheatreCardTemplateValues) {
  const templateValues: Record<string, string> = {
    capacity: String(values.capacity),
    decorationPrice: values.decorationPrice.toLocaleString("en-IN"),
    baseGuests: String(values.baseGuests ?? ""),
    extraPersonPrice:
      values.extraPersonPrice == null
        ? ""
        : values.extraPersonPrice.toLocaleString("en-IN"),
    location: values.location ?? "",
  };

  return text.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key: string) => {
    return templateValues[key] ?? "";
  });
}

export function resolveTheatreCardContent(
  contentValue: unknown,
  values: TheatreCardTemplateValues
): TheatreCardContent {
  const content = normalizeTheatreCardContent(contentValue);

  return {
    ...content,
    capacity: {
      ...content.capacity,
      text: applyTemplate(content.capacity.text, values),
    },
    food: {
      ...content.food,
      text: applyTemplate(content.food.text, values),
    },
    decor: {
      ...content.decor,
      text: applyTemplate(content.decor.text, values),
    },
    freeCancellation: {
      ...content.freeCancellation,
      text: applyTemplate(content.freeCancellation.text, values),
    },
    idealFor: {
      ...content.idealFor,
      title: applyTemplate(content.idealFor.title, values),
      linePrimary: applyTemplate(content.idealFor.linePrimary, values),
      lineSecondary: applyTemplate(content.idealFor.lineSecondary, values),
    },
    nextStep: {
      ...content.nextStep,
      title: applyTemplate(content.nextStep.title, values),
      addDetails: {
        ...content.nextStep.addDetails,
        text: applyTemplate(content.nextStep.addDetails.text, values),
      },
      addCake: {
        ...content.nextStep.addCake,
        text: applyTemplate(content.nextStep.addCake.text, values),
      },
      fogEntry: {
        ...content.nextStep.fogEntry,
        text: applyTemplate(content.nextStep.fogEntry.text, values),
      },
      gifts: {
        ...content.nextStep.gifts,
        text: applyTemplate(content.nextStep.gifts.text, values),
      },
    },
    badge: {
      ...content.badge,
      text: applyTemplate(content.badge.text, values),
    },
    priceNote: {
      ...content.priceNote,
      text: applyTemplate(content.priceNote.text, values),
    },
    included: {
      ...content.included,
      title: applyTemplate(content.included.title, values),
      items: content.included.items.map((item) => applyTemplate(item, values)),
    },
    packageDetails: {
      ...content.packageDetails,
      triggerLabel: applyTemplate(content.packageDetails.triggerLabel, values),
      sections: content.packageDetails.sections.map((section) => ({
        title: applyTemplate(section.title, values),
        items: section.items.map((item) => applyTemplate(item, values)),
      })),
    },
    priceBreakdown: {
      ...content.priceBreakdown,
      title: applyTemplate(content.priceBreakdown.title, values),
      items: content.priceBreakdown.items.map((row) => ({
        label: applyTemplate(row.label, values),
        value: applyTemplate(row.value, values),
      })),
      totalLabel: applyTemplate(content.priceBreakdown.totalLabel, values),
      totalValue: applyTemplate(content.priceBreakdown.totalValue, values),
    },
    cta: {
      text: applyTemplate(content.cta.text, values),
    },
  };
}
