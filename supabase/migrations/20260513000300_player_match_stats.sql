-- =============================================================================
-- player_match_stats — wins / losses aggregate per player
-- =============================================================================
--
-- Purpose
-- -------
-- The `/players` and `/players/[id]` pages want to show a friendly "7W–3L · 70%"
-- pill next to the Elo number. We could compute this in TypeScript by paging
-- `public_matches_feed`, but that becomes O(N players × M matches) per page
-- load. A simple aggregate view keeps the loaders honest (one round-trip per
-- page) and stays trivially correct because it derives from the existing
-- `public_matches_feed` (which is already filtered to `outcome = 'completed'`
-- and `winner_side is not null` is guaranteed for a meaningful W/L).
--
-- Design notes
-- ------------
-- * `public_matches_feed` already excludes private/uncompleted matches and
--   handles tournament privacy, so building on top of it is the safe cut.
-- * We expand each match into TWO rows (one per player) via UNION ALL, then
--   GROUP BY player_id. Cheaper to write than a self-join.
-- * Walkovers / retired matches still have a `winner_side`, so they count
--   correctly. Pure `pending`/`cancelled` rows never appear in the feed and
--   are therefore excluded by construction.
-- * GRANTS mirror `public_matches_feed`: anon + authenticated SELECT. RLS is
--   not applicable to views; visibility is inherited from the source view.
-- =============================================================================

create or replace view public.player_match_stats as
select
  m.player_id,
  count(*) as completed_count,
  count(*) filter (where m.won) as wins_count,
  count(*) filter (where not m.won) as losses_count
from (
  select
    p1_id as player_id,
    (winner_side = 'p1') as won
  from public.public_matches_feed
  where outcome = 'completed' and winner_side is not null and p1_id is not null
  union all
  select
    p2_id as player_id,
    (winner_side = 'p2') as won
  from public.public_matches_feed
  where outcome = 'completed' and winner_side is not null and p2_id is not null
) m
group by m.player_id;

comment on view public.player_match_stats is
  'Per-player wins / losses aggregate derived from public_matches_feed. Used by '
  '/players list and detail page to render the "7W–3L" win-rate pill without '
  'scanning the matches table at request time.';

grant select on public.player_match_stats to anon, authenticated;
