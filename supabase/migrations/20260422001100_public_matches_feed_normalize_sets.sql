-- ============================================================
-- Normalize the `sets` JSONB shape in `public_matches_feed`.
--
-- Background. Tournament matches and friendly matches store the
-- per-set score with DIFFERENT keys:
--   * tournament: [{p1: 6, p2: 2, tb_p1?: int, tb_p2?: int}, ...]
--     (lib/tournaments/schema.ts → ScoreSetSchema)
--   * friendly:   [{p1_games, p2_games, tiebreak_p1?, tiebreak_p2?}, ...]
--     (lib/matches/score.ts → SetScore, app/.../me/matches/actions.ts)
--
-- The first version of `public_matches_feed` exposed `m.sets` as-is,
-- so /matches couldn't render tournament scores (it expects the
-- friendly shape). This migration normalises both shapes to the
-- friendly one (`p1_games / p2_games / tiebreak_p1 / tiebreak_p2`)
-- inside the view, so consumers don't need to know the source.
-- ============================================================

drop view if exists public.public_matches_feed;

create view public.public_matches_feed
  with (security_invoker = false) as
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
  t.format               as tournament_format
from public.matches m
left join public.public_player_basic p1  on p1.id  = m.p1_id
left join public.public_player_basic p2  on p2.id  = m.p2_id
left join public.public_player_basic pp1 on pp1.id = m.p1_partner_id
left join public.public_player_basic pp2 on pp2.id = m.p2_partner_id
left join public.tournaments t           on t.id   = m.tournament_id
where m.outcome = 'completed'
  and (
    m.tournament_id is null
    or t.privacy = 'public'
  );

comment on view public.public_matches_feed is
  'Public feed of completed matches (friendly + tournament). Sets are '
  'normalised to {p1_games, p2_games, tiebreak_p1, tiebreak_p2} regardless of '
  'the source shape. Tournament matches only when tournament privacy = public. '
  'No PII (phone, whatsapp, health notes) is exposed.';

grant select on public.public_matches_feed to anon, authenticated;
