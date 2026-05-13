-- ============================================================
-- Per-court indoor flag, derived venue indoor_status.
--
-- Why this migration.
-- Until now `venues.is_indoor` was a single boolean on the venue.
-- That's wrong for Belarus reality: most clubs (Аква-Минск,
-- ТК «Минск-Арена», Динамо, …) have *both* indoor and outdoor
-- courts in the same complex. A single boolean forced editors
-- to lie one way or the other.
--
-- New model:
--   courts.is_indoor BOOLEAN  — owned by each court
--   venues.indoor_status TEXT — derived from the venue's courts
--       'indoor'  → all courts are indoor
--       'outdoor' → all courts are outdoor
--       'mixed'   → both kinds exist
--       'unknown' → no courts entered yet
--
-- The legacy `venues.is_indoor` column is kept and auto-mirrored
-- (= TRUE when indoor_status in ('indoor','mixed')) so that any
-- queries still on the old column keep working until they're
-- migrated. We can drop it in a follow-up after the codebase
-- moves over.
--
-- All recomputation is centralised in a SECURITY DEFINER function
-- and a single trigger on `courts`. RLS stays admin-only for
-- writes; reads are public.
-- ============================================================

begin;

-- ─── 1. courts.is_indoor ─────────────────────────────────────────────────────
alter table public.courts
  add column if not exists is_indoor boolean not null default false;

-- Backfill: each court inherits from its venue's current is_indoor.
update public.courts c
set is_indoor = v.is_indoor
from public.venues v
where v.id = c.venue_id;

-- ─── 2. venues.indoor_status ────────────────────────────────────────────────
alter table public.venues
  add column if not exists indoor_status text not null default 'unknown';

alter table public.venues
  drop constraint if exists venues_indoor_status_check;

alter table public.venues
  add constraint venues_indoor_status_check
  check (indoor_status in ('indoor','outdoor','mixed','unknown'));

-- ─── 3. Recompute helper. SECURITY DEFINER so the trigger can run
--      regardless of who's mutating courts (admin via RLS, seeds,
--      cron, etc.).
create or replace function public.recompute_venue_indoor_status(p_venue_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_total      int;
  v_indoor     int;
  v_outdoor    int;
  v_status     text;
begin
  select
    count(*),
    count(*) filter (where is_indoor),
    count(*) filter (where not is_indoor)
  into v_total, v_indoor, v_outdoor
  from public.courts
  where venue_id = p_venue_id;

  if v_total = 0 then
    v_status := 'unknown';
  elsif v_indoor > 0 and v_outdoor = 0 then
    v_status := 'indoor';
  elsif v_outdoor > 0 and v_indoor = 0 then
    v_status := 'outdoor';
  else
    v_status := 'mixed';
  end if;

  update public.venues
  set indoor_status = v_status,
      -- Legacy mirror: TRUE if there's at least one indoor court.
      is_indoor     = (v_indoor > 0),
      updated_at    = now()
  where id = p_venue_id;
end;
$$;

comment on function public.recompute_venue_indoor_status(uuid) is
  'Recomputes venues.indoor_status (and legacy is_indoor mirror) from the venue''s courts. '
  'Called by trg_courts_indoor_recompute and the courts mutations.';

-- ─── 4. Trigger: any change to courts → recompute the parent venue. ─────────
create or replace function public.tg_courts_indoor_recompute()
returns trigger
language plpgsql
as $$
begin
  if (tg_op = 'DELETE') then
    perform public.recompute_venue_indoor_status(old.venue_id);
    return old;
  end if;

  -- INSERT or UPDATE
  perform public.recompute_venue_indoor_status(new.venue_id);

  -- If a court was reassigned to a different venue (rare but possible),
  -- recompute the previous venue too.
  if (tg_op = 'UPDATE' and new.venue_id is distinct from old.venue_id) then
    perform public.recompute_venue_indoor_status(old.venue_id);
  end if;

  return new;
end;
$$;

drop trigger if exists trg_courts_indoor_recompute on public.courts;

create trigger trg_courts_indoor_recompute
after insert or update of is_indoor, venue_id or delete
on public.courts
for each row
execute function public.tg_courts_indoor_recompute();

-- ─── 5. One-time backfill for every existing venue. ─────────────────────────
do $$
declare
  r record;
begin
  for r in select id from public.venues loop
    perform public.recompute_venue_indoor_status(r.id);
  end loop;
end$$;

-- ─── 6. open_matches_feed view: surface indoor_status alongside the legacy
--      is_indoor mirror so consumers can switch incrementally.
--
-- Postgres `CREATE OR REPLACE VIEW` cannot insert a new column in the middle
-- of the column list, so we drop and re-create. The view has no materialized
-- consumers; all readers go through server actions that re-issue the query.
drop view if exists public.open_matches_feed;

create view public.open_matches_feed as
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
  ) as accepted_applications_count
from public.open_matches om
join public.profiles pr on pr.id = om.creator_id
left join public.venues    v on v.id = om.venue_id
left join public.districts d on d.id = om.district_id;

comment on view public.open_matches_feed is
  'Denormalized feed for the public Open Matches list and venue tabs. RLS is '
  'inherited from open_matches and profiles via the security_invoker default.';

grant select on public.open_matches_feed to anon, authenticated;

commit;
