-- =============================================================================
-- profiles.last_match_at — used by Find-a-Player to give a recency bonus.
-- Maintained by a trigger on matches: whenever a match transitions to
-- a completed/walkover/retired/dsq state we bump both players' last_match_at.
-- =============================================================================

alter table public.profiles
  add column if not exists last_match_at timestamptz;

comment on column public.profiles.last_match_at is
  'Timestamp of the player''s last completed match. Used by Find-a-Player ranker for the "recently active" bonus and for activity badges.';

create or replace function public.bump_last_match_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  finished_states constant text[] := array[
    'completed', 'walkover_p1', 'walkover_p2',
    'retired_p1',  'retired_p2',
    'dsq_p1',      'dsq_p2'
  ];
  ts timestamptz := coalesce(new.played_at, now());
begin
  if new.outcome = any(finished_states)
     and (tg_op = 'INSERT' or old.outcome <> new.outcome)
  then
    update public.profiles
      set last_match_at = greatest(coalesce(last_match_at, 'epoch'::timestamptz), ts)
      where id in (new.p1_id, new.p2_id);

    if new.p1_partner_id is not null then
      update public.profiles
        set last_match_at = greatest(coalesce(last_match_at, 'epoch'::timestamptz), ts)
        where id = new.p1_partner_id;
    end if;
    if new.p2_partner_id is not null then
      update public.profiles
        set last_match_at = greatest(coalesce(last_match_at, 'epoch'::timestamptz), ts)
        where id = new.p2_partner_id;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_matches_bump_last_match on public.matches;
create trigger trg_matches_bump_last_match
  after insert or update of outcome on public.matches
  for each row execute function public.bump_last_match_at();

-- Backfill once based on existing finished matches.
update public.profiles p
   set last_match_at = sub.max_played
  from (
    select unnest(array[m.p1_id, m.p2_id, m.p1_partner_id, m.p2_partner_id]) as pid,
           max(coalesce(m.played_at, m.updated_at)) as max_played
      from public.matches m
     where m.outcome in (
       'completed','walkover_p1','walkover_p2',
       'retired_p1','retired_p2','dsq_p1','dsq_p2'
     )
     group by 1
  ) sub
 where p.id = sub.pid
   and sub.pid is not null
   and (p.last_match_at is null or sub.max_played > p.last_match_at);
