import { z } from "zod";

// =============================================================================
// Coach-only profile schema. Lives next to the player schema so it can be
// versioned independently and persisted via a dedicated server action.
//
// We deliberately do NOT collect a coach map pin here: discovery happens
// through published slots (which already carry the venue/court location), so
// a separate coach pin would be a second source of truth that drifts from
// reality. Columns coach_lat/coach_lng/coach_show_on_map are kept in the DB
// for backwards compatibility with old data and the legacy /coaches/map
// page, but no UI writes them anymore.
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

export const CoachProfileFormSchema = z.object({
  coach_bio: trimmedNullable,
  coach_hourly_rate_pln: optionalNumber.refine(
    (v) => v === null || (v >= 0 && v <= 10000),
    { message: "rate_out_of_range" },
  ),
});

export type CoachProfileForm = z.infer<typeof CoachProfileFormSchema>;
