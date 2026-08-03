-- ============================================================
-- Country instead of district.
--
-- Product decision: the «Район» (district) field turned out to be useless —
-- players pick a venue, not an administrative district. The UI replaces the
-- district input with a Country select (ISO alpha-2, default 'BY') and adds
-- country filters to the players / clubs / venues / open-matches catalogues.
--
-- This migration is forward-only and non-destructive:
--   * `district_id` columns and the `districts` table stay untouched —
--     existing data is preserved, the app simply stops writing them.
--   * `profiles.country` and `venues.country` already exist (init +
--     20260510000000_belarus_relocation); we only add `clubs.country`.
--   * B-tree indexes back the new catalogue filters.
--   * `public_player_directory` gains the `country` column (appended last,
--     so CREATE OR REPLACE is allowed and existing consumers are unaffected).
--   * `open_matches_feed` gains `country` = venue country, falling back to
--     the legacy district's country for old venue-less posts.
--
-- RLS: no policy changes needed — we only add columns to tables that already
-- have RLS enabled, and the views keep their existing grants.
-- ============================================================

begin;

-- ----------------------------------------------------------------
-- 1. clubs.country — the only entity that had no country column.
-- ----------------------------------------------------------------
alter table public.clubs
  add column if not exists country text not null default 'BY';

comment on column public.clubs.country is
  'ISO 3166-1 alpha-2 country code. Default BY (Belarus).';

-- ----------------------------------------------------------------
-- 2. Filter indexes.
-- ----------------------------------------------------------------
create index if not exists profiles_country_idx on public.profiles (country);
create index if not exists venues_country_idx   on public.venues (country);
create index if not exists clubs_country_idx    on public.clubs (country);

-- ----------------------------------------------------------------
-- 3. public_player_directory: expose `country` for the public
--    /players catalogue filter. Column appended last so
--    CREATE OR REPLACE keeps the existing column order.
-- ----------------------------------------------------------------
create or replace view public.public_player_directory
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
  p.created_at,
  p.current_elo_doubles,
  p.elo_status_doubles,
  p.rated_matches_count_doubles,
  p.country
from public.profiles p
where p.visible_in_find_player = true;

grant select on public.public_player_directory to anon, authenticated;

-- ----------------------------------------------------------------
-- 4. open_matches_feed: expose `country` (venue country, or the
--    legacy district's country for old venue-less posts) so the
--    sparring feed can be filtered by country.
-- ----------------------------------------------------------------
create or replace view public.open_matches_feed as
select
  om.id,
  om.creator_id,
  pr.display_name        as creator_name,
  pr.avatar_url          as creator_avatar,
  pr.current_elo         as creator_elo,
  pr.elo_status          as creator_elo_status,
  om.venue_id,
  v.name                 as venue_name,
  v.city                 as venue_city,
  v.is_indoor            as venue_is_indoor,
  v.indoor_status        as venue_indoor_status,
  om.district_id,
  d.name                 as district_name,
  om.starts_at,
  om.duration_min,
  om.format,
  om.level_band,
  om.slots_needed,
  om.notes,
  om.status,
  om.created_at,
  (
    select count(*)
    from public.open_match_applications a
    where a.open_match_id = om.id and a.status = 'pending'
  ) as pending_applications_count,
  (
    select count(*)
    from public.open_match_applications a
    where a.open_match_id = om.id and a.status = 'accepted'
  ) as accepted_applications_count,
  coalesce(v.country, d.country, 'BY') as country
from public.open_matches om
join public.profiles pr on pr.id = om.creator_id
left join public.venues    v on v.id = om.venue_id
left join public.districts d on d.id = om.district_id;

comment on view public.open_matches_feed is
  'Denormalized feed for the public Open Matches list and venue tabs. RLS is '
  'inherited from open_matches and profiles via the security_invoker default.';

grant select on public.open_matches_feed to anon, authenticated;

-- ----------------------------------------------------------------
-- 5. public_player_basic: expose `country` (appended last) so the
--    coach area can show a player's country instead of the legacy
--    district. Existing columns keep their positions.
-- ----------------------------------------------------------------
create or replace view public.public_player_basic
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
  p.created_at,
  p.current_elo_doubles,
  p.elo_status_doubles,
  p.rated_matches_count_doubles,
  p.country
from public.profiles p
left join public.districts d on d.id = p.district_id;

grant select on public.public_player_basic to anon, authenticated;

commit;
