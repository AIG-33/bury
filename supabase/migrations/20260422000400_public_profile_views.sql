-- ============================================================
-- Public, RLS-bypassing views over `profiles`.
--
-- Background. The `profiles_self_read` policy restricts SELECT to
-- `auth.uid() = id OR is_admin()`. That is correct for the raw table
-- (it holds PII like phone, whatsapp, health_notes, emergency_contact,
-- consent timestamps, etc.) but it makes the public coach catalogue
-- on `/coaches` and the reviewer name lookup on `/coaches/[id]`
-- return zero rows for any anonymous or non-admin viewer. The init
-- migration explicitly left a TODO:
--
--   -- public read of safe fields will be done via SECURITY DEFINER view in later migration
--
-- This migration delivers that follow-up.
--
-- Implementation. We expose two views in `public`:
--
--   * `public_coach_directory` — only rows where `is_coach = true`,
--     with the columns required by the coach catalogue, the coach
--     map, and the public coach profile page.
--   * `public_profile_basic`   — id + display_name + avatar_url for
--     ALL profiles. Used to render reviewer cards on a coach profile
--     and any future "by-id name lookup" need.
--
-- Both views are created with `security_invoker = false` (the Postgres
-- default, made explicit here for clarity). That means SELECT against
-- the view runs with the view OWNER's privileges (postgres), so RLS on
-- the underlying `profiles` table is bypassed for the columns the view
-- chooses to expose. PII columns are simply not in the view, so they
-- remain unreadable by anon/authenticated through this surface.
-- ============================================================

drop view if exists public.public_coach_directory;
create view public.public_coach_directory
  with (security_invoker = false) as
select
  p.id,
  p.display_name,
  p.avatar_url,
  p.city,
  p.district_id,
  p.coach_bio,
  p.coach_hourly_rate_pln,
  p.coach_certifications,
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

drop view if exists public.public_profile_basic;
create view public.public_profile_basic
  with (security_invoker = false) as
select
  p.id,
  p.display_name,
  p.avatar_url
from public.profiles p;

comment on view public.public_profile_basic is
  'Minimal public projection of `profiles` (id + display name + avatar) for '
  'cross-user name lookups (e.g. reviewer cards on a coach profile). RLS on '
  '`profiles` is bypassed — only non-PII columns are exposed.';

grant select on public.public_coach_directory to anon, authenticated;
grant select on public.public_profile_basic   to anon, authenticated;
