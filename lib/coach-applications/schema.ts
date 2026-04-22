import { z } from "zod";

// =============================================================================
// Coach application — schema shared by client form and server actions.
//
// One row in `public.coach_applications`:
//   * `message`      — free text from the player (≥ 30 chars so we don't
//                      get one-word "pls let me coach" submissions)
//   * `attachments`  — JSONB array, each item describes a file in the
//                      private `coach-applications` storage bucket
// =============================================================================

export const COACH_APPLICATION_STATUSES = [
  "pending",
  "approved",
  "rejected",
] as const;
export type CoachApplicationStatus =
  (typeof COACH_APPLICATION_STATUSES)[number];

// Limits — kept in one place so the UI hint and the server action agree.
export const COACH_APPLICATION_LIMITS = {
  message_min: 30,
  message_max: 4000,
  attachments_max: 5,
  file_max_bytes: 10 * 1024 * 1024,
  allowed_mime_types: [
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/webp",
  ] as const,
};

export const CoachApplicationAttachmentSchema = z.object({
  // Storage path inside the `coach-applications` bucket.
  // Always shaped as <player_id>/<application_id>/<filename>; we keep
  // the player_id prefix because storage RLS checks the first folder.
  path: z.string().min(1).max(512),
  name: z.string().min(1).max(255),
  size: z.number().int().min(0).max(COACH_APPLICATION_LIMITS.file_max_bytes),
  mime_type: z.string().min(1).max(100),
});

export type CoachApplicationAttachment = z.infer<
  typeof CoachApplicationAttachmentSchema
>;

export const CoachApplicationFormSchema = z.object({
  message: z
    .string()
    .trim()
    .min(COACH_APPLICATION_LIMITS.message_min, "message_too_short")
    .max(COACH_APPLICATION_LIMITS.message_max, "message_too_long"),
  attachments: z
    .array(CoachApplicationAttachmentSchema)
    .max(COACH_APPLICATION_LIMITS.attachments_max, "too_many_files"),
});

export type CoachApplicationForm = z.infer<typeof CoachApplicationFormSchema>;

export const CoachApplicationDecisionSchema = z.object({
  application_id: z.string().uuid(),
  decision: z.enum(["approved", "rejected"]),
  // Required for "rejected" so the player gets a reason; optional for
  // "approved" so admins can leave a welcome note.
  admin_comment: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .nullable()
    .transform((v) => (v && v.length > 0 ? v : null)),
});

export type CoachApplicationDecision = z.infer<
  typeof CoachApplicationDecisionSchema
>;
