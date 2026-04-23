-- ============================================================
-- Add venue resolution to `public.public_matches_feed`.
--
-- Why
--   The /matches page now exposes a venue filter and a "venue" label
--   next to each match. We resolve the venue per-match in the view so
--   the page can keep filtering server-side (PostgREST .eq("venue_id"))
--   without a join.
--
-- Resolution rules (in priority order):
--   1. matches.court_id -> courts.venue_id (set when the match was
--      scheduled on a specific court),
--   2. for tournament matches without a court, fall back to the
--      first tournament_venues row (deterministic by venue.name asc).
--
-- Friendly matches with neither court nor venue -> NULL venue_id.
-- ============================================================

drop view if exists public.public_matches_feed;

create view public.public_matches_feed
  with (security_invoker = false) as
with tournament_first_venue as (
  select distinct on (tv.tournament_id)
    tv.tournament_id,
    tv.venue_id
  from public.tournament_venues tv
  join public.venues v on v.id = tv.venue_id
  order by tv.tournament_id, lower(v.name)
)
select
  m.id,
  m.outcome,
  m.played_at,
  m.scheduled_at,
  m.created_at,
  m.is_doubles,
  -- Normalised sets: always {p1_games, p2_games, tiebreak_p1, tiebreak_p2}.
  case
    when m.sets is null then null
    else (
      select jsonb_agg(
        jsonb_build_object(
          'p1_games',     coalesce((s->>'p1_games')::int, (s->>'p1')::int),
          'p2_games',     coalesce((s->>'p2_games')::int, (s->>'p2')::int),
          'tiebreak_p1',  coalesce(nullif(s->>'tiebreak_p1','')::int, nullif(s->>'tb_p1','')::int),
          'tiebreak_p2',  coalesce(nullif(s->>'tiebreak_p2','')::int, nullif(s->>'tb_p2','')::int)
        )
        order by ord
      )
      from jsonb_array_elements(m.sets) with ordinality as t(s, ord)
    )
  end as sets,
  m.winner_side,
  m.p1_id,
  p1.display_name        as p1_name,
  p1.avatar_url          as p1_avatar,
  p1.is_coach            as p1_is_coach,
  m.p1_partner_id,
  pp1.display_name       as p1_partner_name,
  m.p2_id,
  p2.display_name        as p2_name,
  p2.avatar_url          as p2_avatar,
  p2.is_coach            as p2_is_coach,
  m.p2_partner_id,
  pp2.display_name       as p2_partner_name,
  m.tournament_id,
  t.name                 as tournament_name,
  t.surface              as tournament_surface,
  t.format               as tournament_format,
  -- Venue resolution.
  coalesce(c.venue_id, tfv.venue_id) as venue_id,
  v.name                              as venue_name,
  v.city                              as venue_city
from public.matches m
left join public.public_player_basic p1  on p1.id  = m.p1_id
left join public.public_player_basic p2  on p2.id  = m.p2_id
left join public.public_player_basic pp1 on pp1.id = m.p1_partner_id
left join public.public_player_basic pp2 on pp2.id = m.p2_partner_id
left join public.tournaments t           on t.id   = m.tournament_id
left join public.courts c                on c.id   = m.court_id
left join tournament_first_venue tfv     on tfv.tournament_id = m.tournament_id
left join public.venues v                on v.id   = coalesce(c.venue_id, tfv.venue_id)
where m.outcome = 'completed'
  and (
    m.tournament_id is null
    or t.privacy = 'public'
  );

comment on view public.public_matches_feed is
  'Public feed of completed matches (friendly + tournament). Sets are '
  'normalised to {p1_games, p2_games, tiebreak_p1, tiebreak_p2}. Tournament '
  'matches only when tournament privacy = public. venue_id is resolved from '
  'the match court first, falling back to the tournament''s first venue '
  '(deterministic by name). No PII (phone, whatsapp, health) is exposed.';

grant select on public.public_matches_feed to anon, authenticated;
