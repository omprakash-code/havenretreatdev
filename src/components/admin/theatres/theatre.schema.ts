import { z } from "zod";

function numberField({
  invalidMessage,
  min,
}: {
  invalidMessage: string;
  min: number;
}) {
  return z
    .number({
      error: invalidMessage,
    })
    .min(min, { error: invalidMessage });
}

const cardTextToggleSchema = z.object({
  enabled: z.boolean(),
  text: z.string().trim(),
});

const theatreCardContentSchema = z.object({
  capacity: cardTextToggleSchema,
  food: cardTextToggleSchema,
  decor: cardTextToggleSchema,
  freeCancellation: cardTextToggleSchema,
  idealFor: z.object({
    enabled: z.boolean(),
    title: z.string().trim(),
    linePrimary: z.string().trim(),
    lineSecondary: z.string().trim(),
  }),
  nextStep: z.object({
    enabled: z.boolean(),
    title: z.string().trim(),
    addDetails: cardTextToggleSchema,
    addCake: cardTextToggleSchema,
    fogEntry: cardTextToggleSchema,
    gifts: cardTextToggleSchema,
  }),
});

export const theatreSchema = z.object({
  name: z.string().min(1, "Theatre name is required"),
  locationId: z.string().min(1, "Location is required"),

  capacity: numberField({
    invalidMessage: "Enter a valid guest capacity.",
    min: 1,
  }),
  baseGuests: numberField({
    invalidMessage: "Enter included guests.",
    min: 1,
  }),

  extraPersonPrice: numberField({
    invalidMessage: "Enter a valid amount.",
    min: 0,
  }),
  decorationPrice: numberField({
    invalidMessage: "Enter a valid amount.",
    min: 0,
  }),

  hasFood: z.boolean(),
  isActive: z.boolean(),

  sortOrder: numberField({
    invalidMessage: "Enter a valid display order.",
    min: 0,
  }),
  footerMessage: z.string().optional(),
  mapUrl: z.string().url().optional().or(z.literal("")),

  images: z.array(z.object({
    url: z.string().min(1, "At least one image required"),
    type: z.enum(["image", "video"]).optional(),
    file: z.instanceof(File).optional(),
    caption: z.string().optional(),
  })).optional(),
  
  menuFile: z.string().optional(),
  cardContent: theatreCardContentSchema.optional(),
});

export type TheatreFormValues = z.infer<typeof theatreSchema>;
