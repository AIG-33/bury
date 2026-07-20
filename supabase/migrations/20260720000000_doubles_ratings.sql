-- ============================================================
-- Doubles matches + separate singles/doubles ratings.
--
-- Product shape:
--   * Every player now has TWO internal Elo ratings: singles (the existing
--     profiles.current_elo) and doubles (new profiles.current_elo_doubles).
--     They live on completely separate ladders and never mix.
--   * The same split applies to per-club ratings: club_member_ratings gets a
--     `discipline` dimension, so a player can hold a singles rating and a
--     doubles rating inside every club they belong to.
--   * A doubles match (matches.is_doubles = true with both partner columns
--     set) rates FOUR players: each player's own K-factor is applied to the
--     team-vs-team expected score (team rating = average of the two members).
--   * rating_history / club_rating_history rows carry the discipline so
--     timelines and charts can be filtered per ladder.
--
-- Forward-only. All writes keep flowing through the service role inside
-- Server Actions (lib/rating/recalc.ts + lib/rating/club-recalc.ts).
-- ============================================================

-- ------------------------------------------------------------
-- 1) Global doubles rating on profiles.
-- ------------------------------------------------------------

alter table public.profiles
  add column if not exists current_elo_doubles integer not null default 1000;

alter table public.profiles
  add column if not exists elo_status_doubles text not null default 'provisional'
    check (elo_status_doubles in ('provisional', 'established'));

alter table public.profiles
  add column if not exists rated_matches_count_doubles integer not null default 0;

comment on column public.profiles.current_elo_doubles is
  'Internal DOUBLES Elo. Fully separate ladder from current_elo (singles). '
  'Written only by lib/rating/recalc.ts via the service role.';

create index if not exists profiles_district_elo_doubles_idx
  on public.profiles (district_id, current_elo_doubles);

-- ------------------------------------------------------------
-- 2) Discipline on the global rating history.
-- ------------------------------------------------------------

alter table public.rating_history
  add column if not exists discipline text not null default 'singles'
    check (discipline in ('singles', 'doubles'));

comment on column public.rating_history.discipline is
  'Which ladder this row belongs to. Existing rows predate doubles and are '
  'all singles (the default).';

create index if not exists rating_history_player_discipline_idx
  on public.rating_history (player_id, discipline, created_at);

-- ------------------------------------------------------------
-- 3) Discipline on per-club ratings.
-- ------------------------------------------------------------

alter table public.club_member_ratings
  add column if not exists discipline text not null default 'singles'
    check (discipline in ('singles', 'doubles'));

-- One row per (club, player) becomes one row per (club, player, discipline).
alter table public.club_member_ratings
  drop constraint if exists club_member_ratings_club_id_player_id_key;

create unique index if not exists club_member_ratings_club_player_discipline_key
  on public.club_member_ratings (club_id, player_id, discipline);

drop index if exists club_member_ratings_leaderboard_idx;
create index if not exists club_member_ratings_leaderboard_idx
  on public.club_member_ratings (club_id, discipline, rating desc);

alter table public.club_rating_history
  add column if not exists discipline text not null default 'singles'
    check (discipline in ('singles', 'doubles'));

-- The per-match idempotency index (club_id, match_id, player_id) still holds:
-- a match belongs to exactly one discipline, so no change needed there.

-- ------------------------------------------------------------
-- 4) Protect the new privileged profile columns from self-service edits
--    (mirrors 20260611000100_protect_profile_privileged_columns.sql).
-- ------------------------------------------------------------

create or replace function public.protect_profile_privileged_columns()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  jwt_role text :=
    nullif(current_setting('request.jwt.claims', true), '')::jsonb->>'role';
begin
  -- Server key or direct DB connection → trusted, skip the check.
  if jwt_role is null or jwt_role = 'service_role' then
    return new;
  end if;

  if public.is_admin() then
    return new;
  end if;

  if new.is_admin                          is distinct from old.is_admin
     or new.is_coach                       is distinct from old.is_coach
     or new.is_player                      is distinct from old.is_player
     or new.current_elo                    is distinct from old.current_elo
     or new.elo_status                     is distinct from old.elo_status
     or new.rated_matches_count            is distinct from old.rated_matches_count
     or new.current_elo_doubles            is distinct from old.current_elo_doubles
     or new.elo_status_doubles             is distinct from old.elo_status_doubles
     or new.rated_matches_count_doubles    is distinct from old.rated_matches_count_doubles
     or new.onboarding_completed_at        is distinct from old.onboarding_completed_at
  then
    raise exception 'changing privileged profile columns is not allowed'
      using errcode = '42501'; -- insufficient_privilege
  end if;

  return new;
end $$;

-- ------------------------------------------------------------
-- 5) Expose the doubles rating through the public views.
--    CREATE OR REPLACE keeps the existing column order and appends the new
--    columns at the end, so dependent views (public_matches_feed) survive.
-- ------------------------------------------------------------

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
  p.rated_matches_count_doubles
from public.profiles p
left join public.districts d on d.id = p.district_id;

grant select on public.public_player_basic to anon, authenticated;

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
  p.rated_matches_count_doubles
from public.profiles p
where p.visible_in_find_player = true;

grant select on public.public_player_directory to anon, authenticated;

-- ------------------------------------------------------------
-- 6) player_match_stats: count doubles participants (partner slots) and add
--    per-discipline splits. Leading columns keep their old meaning (overall
--    W/L), so existing consumers stay correct without code changes.
-- ------------------------------------------------------------

create or replace view public.player_match_stats as
select
  m.player_id,
  count(*) as completed_count,
  count(*) filter (where m.won) as wins_count,
  count(*) filter (where not m.won) as losses_count,
  count(*) filter (where not m.is_doubles) as singles_completed_count,
  count(*) filter (where m.won and not m.is_doubles) as singles_wins_count,
  count(*) filter (where not m.won and not m.is_doubles) as singles_losses_count,
  count(*) filter (where m.is_doubles) as doubles_completed_count,
  count(*) filter (where m.won and m.is_doubles) as doubles_wins_count,
  count(*) filter (where not m.won and m.is_doubles) as doubles_losses_count
from (
  select p1_id as player_id, (winner_side = 'p1') as won, is_doubles
  from public.public_matches_feed
  where outcome = 'completed' and winner_side is not null and p1_id is not null
  union all
  select p2_id as player_id, (winner_side = 'p2') as won, is_doubles
  from public.public_matches_feed
  where outcome = 'completed' and winner_side is not null and p2_id is not null
  union all
  select p1_partner_id as player_id, (winner_side = 'p1') as won, is_doubles
  from public.public_matches_feed
  where outcome = 'completed' and winner_side is not null and p1_partner_id is not null
  union all
  select p2_partner_id as player_id, (winner_side = 'p2') as won, is_doubles
  from public.public_matches_feed
  where outcome = 'completed' and winner_side is not null and p2_partner_id is not null
) m
group by m.player_id;

comment on view public.player_match_stats is
  'Per-player W/L aggregate derived from public_matches_feed. Overall columns '
  'include all disciplines (doubles partners counted); singles_* / doubles_* '
  'columns split the same numbers per discipline.';

grant select on public.player_match_stats to anon, authenticated;
