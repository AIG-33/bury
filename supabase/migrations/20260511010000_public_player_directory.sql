-- ============================================================
-- Public player directory — RLS-bypassing read-only view.
--
-- Why this exists.
-- The `find a sparring partner` flow lives behind login at `/me/find`,
-- which means anonymous visitors landing on the homepage have no way
-- to see real opponents before they register. This is the biggest
-- conversion drop on the public funnel: people don't trust empty
-- promises ("we'll match you"), they want to *see* the player base.
--
-- We expose a `public_player_directory` view, mirroring the existing
-- `public_coach_directory` pattern (see
-- `20260422000400_public_profile_views.sql`):
--
--   * `with (security_invoker = false)` — Postgres default, made
--     explicit. SELECT through the view runs with the OWNER's
--     privileges, so RLS on `profiles` is bypassed. PII columns
--     (phone, whatsapp, telegram_username, social_links, email_local,
--     health_notes, emergency_contact, consent_*, locale, etc.) are
--     simply omitted — they remain unreachable through this surface.
--   * `where visible_in_find_player = true` — the existing privacy
--     toggle on `profiles`. Players who opted out of being listed in
--     find-a-partner are also hidden here.
--
-- The view is granted to `anon` and `authenticated`. Authenticated users
-- continue to use the richer `/me/find` endpoint (with availability
-- overlap and pending-proposal exclusion) — this view is just a public
-- shop window so guests can decide to register.
-- ============================================================

begin;

drop view if exists public.public_player_directory;
create view public.public_player_directory
  with (security_invoker = false) as
select
  p.id,
  p.display_name,
  p.avatar_url,
  p.city,
  p.district_id,
  p.dominant_hand,
  p.backhand_style,
  p.favorite_surface,
  p.current_elo,
  p.elo_status,
  p.rated_matches_count,
  p.availability,
  p.last_match_at,
  p.is_coach,
  p.created_at
from public.profiles p
where p.visible_in_find_player = true;

comment on view public.public_player_directory is
  'Public, RLS-bypassing projection of `profiles` filtered by '
  '`visible_in_find_player = true`. Exposes only fields safe for '
  'unauthenticated viewers (no phone, no whatsapp, no telegram, no '
  'social_links, no email, no health notes, no consent timestamps). '
  'Used by the public /players catalogue so guests can see the player '
  'base before registering.';

grant select on public.public_player_directory to anon, authenticated;

commit;
