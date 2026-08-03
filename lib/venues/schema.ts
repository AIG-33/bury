import { z } from "zod";
import { CountryCodeSchema } from "@/lib/geo/countries";

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

// Indoor/outdoor of the venue is *derived* from its courts on the DB side
// (see migration 20260513000500_courts_indoor.sql). Editors set it per-court
// and the venue automatically reflects 'indoor' / 'outdoor' / 'mixed' /
// 'unknown' (no courts yet). Therefore VenueFormSchema does NOT include the
// indoor flag — it would be silently overwritten by the trigger.
export const VenueFormSchema = z.object({
  name: z.string().trim().min(2).max(120),
  city: trimmedNullable,
  country: CountryCodeSchema,
  address: trimmedNullableLong,
  lat,
  lng,
  amenities: z.array(z.enum(VENUE_AMENITIES)).default([]),
});

export type VenueForm = z.infer<typeof VenueFormSchema>;

export const VENUE_INDOOR_STATUSES = ["indoor", "outdoor", "mixed", "unknown"] as const;
export type VenueIndoorStatus = (typeof VENUE_INDOOR_STATUSES)[number];

export const COURT_SURFACES = ["hard", "clay", "grass", "carpet"] as const;
export type CourtSurface = (typeof COURT_SURFACES)[number];

export const COURT_STATUSES = ["active", "maintenance"] as const;
export type CourtStatus = (typeof COURT_STATUSES)[number];

export const CourtFormSchema = z.object({
  number: z.coerce.number().int().min(1).max(99),
  name: trimmedNullable,
  surface: z.enum(COURT_SURFACES).optional().nullable(),
  status: z.enum(COURT_STATUSES).default("active"),
  is_indoor: z.boolean().default(false),
});

export type CourtForm = z.infer<typeof CourtFormSchema>;

// =============================================================================
// User-created venues («Добавить площадку»).
//
// Any authenticated user may add a venue with its courts; the creator can
// edit their own venue later (RLS: venues.created_by = auth.uid()). Unlike
// the admin dialog, the public form manages courts inline, so the schema
// carries a courts array. Court `id` is present for rows that already exist
// (edit flow) and absent for new ones.
// =============================================================================

// Accepts string | null | undefined | "" and normalizes blanks to null —
// the edit flow feeds DB values (nullable) back through the same schema.
const nullableTrimmed = (max: number) =>
  z.preprocess(
    (v) => (v == null ? null : v),
    z
      .string()
      .trim()
      .max(max)
      .transform((s) => (s.length > 0 ? s : null))
      .nullable(),
  );

const websiteNullable = nullableTrimmed(300).refine(
  (v) => v === null || /^https?:\/\/\S+\.\S+/.test(v),
  { message: "invalid_website" },
);

const photoUrlNullable = nullableTrimmed(600).refine((v) => v === null || /^https:\/\//.test(v), {
  message: "invalid_photo_url",
});

export const UserVenueCourtSchema = z.object({
  id: z.string().uuid().optional().nullable(),
  number: z.coerce.number().int().min(1).max(99),
  name: nullableTrimmed(200),
  surface: z.enum(COURT_SURFACES).optional().nullable(),
  is_indoor: z.boolean().default(false),
});

export type UserVenueCourt = z.infer<typeof UserVenueCourtSchema>;

export const UserVenueFormSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    city: nullableTrimmed(200),
    country: CountryCodeSchema,
    address: nullableTrimmed(2000),
    lat,
    lng,
    amenities: z.array(z.enum(VENUE_AMENITIES)).default([]),
    website: websiteNullable,
    phone: nullableTrimmed(50),
    photo_url: photoUrlNullable,
    courts: z.array(UserVenueCourtSchema).max(40).default([]),
  })
  .superRefine((v, ctx) => {
    const numbers = v.courts.map((c) => c.number);
    if (new Set(numbers).size !== numbers.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["courts"],
        message: "duplicate_court_numbers",
      });
    }
  });

export type UserVenueForm = z.infer<typeof UserVenueFormSchema>;

// =============================================================================
// Venue comments («Заметили неточность? Напишите»).
// =============================================================================

export const VENUE_COMMENT_MIN = 3;
export const VENUE_COMMENT_MAX = 1000;

export const VenueCommentSchema = z.object({
  venue_id: z.string().uuid(),
  body: z.string().trim().min(VENUE_COMMENT_MIN).max(VENUE_COMMENT_MAX),
});

export type VenueCommentInput = z.infer<typeof VenueCommentSchema>;
