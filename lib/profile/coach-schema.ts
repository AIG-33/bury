import { z } from "zod";

// =============================================================================
// Coach-only profile schema. Lives next to the player schema so it can be
// versioned independently and persisted via a dedicated server action.
// =============================================================================

const trimmedNullable = z
  .string()
  .trim()
  .max(2000)
  .optional()
  .or(z.literal(""))
  .transform((v) => (v && v.length > 0 ? v : null));

const optionalNumber = z
  .union([z.number(), z.string().trim().min(1)])
  .optional()
  .nullable()
  .transform((v) => {
    if (v === undefined || v === null || v === "") return null;
    const n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) ? n : null;
  });

export const CoachProfileFormSchema = z
  .object({
    coach_bio: trimmedNullable,
    coach_hourly_rate_pln: optionalNumber.refine(
      (v) => v === null || (v >= 0 && v <= 10000),
      { message: "rate_out_of_range" },
    ),
    coach_lat: optionalNumber.refine(
      (v) => v === null || (v >= -90 && v <= 90),
      { message: "lat_out_of_range" },
    ),
    coach_lng: optionalNumber.refine(
      (v) => v === null || (v >= -180 && v <= 180),
      { message: "lng_out_of_range" },
    ),
    coach_show_on_map: z.boolean(),
  })
  .superRefine((data, ctx) => {
    const oneSet =
      (data.coach_lat !== null) !== (data.coach_lng !== null);
    if (oneSet) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["coach_lat"],
        message: "latlng_must_be_paired",
      });
    }
  });

export type CoachProfileForm = z.infer<typeof CoachProfileFormSchema>;
