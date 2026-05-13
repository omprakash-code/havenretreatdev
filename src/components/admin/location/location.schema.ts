import { z } from "zod";

export const locationSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Location name must be at least 2 characters.")
    .max(80, "Location name must be at most 80 characters."),
  city: z
    .string()
    .trim()
    .min(2, "City must be at least 2 characters.")
    .max(80, "City must be at most 80 characters."),
  sortOrder: z
    .number({ message: "Sort order must be a number." })
    .int("Sort order must be an integer.")
    .min(0, "Sort order cannot be negative.")
    .max(10000, "Sort order is too high."),
  isActive: z.boolean(),
});

export type LocationFormValues = z.infer<typeof locationSchema>;
