import { z } from "zod";

// ─── Catalogue values ────────────────────────────────────────────────────────

export const JOIN_POLICIES = ["approval", "open", "closed"] as const;
export type JoinPolicy = (typeof JOIN_POLICIES)[number];

export const MEMBER_STATUSES = ["pending", "approved", "rejected"] as const;
export type MemberStatus = (typeof MEMBER_STATUSES)[number];

export const MEMBER_ROLES = ["member", "admin"] as const;
export type MemberRole = (typeof MEMBER_ROLES)[number];

// ─── Reusable preprocessors (mirroring lib/tournaments/schema.ts) ────────────

const optionalText = (max = 4000) =>
  z.preprocess((v) => {
    if (v == null) return null;
    if (typeof v !== "string") return v;
    const trimmed = v.trim();
    return trimmed.length === 0 ? null : trimmed;
  }, z.string().max(max).nullable());

// ─── Club forms ──────────────────────────────────────────────────────────────

// Slug: lowercase a-z, digits, dashes; 3-40 chars; cannot start/end with `-`.
// Generated from the name when the user leaves it empty.
const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, "slug_too_short")
  .max(40, "slug_too_long")
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "slug_invalid");

export const ClubFormSchema = z.object({
  name: z.string().trim().min(2, "name_too_short").max(80, "name_too_long"),
  slug: slugSchema,
  description: optionalText(4000),
  logo_url: optionalText(500),
  city: optionalText(80),
  district_id: z.preprocess(
    (v) => (v == null || v === "" ? null : v),
    z.string().uuid().nullable(),
  ),
  join_policy: z.enum(JOIN_POLICIES).default("approval"),
});

export type ClubForm = z.infer<typeof ClubFormSchema>;

// Apply-to-join: optional message + optional `make_primary` flag.
export const ApplyToClubSchema = z.object({
  club_id: z.string().uuid(),
  message: optionalText(1000),
  make_primary: z.boolean().optional().default(false),
});
export type ApplyToClub = z.infer<typeof ApplyToClubSchema>;

// Owner / co-admin decision on a pending application.
export const DecideApplicationSchema = z.object({
  member_id: z.string().uuid(),
  decision: z.enum(["approved", "rejected"]),
  reason: optionalText(500),
});
export type DecideApplication = z.infer<typeof DecideApplicationSchema>;

// Owner promotes/demotes a co-admin.
export const SetMemberRoleSchema = z.object({
  member_id: z.string().uuid(),
  role: z.enum(MEMBER_ROLES),
});
export type SetMemberRole = z.infer<typeof SetMemberRoleSchema>;

// Owner manually adds an already-approved player (used by `closed` clubs and
// as a one-click "add" for friends/regulars).
export const AddMemberSchema = z.object({
  club_id: z.string().uuid(),
  user_id: z.string().uuid(),
  role: z.enum(MEMBER_ROLES).default("member"),
});
export type AddMember = z.infer<typeof AddMemberSchema>;

// Invite-token regeneration. Expiry is in DAYS; 0 / null = never expires
// (we never literally store NULL — the SA picks a far-future date when 0).
export const InviteTokenSchema = z.object({
  club_id: z.string().uuid(),
  expires_in_days: z.coerce.number().int().min(0).max(365).default(30),
});
export type InviteTokenInput = z.infer<typeof InviteTokenSchema>;

// Ownership transfer — two-step. First step: propose.
export const ProposeOwnershipSchema = z.object({
  club_id: z.string().uuid(),
  new_owner_id: z.string().uuid(),
});
export type ProposeOwnership = z.infer<typeof ProposeOwnershipSchema>;
