import { z } from "zod";

export const SLOT_TYPES = ["individual", "pair", "group"] as const;
export type SlotType = (typeof SLOT_TYPES)[number];

export const SLOT_STATUSES = ["open", "closed", "cancelled"] as const;
export type SlotStatus = (typeof SLOT_STATUSES)[number];

export const BOOKING_STATUSES = [
  "pending",
  "confirmed",
  "cancelled",
  "attended",
  "no_show",
] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export const PAID_STATUSES = ["unpaid", "paid", "comped"] as const;
export type PaidStatus = (typeof PAID_STATUSES)[number];

const optionalNullableInt = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? null : Number(v)),
  z.number().int().min(0).max(100000).nullable(),
);

// Accepts null / undefined / "" / "  " / a real string. Always returns
// either a trimmed non-empty string or `null` so the DB column stays clean.
// IMPORTANT: react-hook-form keeps a default of `null` for unfilled fields,
// so we MUST tolerate null at parse time (otherwise the server returns
// invalid_payload while the client passes the same schema thanks to RHF
// reading the empty DOM input as "").
const optionalText = z.preprocess(
  (v) => {
    if (v === null || v === undefined) return null;
    if (typeof v !== "string") return null;
    const t = v.trim();
    return t.length === 0 ? null : t;
  },
  z.string().max(2000).nullable(),
);

// Mon=1 ... Sun=7 (ISO weekday).
export const ISO_WEEKDAYS = [1, 2, 3, 4, 5, 6, 7] as const;
export type IsoWeekday = (typeof ISO_WEEKDAYS)[number];

const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "expected YYYY-MM-DD");

const timeString = z
  .string()
  .regex(/^\d{2}:\d{2}$/, "expected HH:MM");

/**
 * Common form payload for creating slots. We accept two shapes:
 *   - kind = "single":   one date + one time
 *   - kind = "weekly":   start_date + N weeks + array of weekdays
 *
 * On the server we expand both into one or more concrete (starts_at, ends_at)
 * tuples bound to a court, and insert them with conflict detection done by
 * Postgres EXCLUDE … gist.
 */
export const SlotFormSchema = z.object({
  court_id: z.string().uuid(),
  start_time: timeString,
  duration_minutes: z.coerce.number().int().min(15).max(480),
  slot_type: z.enum(SLOT_TYPES).default("individual"),
  max_participants: z.coerce.number().int().min(1).max(20),
  price_pln: optionalNullableInt,
  notes: optionalText,
  recurrence: z.discriminatedUnion("kind", [
    z.object({
      kind: z.literal("single"),
      date: dateString,
    }),
    z.object({
      kind: z.literal("weekly"),
      start_date: dateString,
      weeks: z.coerce.number().int().min(1).max(52),
      // Array of ISO weekdays (1=Mon … 7=Sun).
      weekdays: z
        .array(
          z.coerce
            .number()
            .int()
            .min(1)
            .max(7)
            .transform((n) => n as IsoWeekday),
        )
        .min(1)
        .max(7),
    }),
    z.object({
      kind: z.literal("dates"),
      // Explicit list of local dates (Europe/Warsaw). The UI lets a coach
      // pick a date range, optionally filter by weekday, and add/remove
      // individual days. Capped at 90 to keep the batch insert sane.
      dates: z
        .array(dateString)
        .min(1)
        .max(90)
        .transform((arr) => Array.from(new Set(arr)).sort()),
    }),
  ]),
});

export type SlotForm = z.infer<typeof SlotFormSchema>;

export const BookingFormSchema = z.object({
  slot_id: z.string().uuid(),
  notes: optionalText,
});

export type BookingForm = z.infer<typeof BookingFormSchema>;
