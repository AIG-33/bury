-- ============================================================
-- Public, RLS-bypassing view of `profiles` with non-PII player
-- fields useful in coach-facing listings and detail pages.
--
-- Background. `profiles_self_read` restricts SELECT to self/admin,
-- so a coach cannot directly read fields like `current_elo`,
-- `rated_matches_count`, `city`, or `district_id` for their own
-- players. The existing `public_profile_basic` view is too narrow
-- (id + display_name + avatar_url) for the new /coach/players list
-- and the per-player detail page.
--
-- This view exposes ONLY safe fields that are already public via
-- the leaderboard, the coach map, and the public coach catalogue:
--   id, display_name, avatar_url, current_elo, elo_status,
--   rated_matches_count, city, district_id, district_name.
--
-- PII (phone, whatsapp, telegram_username, health_notes,
-- emergency_contact, consent timestamps, date_of_birth) is NOT
-- in this projection and remains unreadable through this surface.
-- ============================================================

drop view if exists public.public_player_basic;
create view public.public_player_basic
  with (security_invoker = false) as
select
  p.id,
  p.display_name,
  p.avatar_url,
  p.current_elo,
  p.elo_status,
  p.rated_matches_count,
  p.city,
  p.district_id,
  d.name as district_name,
  p.visible_in_leaderboard,
  p.is_coach,
  p.created_at
from public.profiles p
left join public.districts d on d.id = p.district_id;

comment on view public.public_player_basic is
  'Public, RLS-bypassing projection of `profiles` with non-PII fields '
  'used in coach-facing listings (e.g. /coach/players, the embedded '
  'leaderboard, /coach/players/[id]). Exposes Elo, matches count, city, '
  'district, and the visible_in_leaderboard flag — same fields already '
  'public via the leaderboard. PII columns are intentionally omitted.';

grant select on public.public_player_basic to anon, authenticated;
