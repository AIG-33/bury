-- ============================================================
-- Club page branding — parity with tournament branding.
--
-- Product shape:
--   Club owners/co-admins can brand the public club page (/clubs/[slug] and
--   /m/clubs/[slug]) the same way tournament organizers brand a tournament
--   room: logo, full-width banner with a scrim, background / accent colors,
--   theme preset, tagline, title override and a sponsor strip (each sponsor
--   with an optional website URL — logos link out).
--
-- Storage decision:
--   ONE JSONB column `clubs.branding`, validated by ClubBrandingSchema
--   (lib/validators/club-branding.ts) — the exact same shape as
--   tournaments.branding, so both surfaces share the render pipeline
--   (lib/tournaments/branding.ts#buildRoomTheme).
--   The legacy `clubs.brand_color` / `clubs.cover_url` columns are kept
--   (forward-only, no destructive edits) and act as fallbacks when the new
--   blob is empty.
--   Uploaded assets reuse the existing `club-logos` bucket under
--   <club_id>/... — its policies already restrict writes to the club's
--   owner / approved co-admins and allow public read.
--
-- RLS:
--   No new table ⇒ no new table policies. `branding` rides on `public.clubs`
--   whose existing policies already enforce public read and owner/admin
--   write. The bucket size limit is raised to 5 MB (banners are larger than
--   logos) — same limit as the tournament-branding bucket.
--
-- Forward-only per AGENTS.md §3.9 — additive only.
-- ============================================================

-- ------------------------------------------------------------
-- 1) branding JSONB column on clubs.
-- ------------------------------------------------------------

alter table public.clubs
  add column if not exists branding jsonb not null default '{}'::jsonb;

-- Guard: branding must be a JSON object (never an array/scalar). The full
-- shape is validated in the app by ClubBrandingSchema.
alter table public.clubs
  drop constraint if exists clubs_branding_is_object;
alter table public.clubs
  add constraint clubs_branding_is_object
  check (jsonb_typeof(branding) = 'object');

comment on column public.clubs.branding is
  'Public club-page branding (logo, banner, colors, theme preset, tagline, '
  'sponsors with optional website URLs, …). Validated by ClubBrandingSchema '
  'in lib/validators/club-branding.ts. Image URLs point at the club-logos '
  'storage bucket.';

-- ------------------------------------------------------------
-- 2) Raise the club-logos bucket size limit for banners (2 MB → 5 MB).
--    Same mime whitelist as before; policies are untouched.
-- ------------------------------------------------------------

update storage.buckets
   set file_size_limit = 5 * 1024 * 1024
 where id = 'club-logos';
