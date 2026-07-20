-- ============================================================
-- Doubles (pair) tournaments.
--
-- Model: a doubles tournament is a regular tournament with
-- `discipline = 'doubles'`. Each `tournament_participants` row then
-- represents a PAIR: `player_id` is the pair captain (the person who
-- registered / was added first) and `partner_id` — already present in
-- the schema since init, unused until now — is their partner.
--
-- The whole draw pipeline (single elimination, round robin,
-- group + playoff) stays keyed by the captain's id; match rows are
-- written with `is_doubles = true` and `p1_partner_id`/`p2_partner_id`
-- filled from the pair map, which the existing doubles-aware Elo
-- recalc (global + club ladders) picks up with no further changes.
-- ============================================================

alter table public.tournaments
  add column if not exists discipline text not null default 'singles'
    check (discipline in ('singles', 'doubles'));

comment on column public.tournaments.discipline is
  'singles (default) or doubles. In doubles tournaments every '
  'tournament_participants row is a pair: player_id = captain, '
  'partner_id = partner. Locked once participants exist.';

-- ------------------------------------------------------------
-- Partner visibility. The RLS helpers and the tp_read policy only
-- looked at `player_id`, so a pair partner could not see their own
-- registration (or a club-private tournament they play in). Extend
-- both to treat the partner as a participant.
-- ------------------------------------------------------------

create or replace function public.is_tournament_participant(_tournament_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from tournament_participants
     where tournament_id = _tournament_id
       and (player_id = auth.uid() or partner_id = auth.uid())
  );
$$;

create or replace function public.is_tournament_visible(_tournament_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from tournaments t
     where t.id = _tournament_id
       and (
            t.privacy = 'public'
         or t.owner_id = auth.uid()
         or exists (
              select 1 from tournament_participants tp
               where tp.tournament_id = t.id
                 and (tp.player_id = auth.uid() or tp.partner_id = auth.uid())
            )
       )
  );
$$;

grant execute on function public.is_tournament_participant(uuid) to anon, authenticated;
grant execute on function public.is_tournament_visible(uuid)     to anon, authenticated;

drop policy if exists tp_read on tournament_participants;
create policy tp_read on tournament_participants for select
  using (
    player_id = auth.uid()
    or partner_id = auth.uid()
    or public.is_tournament_visible(tournament_id)
    or is_admin()
  );

-- Fast partner lookups (viewer state, "my tournaments" via partner slot).
create index if not exists idx_tournament_participants_partner
  on public.tournament_participants (partner_id)
  where partner_id is not null;
