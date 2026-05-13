-- ============================================================
-- DB audit cleanup: drop tables, columns and helper functions
-- that nothing in the application reads or writes.
--
-- Scope of this migration is exclusively *removal* of objects
-- that were either left over from earlier product directions
-- (e.g. the original Polish "club + slot template" idea) or
-- replaced in code without anyone deleting the SQL artifact.
--
-- Every object below was grepped against the entire codebase
-- (app/, lib/, components/) before being included; the only
-- references found were in:
--
--   * `lib/admin/tables.ts`  — admin DB editor whitelist (updated
--                              in the same PR);
--   * `lib/supabase/types.ts` — handcrafted types (updated too);
--   * documentation under `docs/` — left alone (historical).
--
-- Forward-only per AGENTS.md §3.9. No data is destroyed beyond
-- what's already orphaned (unused junction columns, all-NULL
-- system columns, an audit log nobody writes to, etc).
--
-- The mapping is:
--
--   1) Drop the public_coach_directory view first — it depends
--      on profiles.coach_certifications which we drop further
--      down. Recreated at the end without the dropped column.
--
--   2) Drop SECURITY DEFINER helpers `accept_invitation` and
--      `recalc_match_elo`: both are re-implemented in Server
--      Actions (`app/[locale]/invite/[token]/actions.ts` and
--      `lib/rating/recalc.ts` respectively). The DB copies
--      have been dead since those files landed.
--
--   3) Drop the redundant index `tp_tournament_idx`: it covers
--      (tournament_id), which is a strict prefix of the existing
--      composite index `tp_tournament_status_idx (tournament_id,
--      status)`. Postgres will use the composite for either query.
--
--   4) Drop unused profile columns: `consent_terms_at`,
--      `consent_privacy_at`, `coach_certifications`. None of them
--      have ever been written by the app (see grep above).
--
--   5) Drop unused `slots.template_id` (always NULL) so we can
--      drop the `slot_templates` table itself in step 9.
--
--   6) Drop unused tournament columns: `club_id`, `scoring_rules`,
--      `cover_url`. The "club" relation was never wired up; the
--      product uses `tournament_venues` instead. `scoring_rules`
--      and `cover_url` have never been read.
--
--   7) Drop `venues.club_id` for the same reason.
--
--   8) Drop dead tables: `audit_log`, `telegram_links`,
--      `slot_templates`, `clubs`. None are read or written by
--      app code; their schemas show up only in the admin DB
--      editor whitelist (updated in the same PR).
--
--   9) Recreate `public_coach_directory` view minus the dropped
--      `coach_certifications` projection.
-- ============================================================

begin;

-- ------------------------------------------------------------
-- 1) Drop dependent view first; recreated in step 9 below.
-- ------------------------------------------------------------
drop view if exists public.public_coach_directory;

-- ------------------------------------------------------------
-- 2) Drop SECURITY DEFINER helpers replaced by TS code.
-- ------------------------------------------------------------
drop function if exists public.accept_invitation(text, uuid);
drop function if exists public.recalc_match_elo(uuid);

-- ------------------------------------------------------------
-- 3) Drop the redundant single-column index. The composite
--    `tp_tournament_status_idx (tournament_id, status)` covers
--    every query that hits `tournament_id` alone.
-- ------------------------------------------------------------
drop index if exists public.tp_tournament_idx;

-- ------------------------------------------------------------
-- 4) Profile columns that are no longer read or written.
--
--    * consent_terms_at / consent_privacy_at — the original
--      schema reserved these for a future GDPR consent log;
--      the consent dialog landed as session-time middleware
--      and never touched profiles. The fields stayed empty
--      forever.
--
--    * coach_certifications — JSONB list of certificates.
--      Was rendered on a long-removed coach profile draft;
--      the current `/coach/profile` form does not edit it
--      and the public coach card does not show it.
-- ------------------------------------------------------------
alter table public.profiles
  drop column if exists consent_terms_at,
  drop column if exists consent_privacy_at,
  drop column if exists coach_certifications;

-- ------------------------------------------------------------
-- 5) Drop slots.template_id (always NULL), so slot_templates
--    has no remaining FK references.
-- ------------------------------------------------------------
alter table public.slots
  drop column if exists template_id;

-- ------------------------------------------------------------
-- 6) Tournament columns that nothing in the app uses.
--
--    * club_id — the `clubs` table is going away (step 8).
--      `tournament_venues` is the actual venue relationship.
--
--    * scoring_rules — JSONB (win/loss/walkover points). Round-
--      robin standings derive from match outcomes directly;
--      this column has never been read.
--
--    * cover_url — placeholder for a hero image. No upload
--      surface, no display, no use.
-- ------------------------------------------------------------
alter table public.tournaments
  drop column if exists club_id,
  drop column if exists scoring_rules,
  drop column if exists cover_url;

-- ------------------------------------------------------------
-- 7) venues.club_id — same logic as tournaments.club_id.
-- ------------------------------------------------------------
alter table public.venues
  drop column if exists club_id;

-- ------------------------------------------------------------
-- 8) Drop dead tables.
--
--    * audit_log — schema-only; the app never inserts into it
--      and there is no admin UI to read from it. Real audits
--      (admin coach approvals, tournament status changes) are
--      written into the relevant business tables (decided_by,
--      decided_at, ...).
--
--    * telegram_links — placeholder for the unbuilt Telegram
--      bot. Drops cleanly because nothing references it.
--
--    * slot_templates — the original "RRULE template + on-demand
--      materialised occurrences" plan was simplified to "expand
--      the RRULE in TS and insert each slot directly" (see
--      `app/[locale]/(coach)/coach/slots/actions.ts`). The
--      templates table never received a write.
--
--    * clubs — owners listed venues/tournaments under a
--      "club" entity that the product never grew into. Real
--      ownership is on `venues.owner_id` (admins) and
--      `tournaments.owner_id` (any user).
-- ------------------------------------------------------------
drop table if exists public.audit_log;
drop table if exists public.telegram_links;
drop table if exists public.slot_templates;
drop table if exists public.clubs;

-- ------------------------------------------------------------
-- 9) Recreate the public coach directory view minus the dropped
--    `coach_certifications` column.
-- ------------------------------------------------------------
create view public.public_coach_directory
  with (security_invoker = false) as
select
  p.id,
  p.display_name,
  p.avatar_url,
  p.city,
  p.district_id,
  p.coach_bio,
  p.coach_hourly_rate_byn,
  p.coach_avg_rating,
  p.coach_reviews_count,
  p.coach_slug,
  p.coach_lat,
  p.coach_lng,
  p.coach_show_on_map,
  p.is_coach,
  p.created_at
from public.profiles p
where p.is_coach = true;

comment on view public.public_coach_directory is
  'Public, RLS-bypassing projection of `profiles` restricted to coaches. '
  'Exposes only fields safe for unauthenticated viewers (no phone, no whatsapp, '
  'no contact PII, no health notes). Used by the public /coaches catalogue.';

grant select on public.public_coach_directory to anon, authenticated;

commit;
