export type SlotTemplateSeedConfig = {
  startTime: string;
  endTime: string;
  regularPrice: number;
  salePrice?: number | null;
  decorationMandatory?: boolean;
  bufferMin?: number;
};

export type TheatreSeedConfig = {
  name: string;
  sortOrder: number;
  images: string[];
  capacity: number;
  baseGuests: number;
  hasFood: boolean;
  decorationPrice: number;
  extraPersonPrice: number;
  menuFile: string;
  mapUrl: string;
  footerMessage?: string | null;
  cardContent?: Record<string, unknown> | null;
  slotTemplates: SlotTemplateSeedConfig[];
};

export type LocationSeedConfig = {
  name: string;
  city: string;
  sortOrder: number;
  theatres: TheatreSeedConfig[];
};

const DEFAULT_IMAGES = [
  "/media/booking/theatres/theatre-1/theatre-1-1.png",
  "/media/booking/theatres/theatre-2/theatre-2-1.png",
  "/media/booking/theatres/theatre-3/theatre-3-1.png",
];

const DEFAULT_MENU_FILE = "/documents/menus/havenretreat-menu.pdf";
const DEFAULT_MAP_URL = "https://maps.app.goo.gl/JS3stLbATdCEjDG96";

function buildPackageCardContent(input: {
  badge: string;
  guestsLabel: string;
  priceNote: string;
  includedItems: string[];
  detailSections: Array<{
    title: string;
    items: string[];
  }>;
  priceBreakdown: Array<{
    label: string;
    value: string;
  }>;
  totalValue: string;
}) {
  return {
    badge: {
      enabled: input.badge.trim().length > 0,
      text: input.badge,
    },
    priceNote: {
      enabled: input.priceNote.trim().length > 0,
      text: input.priceNote,
    },
    capacity: {
      enabled: true,
      text: input.guestsLabel,
    },
    food: {
      enabled: false,
      text: "",
    },
    decor: {
      enabled: false,
      text: "",
    },
    freeCancellation: {
      enabled: false,
      text: "",
    },
    idealFor: {
      enabled: false,
      title: "",
      linePrimary: "",
      lineSecondary: "",
    },
    nextStep: {
      enabled: false,
      title: "",
      addDetails: { enabled: false, text: "" },
      addCake: { enabled: false, text: "" },
      fogEntry: { enabled: false, text: "" },
      gifts: { enabled: false, text: "" },
    },
    included: {
      enabled: true,
      title: "Included",
      items: input.includedItems,
    },
    packageDetails: {
      enabled: true,
      triggerLabel: "View Package Details",
      sections: input.detailSections,
    },
    priceBreakdown: {
      enabled: true,
      title: "Price Breakdown",
      items: input.priceBreakdown,
      totalLabel: "Before Savings",
      totalValue: input.totalValue,
    },
    cta: {
      text: "Book This Package",
    },
  } satisfies Record<string, unknown>;
}

export const LOCATION_SEED_CONFIGS: LocationSeedConfig[] = [
  {
    name: "Miami",
    city: "Miami",
    sortOrder: 1,
    theatres: [
      {
        name: "Essential Package",
        sortOrder: 1,
        images: DEFAULT_IMAGES,
        capacity: 30,
        baseGuests: 1,
        hasFood: true,
        decorationPrice: 0,
        extraPersonPrice: 0,
        menuFile: DEFAULT_MENU_FILE,
        mapUrl: DEFAULT_MAP_URL,
        footerMessage: "4 hour event rental included",
        cardContent: buildPackageCardContent({
          badge: "Best Value",
          guestsLabel: "Up to 30 Guests",
          priceNote: "Save 111 with package pricing",
          includedItems: [
            "4 Hour Event Rental",
            "1 Complimentary Setup Hour",
            "Private Pool & Backyard Access",
            "Coolers included",
            "Speaker system included",
            "Wifi",
            "3 Tables with black or white spandex",
            "24 Chairs setup",
            "Decoration included",
            "Standard event cleaning",
          ],
          detailSections: [
            {
              title: "Decoration Included",
              items: [
                "Two balloon arches (custom color theme)",
                "LED \"Happy Birthday\" sign",
                "Cake stand included",
              ],
            },
            {
              title: "Cleaning",
              items: [
                "Event cleaning",
                "Trash removal included",
              ],
            },
          ],
          priceBreakdown: [
            { label: "Rental", value: "$500" },
            { label: "Tables", value: "$45" },
            { label: "Chairs", value: "$72" },
            { label: "Decoration", value: "$400" },
            { label: "Cleaning", value: "$95" },
          ],
          totalValue: "$1,112",
        }),
        slotTemplates: [
          { startTime: "09:00", endTime: "13:00", regularPrice: 1000, decorationMandatory: true },
          { startTime: "14:00", endTime: "18:00", regularPrice: 1000, decorationMandatory: true },
          { startTime: "19:00", endTime: "23:00", regularPrice: 1000, decorationMandatory: true },
        ],
      },
      {
        name: "Celebration Package",
        sortOrder: 2,
        images: [
          "/media/booking/theatres/theatre-2/theatre-2-1.png",
          "/media/booking/theatres/theatre-1/theatre-1-1.png",
          "/media/booking/theatres/theatre-3/theatre-3-1.png",
        ],
        capacity: 40,
        baseGuests: 1,
        hasFood: true,
        decorationPrice: 0,
        extraPersonPrice: 0,
        menuFile: DEFAULT_MENU_FILE,
        mapUrl: DEFAULT_MAP_URL,
        footerMessage: "4 hour event rental included",
        cardContent: buildPackageCardContent({
          badge: "Most Popular",
          guestsLabel: "Up to 40 Guests",
          priceNote: "Save 123 with package pricing",
          includedItems: [
            "4 Hour Event Rental",
            "1 Complimentary Setup Hour",
            "Private Pool & Backyard Access",
            "Coolers included",
            "Speaker system included",
            "Wifi",
            "4 Tables with black or white spandex",
            "32 Chairs setup",
            "Decoration included",
            "Standard event cleaning",
          ],
          detailSections: [
            {
              title: "Decoration Included",
              items: [
                "Two balloon arches (custom color theme)",
                "LED \"Happy Birthday\" sign",
                "Cake stand included",
              ],
            },
            {
              title: "Cleaning",
              items: [
                "Event cleaning",
                "Trash removal included",
              ],
            },
          ],
          priceBreakdown: [
            { label: "Rental", value: "$580" },
            { label: "Tables", value: "$60" },
            { label: "Chairs", value: "$96" },
            { label: "Decoration", value: "$400" },
            { label: "Cleaning", value: "$95" },
          ],
          totalValue: "$1,231",
        }),
        slotTemplates: [
          { startTime: "09:00", endTime: "13:00", regularPrice: 1108, decorationMandatory: true },
          { startTime: "14:00", endTime: "18:00", regularPrice: 1108, decorationMandatory: true },
          { startTime: "19:00", endTime: "23:00", regularPrice: 1108, decorationMandatory: true },
        ],
      },
      {
        name: "Signature Package",
        sortOrder: 3,
        images: [
          "/media/booking/theatres/theatre-3/theatre-3-1.png",
          "/media/booking/theatres/theatre-2/theatre-2-1.png",
          "/media/booking/theatres/theatre-1/theatre-1-1.png",
        ],
        capacity: 50,
        baseGuests: 1,
        hasFood: true,
        decorationPrice: 0,
        extraPersonPrice: 0,
        menuFile: DEFAULT_MENU_FILE,
        mapUrl: DEFAULT_MAP_URL,
        footerMessage: "4 hour event rental included",
        cardContent: buildPackageCardContent({
          badge: "For Larger Celebrations",
          guestsLabel: "Up to 50 Guests",
          priceNote: "Save 140 with package pricing",
          includedItems: [
            "4 Hour Event Rental",
            "1 Complimentary Setup Hour",
            "Private Pool & Backyard Access",
            "Coolers included",
            "Speaker system included",
            "Wifi",
            "6 Tables with black or white spandex",
            "40 Chairs setup",
            "Decoration included",
            "Standard event cleaning",
          ],
          detailSections: [
            {
              title: "Decoration Included",
              items: [
                "Two balloon arches (custom color theme)",
                "LED \"Happy Birthday\" sign",
                "Cake stand included",
              ],
            },
            {
              title: "Cleaning",
              items: [
                "Event cleaning",
                "Trash removal included",
              ],
            },
          ],
          priceBreakdown: [
            { label: "Rental", value: "$700" },
            { label: "Tables", value: "$90" },
            { label: "Chairs", value: "$120" },
            { label: "Decoration", value: "$400" },
            { label: "Cleaning", value: "$95" },
          ],
          totalValue: "$1,405",
        }),
        slotTemplates: [
          { startTime: "09:00", endTime: "13:00", regularPrice: 1265, decorationMandatory: true },
          { startTime: "14:00", endTime: "18:00", regularPrice: 1265, decorationMandatory: true },
          { startTime: "19:00", endTime: "23:00", regularPrice: 1265, decorationMandatory: true },
        ],
      },
    ],
  },
];
