import { z } from "zod";

// =============================================================================
// Profile editing schema (Zod). Mirrors `public.profiles` columns the player
// is allowed to change. Server-side action revalidates against the same shape.
// =============================================================================

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

const phone = z
  .string()
  .trim()
  .max(40)
  .regex(/^[+0-9 ()\-]*$/u, "Invalid phone")
  .optional()
  .or(z.literal(""))
  .transform((v) => (v && v.length > 0 ? v : null));

const isoUrl = z
  .string()
  .trim()
  .url()
  .max(300)
  .optional()
  .or(z.literal(""))
  .transform((v) => (v && v.length > 0 ? v : null));

export const SocialLinksSchema = z.object({
  instagram: isoUrl,
  facebook: isoUrl,
  x: isoUrl,
  tiktok: isoUrl,
  youtube: isoUrl,
  website: isoUrl,
});
export type SocialLinks = z.infer<typeof SocialLinksSchema>;

export const TIME_SLOTS = ["morning", "noon", "afternoon", "evening", "late"] as const;
export const WEEKDAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

export type Availability = Record<
  (typeof WEEKDAYS)[number],
  (typeof TIME_SLOTS)[number][]
>;

export const AvailabilitySchema = z.object({
  mon: z.array(z.enum(TIME_SLOTS)).default([]),
  tue: z.array(z.enum(TIME_SLOTS)).default([]),
  wed: z.array(z.enum(TIME_SLOTS)).default([]),
  thu: z.array(z.enum(TIME_SLOTS)).default([]),
  fri: z.array(z.enum(TIME_SLOTS)).default([]),
  sat: z.array(z.enum(TIME_SLOTS)).default([]),
  sun: z.array(z.enum(TIME_SLOTS)).default([]),
});

export const ProfileFormSchema = z.object({
  // --- Personal ---
  first_name: trimmedNullable,
  last_name: trimmedNullable,
  date_of_birth: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/u)
    .optional()
    .or(z.literal(""))
    .transform((v) => (v && v.length > 0 ? v : null)),
  gender: z.enum(["m", "f", "other"]).optional().nullable(),
  motto: trimmedNullable,
  favorite_player: trimmedNullable,

  // --- Contacts ---
  phone,
  whatsapp: phone,
  telegram_username: z
    .string()
    .trim()
    .max(40)
    .regex(/^@?[A-Za-z0-9_]{3,32}$/u, "Invalid telegram username")
    .optional()
    .or(z.literal(""))
    .transform((v) =>
      v && v.length > 0 ? (v.startsWith("@") ? v.slice(1) : v) : null,
    ),

  // --- Socials ---
  social_links: SocialLinksSchema,

  // --- Location ---
  city: trimmedNullable,
  district_id: z.string().uuid().optional().nullable(),

  // --- Sport prefs ---
  dominant_hand: z.enum(["R", "L"]).optional().nullable(),
  backhand_style: z.enum(["one_handed", "two_handed"]).optional().nullable(),
  favorite_surface: z.enum(["hard", "clay", "grass", "carpet"]).optional().nullable(),

  // --- Availability ---
  availability: AvailabilitySchema,

  // --- Privacy ---
  visible_in_find_player: z.boolean(),
  visible_in_leaderboard: z.boolean(),

  // --- Notifications ---
  // Primary channels: email (automated) + whatsapp (primary contact).
  // Telegram kept as optional secondary.
  notification_email: z.boolean(),
  notification_whatsapp: z.boolean(),
  notification_telegram: z.boolean(),

  // --- Locale ---
  locale: z.enum(["pl", "en", "ru"]),

  // --- Health & emergency (private) ---
  health_notes: trimmedNullableLong,
  emergency_contact: trimmedNullable,
});

export type ProfileForm = z.infer<typeof ProfileFormSchema>;

export const EMPTY_AVAILABILITY: Availability = WEEKDAYS.reduce((acc, d) => {
  acc[d] = [];
  return acc;
}, {} as Availability);

export const EMPTY_SOCIAL_LINKS: SocialLinks = {
  instagram: null,
  facebook: null,
  x: null,
  tiktok: null,
  youtube: null,
  website: null,
};
