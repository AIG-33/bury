-- =============================================================================
-- Tournament co-organizers (tournament_admins).
--
-- Why
--   Until now only `tournaments.owner_id` could administer a tournament:
--   edit settings, manage participants, generate groups/brackets, enter
--   scores. The owner can now appoint other players as tournament admins
--   (co-organizers) who get the same administrative rights, EXCEPT:
--     * managing the admin list itself (owner only),
--     * deleting the tournament (owner only),
--     * transferring ownership (owner only, enforced by trigger).
--
-- What this migration does
--   1) New table `public.tournament_admins` (RLS ON).
--   2) SECURITY DEFINER helpers:
--        is_tournament_co_admin(uuid)  — auth.uid() is in tournament_admins
--        can_manage_tournament(uuid)   — owner OR co-admin
--      (same pattern as is_tournament_owner / is_tournament_visible, see
--      20260422000600_tournaments_rls_recursion_fix.sql — helpers sever the
--      RLS recursion between tournaments and its child tables).
--   3) Extends is_tournament_visible() so co-admins see private tournaments.
--   4) Recreates the administrative policies on tournaments,
--      tournament_participants, tournament_groups, tournament_venues and
--      matches with "owner OR co-admin" instead of "owner".
--   5) Guard trigger: only the current owner (or a platform admin / service
--      role) may change tournaments.owner_id — otherwise a co-admin could
--      hijack ownership through a direct UPDATE.
--
-- Forward-only, idempotent (CREATE OR REPLACE / DROP POLICY IF EXISTS) —
-- safe to run via the Supabase SQL Editor.
-- =============================================================================

-- ------------------------------------------------------------
-- 1) Table
-- ------------------------------------------------------------

create table if not exists public.tournament_admins (
  id            uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments (id) on delete cascade,
  player_id     uuid not null references public.profiles (id) on delete cascade,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (tournament_id, player_id)
);

comment on table public.tournament_admins is
  'Co-organizers of a tournament. A row grants the player the same '
  'administrative rights as the owner (settings, participants, draw, scores) '
  'except managing this list and deleting the tournament.';

create index if not exists tournament_admins_player_idx
  on public.tournament_admins (player_id);

drop trigger if exists trg_tournament_admins_updated on public.tournament_admins;
create trigger trg_tournament_admins_updated
  before update on public.tournament_admins
  for each row execute function set_updated_at();

alter table public.tournament_admins enable row level security;

-- ------------------------------------------------------------
-- 2) SECURITY DEFINER helpers
-- ------------------------------------------------------------

create or replace function public.is_tournament_co_admin(_tournament_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from tournament_admins ta
     where ta.tournament_id = _tournament_id
       and ta.player_id = auth.uid()
  );
$$;

create or replace function public.can_manage_tournament(_tournament_id uuid)
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
       and t.owner_id = auth.uid()
  )
  or exists (
    select 1
      from tournament_admins ta
     where ta.tournament_id = _tournament_id
       and ta.player_id = auth.uid()
  );
$$;

revoke all on function public.is_tournament_co_admin(uuid) from public;
revoke all on function public.can_manage_tournament(uuid)  from public;
grant execute on function public.is_tournament_co_admin(uuid) to anon, authenticated;
grant execute on function public.can_manage_tournament(uuid)  to anon, authenticated;

-- Co-admins must see private ("club") tournaments they administer — this
-- helper backs tournaments_read / tp_read / matches_read / tournament_venues.
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
                 and tp.player_id = auth.uid()
            )
         or exists (
              select 1 from tournament_admins ta
               where ta.tournament_id = t.id
                 and ta.player_id = auth.uid()
            )
       )
  );
$$;

-- ------------------------------------------------------------
-- 3) RLS on tournament_admins
--    read   — owner, the co-admins themselves, platform admins;
--    write  — owner (and platform admins) only.
-- ------------------------------------------------------------

drop policy if exists tournament_admins_read on public.tournament_admins;
create policy tournament_admins_read on public.tournament_admins
  for select using (
    player_id = auth.uid()
    or public.is_tournament_owner(tournament_id)
    or public.is_tournament_co_admin(tournament_id)
    or is_admin()
  );

drop policy if exists tournament_admins_owner_insert on public.tournament_admins;
create policy tournament_admins_owner_insert on public.tournament_admins
  for insert with check (
    public.is_tournament_owner(tournament_id) or is_admin()
  );

drop policy if exists tournament_admins_owner_delete on public.tournament_admins;
create policy tournament_admins_owner_delete on public.tournament_admins
  for delete using (
    public.is_tournament_owner(tournament_id) or is_admin()
  );

-- ------------------------------------------------------------
-- 4) tournaments: split the old FOR ALL owner policy so co-admins can
--    UPDATE but only the owner can INSERT (as themselves) and DELETE.
-- ------------------------------------------------------------

drop policy if exists tournaments_owner_write on public.tournaments;

drop policy if exists tournaments_read on public.tournaments;
create policy tournaments_read on public.tournaments
  for select using (
    privacy = 'public'
    or owner_id = auth.uid()
    or public.is_tournament_participant(id)
    or public.is_tournament_co_admin(id)
    or is_admin()
  );

drop policy if exists tournaments_owner_insert on public.tournaments;
create policy tournaments_owner_insert on public.tournaments
  for insert with check (owner_id = auth.uid() or is_admin());

drop policy if exists tournaments_manage_update on public.tournaments;
create policy tournaments_manage_update on public.tournaments
  for update
  using  (public.can_manage_tournament(id) or is_admin())
  with check (public.can_manage_tournament(id) or is_admin());

drop policy if exists tournaments_owner_delete on public.tournaments;
create policy tournaments_owner_delete on public.tournaments
  for delete using (owner_id = auth.uid() or is_admin());

-- Ownership transfer guard: RLS WITH CHECK cannot compare OLD vs NEW, so a
-- co-admin could otherwise UPDATE owner_id to themselves. auth.uid() IS NULL
-- covers the service role and SQL-editor sessions.
create or replace function public.guard_tournament_owner_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.owner_id is distinct from old.owner_id then
    if auth.uid() is not null
       and auth.uid() <> old.owner_id
       and not is_admin() then
      raise exception 'only the tournament owner can transfer ownership';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_tournaments_owner_guard on public.tournaments;
create trigger trg_tournaments_owner_guard
  before update on public.tournaments
  for each row execute function public.guard_tournament_owner_change();

-- ------------------------------------------------------------
-- 5) tournament_participants: owner → owner-or-co-admin.
--    Also adds an explicit manager INSERT policy (the organizer-side
--    "add participant directly" flow inserts rows for OTHER players with
--    status='approved', which tp_player_register never allowed).
-- ------------------------------------------------------------

drop policy if exists tp_owner_admin_write on public.tournament_participants;
create policy tp_owner_admin_write on public.tournament_participants
  for update
  using (public.can_manage_tournament(tournament_id) or is_admin())
  with check (true);

drop policy if exists tp_owner_admin_delete on public.tournament_participants;
create policy tp_owner_admin_delete on public.tournament_participants
  for delete using (
    player_id = auth.uid()
    or public.can_manage_tournament(tournament_id)
    or is_admin()
  );

drop policy if exists tp_manager_insert on public.tournament_participants;
create policy tp_manager_insert on public.tournament_participants
  for insert with check (
    public.can_manage_tournament(tournament_id) or is_admin()
  );

-- ------------------------------------------------------------
-- 6) tournament_groups / tournament_venues: owner → owner-or-co-admin.
-- ------------------------------------------------------------

drop policy if exists tournament_groups_owner_write on public.tournament_groups;
create policy tournament_groups_owner_write on public.tournament_groups
  for all
  using (public.can_manage_tournament(tournament_id) or is_admin())
  with check (public.can_manage_tournament(tournament_id) or is_admin());

drop policy if exists tournament_venues_owner_write on public.tournament_venues;
create policy tournament_venues_owner_write on public.tournament_venues
  for all
  using (public.can_manage_tournament(tournament_id) or is_admin())
  with check (public.can_manage_tournament(tournament_id) or is_admin());

-- ------------------------------------------------------------
-- 7) matches: tournament-side INSERT / UPDATE / DELETE for co-admins too.
--    Friendly (non-tournament) matches keep their participant-only rules.
-- ------------------------------------------------------------

drop policy if exists matches_participant_or_owner_write on public.matches;
create policy matches_participant_or_owner_write on public.matches
  for update using (
    p1_id = auth.uid() or p2_id = auth.uid()
    or (tournament_id is not null and public.can_manage_tournament(tournament_id))
    or is_admin()
  );

drop policy if exists matches_friendly_insert on public.matches;
create policy matches_friendly_insert on public.matches
  for insert with check (
    (tournament_id is null and (p1_id = auth.uid() or p2_id = auth.uid()))
    or (tournament_id is not null and public.can_manage_tournament(tournament_id))
    or is_admin()
  );

drop policy if exists matches_owner_delete on public.matches;
create policy matches_owner_delete on public.matches
  for delete using (
    tournament_id is not null
    and public.can_manage_tournament(tournament_id)
  );
