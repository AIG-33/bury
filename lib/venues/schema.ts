import { z } from "zod";

const trimmedNullable = z
  .string()
  .trim()
  .max(200)
  .optional()
  .or(z.literal(""))
  .transform((v) => (v && v.length > 0 ? v : null));

const trimmedNullableLong = z
  .string()
  .trim()
  .max(2000)
  .optional()
  .or(z.literal(""))
  .transform((v) => (v && v.length > 0 ? v : null));

const lat = z
  .preprocess(
    (v) => (v === "" || v === null || v === undefined ? null : Number(v)),
    z.number().min(-90).max(90).nullable(),
  )
  .nullable();

const lng = z
  .preprocess(
    (v) => (v === "" || v === null || v === undefined ? null : Number(v)),
    z.number().min(-180).max(180).nullable(),
  )
  .nullable();

export const VENUE_AMENITIES = [
  "indoor",
  "outdoor",
  "lights",
  "shower",
  "lockers",
  "parking",
  "shop",
  "wifi",
  "cafe",
  "bathrooms",
] as const;

export type VenueAmenity = (typeof VENUE_AMENITIES)[number];

export const VenueFormSchema = z.object({
  name: z.string().trim().min(2).max(120),
  city: trimmedNullable,
  district_id: z.string().uuid().optional().nullable(),
  address: trimmedNullableLong,
  lat,
  lng,
  is_indoor: z.boolean().default(false),
  amenities: z.array(z.enum(VENUE_AMENITIES)).default([]),
});

export type VenueForm = z.infer<typeof VenueFormSchema>;

export const COURT_SURFACES = ["hard", "clay", "grass", "carpet"] as const;
export type CourtSurface = (typeof COURT_SURFACES)[number];

export const COURT_STATUSES = ["active", "maintenance"] as const;
export type CourtStatus = (typeof COURT_STATUSES)[number];

export const CourtFormSchema = z.object({
  number: z.coerce.number().int().min(1).max(99),
  name: trimmedNullable,
  surface: z.enum(COURT_SURFACES).optional().nullable(),
  status: z.enum(COURT_STATUSES).default("active"),
});

export type CourtForm = z.infer<typeof CourtFormSchema>;
