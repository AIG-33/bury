import { z } from "zod";
import { TournamentFormSchema, type TournamentForm } from "./schema";
import {
  TournamentBrandingSchema,
  DEFAULT_TOURNAMENT_BRANDING,
  type TournamentBranding,
} from "@/lib/validators/tournament-branding";

// =============================================================================
// Tournament templates — the JSONB payload stored in
// `tournament_templates.payload` (AGENTS.md §7: every JSONB column has a Zod
// schema). The payload is the create-tournament form minus everything that is
// specific to one run:
//   * name                  — the template's own name doubles as the default
//                             tournament name;
//   * starts_on / ends_on / registration_deadline — every run picks fresh dates;
//   * club_id               — the club binding lives on the template ROW
//                             (shared with club co-admins), not in the payload.
// `start_time` stays: league stages usually run at the same hour every week.
//
// On top of the form fields the payload carries the tournament's `branding`
// (logo, banner, colors, theme, sponsors, …) so a template reproduces the
// public page look, not just the settings. Image URLs point at the public
// `tournament-branding` bucket and stay valid across tournaments. Templates
// saved before branding existed simply lack the key — the `.default(...)`
// keeps them parseable (they expand with a clean default look).
// =============================================================================

export const TournamentTemplatePayloadSchema = TournamentFormSchema.omit({
  name: true,
  starts_on: true,
  ends_on: true,
  registration_deadline: true,
  club_id: true,
}).extend({
  branding: TournamentBrandingSchema.default(DEFAULT_TOURNAMENT_BRANDING),
});

export type TournamentTemplatePayload = z.infer<typeof TournamentTemplatePayloadSchema>;

/** Input of the "save as template" Server Action. */
export const SaveTemplateSchema = z.object({
  name: z.string().trim().min(2).max(120),
  club_id: z
    .preprocess((v) => (v == null || v === "" ? null : v), z.string().uuid().nullable())
    .default(null),
  payload: TournamentTemplatePayloadSchema,
});

export type SaveTemplateInput = z.infer<typeof SaveTemplateSchema>;

/** Strip run-specific fields from a filled tournament form. Zod object
 * schemas drop unknown keys on parse, so the omitted fields fall away.
 * `branding` is not part of the form (it has its own editor) — pass it
 * alongside so the template captures the page look too. */
export function templatePayloadFromForm(
  form: TournamentForm,
  branding?: TournamentBranding,
): TournamentTemplatePayload {
  return TournamentTemplatePayloadSchema.parse({
    ...form,
    branding: branding ?? DEFAULT_TOURNAMENT_BRANDING,
  });
}

/**
 * Expand a template into a ready-to-edit create form. The tournament name
 * defaults to the template name; dates start blank except `starts_on`
 * (defaults to today so the date picker has a sane anchor). `branding` is
 * intentionally NOT part of the returned form — read it from the payload
 * (`payload.branding`) and pass it to the create action separately.
 */
export function formFromTemplatePayload(args: {
  templateName: string;
  payload: TournamentTemplatePayload;
  clubId: string | null;
  startsOn?: string;
}): TournamentForm {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { branding, ...formFields } = args.payload;
  return {
    ...formFields,
    name: args.templateName,
    starts_on: args.startsOn ?? new Date().toISOString().slice(0, 10),
    ends_on: null,
    registration_deadline: null,
    club_id: args.clubId,
  };
}

/**
 * Parse a payload read back from the DB. Tolerant entry point for rows
 * written by older app versions: returns null when the payload no longer
 * matches the schema instead of throwing.
 */
export function templatePayloadFromRow(raw: unknown): TournamentTemplatePayload | null {
  const parsed = TournamentTemplatePayloadSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}
