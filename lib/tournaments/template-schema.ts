import { z } from "zod";
import { TournamentFormSchema, type TournamentForm } from "./schema";

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
// =============================================================================

export const TournamentTemplatePayloadSchema = TournamentFormSchema.omit({
  name: true,
  starts_on: true,
  ends_on: true,
  registration_deadline: true,
  club_id: true,
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
 * schemas drop unknown keys on parse, so the omitted fields fall away. */
export function templatePayloadFromForm(form: TournamentForm): TournamentTemplatePayload {
  return TournamentTemplatePayloadSchema.parse(form);
}

/**
 * Expand a template into a ready-to-edit create form. The tournament name
 * defaults to the template name; dates start blank except `starts_on`
 * (defaults to today so the date picker has a sane anchor).
 */
export function formFromTemplatePayload(args: {
  templateName: string;
  payload: TournamentTemplatePayload;
  clubId: string | null;
  startsOn?: string;
}): TournamentForm {
  return {
    ...args.payload,
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
