-- ============================================================
-- Public read-only feed of completed matches (friendly + tournament).
--
-- Background. The `matches_read` RLS policy on `public.matches`
-- restricts SELECT to:
--   * direct participants (p1/p2 + partners), or
--   * the owner / participants of the parent tournament, or
--   * admins.
-- That is correct for the raw table (it carries unconfirmed scores,
-- cancelled friendly drafts, etc.) but it makes a public "all matches"
-- listing impossible for an anonymous viewer.
--
-- This migration adds a thin RLS-bypassing view that exposes ONLY
-- safe, already-public fields for matches whose result is final
-- (`outcome = 'completed'`). Anything in flight (proposed, scheduled
-- without sets, cancelled, awaiting confirmation) stays hidden via
-- the WHERE clause.
--
-- Player names + avatars come from `public_profile_basic`, which is
-- already non-PII and granted to anon. Tournament name is joined
-- directly from `tournaments` — its `tournaments_read` policy
-- (rewritten in 20260422000600_tournaments_rls_recursion_fix.sql to
-- use `is_tournament_visible`) lets anyone read non-private
-- tournaments, but since the view is `security_invoker = false` we
-- run as the view owner anyway.
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
  m.sets,
  m.winner_side,
  -- Side P1
  m.p1_id,
  p1.display_name        as p1_name,
  p1.avatar_url          as p1_avatar,
  p1.is_coach            as p1_is_coach,
  m.p1_partner_id,
  pp1.display_name       as p1_partner_name,
  -- Side P2
  m.p2_id,
  p2.display_name        as p2_name,
  p2.avatar_url          as p2_avatar,
  p2.is_coach            as p2_is_coach,
  m.p2_partner_id,
  pp2.display_name       as p2_partner_name,
  -- Tournament context (NULL for friendly).
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
  -- Tournament privacy is honoured: 'club' tournaments are not surfaced in
  -- the public feed (the coach can flip privacy='public' to publish the
  -- bracket + results). Friendly matches (tournament_id is null) are always
  -- shown — they already moved player Elo, which is itself public.
  and (
    m.tournament_id is null
    or t.privacy = 'public'
  );

comment on view public.public_matches_feed is
  'Public, RLS-bypassing read of completed matches (friendly + tournament). '
  'Friendly matches are always shown when outcome=completed; tournament matches '
  'only when the parent tournament privacy is public/unlisted. Player PII '
  '(phone, whatsapp, health notes) is NOT exposed — only display name and avatar.';

grant select on public.public_matches_feed to anon, authenticated;
