-- ============================================================
-- Tournaments are no longer a "coach" feature.
--
-- Why
--   Until now, only profiles with `is_coach = true` (or admins)
--   could create tournaments. The product direction is now:
--   any registered user can organize a tournament, collect
--   applications from players, and approve / reject them
--   individually. Tournaments live under the player area
--   (/me/tournaments/organized) and are no longer surfaced from
--   the /coach/* section at all.
--
-- This migration covers two changes:
--
--   1) RENAME `tournaments.owner_coach_id` → `tournaments.owner_id`.
--      The old name was misleading: with the new flow the owner
--      may be any user. RLS policies and the SECURITY DEFINER
--      helper functions (`is_tournament_owner`,
--      `is_tournament_visible`) are recreated against the new
--      column name. The `tournaments_owner_write` policy keeps
--      `owner_id = auth.uid() OR is_admin()`, which intentionally
--      lets any authenticated user INSERT a tournament where
--      they own the row. No `is_coach` check.
--
--   2) ADD `tournament_participants.status` (text) — the approval
--      lifecycle for each application:
--          'pending'   — player submitted, owner has not decided
--          'approved'  — owner accepted (counts toward seeding,
--                        eligible for the bracket)
--          'rejected'  — owner declined; row kept for history /
--                        anti-spam
--      Backfill: every existing non-withdrawn registration is
--      assumed to have been "auto-approved" under the previous
--      no-approval flow → status = 'approved'. Withdrawn rows
--      remain 'approved' as well so we don't accidentally erase
--      historical participation; the orthogonal `withdrawn`
--      flag continues to mark "the player pulled out after
--      approval".
--
--      Existing code that filters `tournament_participants`
--      already uses the (currently-empty-because-the-column-
--      didn't-exist) `status` column on the cron route — the
--      column ADD here also fixes that latent bug (the cron
--      now has something to filter on).
--
-- Forward-only per AGENTS.md §3.9. No data is destroyed.
-- ============================================================

-- ------------------------------------------------------------
-- 1) Rename `owner_coach_id` → `owner_id`.
-- ------------------------------------------------------------

alter table public.tournaments
  rename column owner_coach_id to owner_id;

-- Index is named after the old column; keep tooling happy.
alter index if exists public.tournaments_owner_status_idx
  rename to tournaments_owner_id_status_idx;

comment on column public.tournaments.owner_id is
  'Profile id of the user who created (and manages) this tournament. '
  'Any registered user can be an owner; was previously called '
  'owner_coach_id but the role check has been removed.';

-- ------------------------------------------------------------
-- 2) SECURITY DEFINER helpers — recreate against `owner_id`.
--    Same shape as in 20260422000600_tournaments_rls_recursion_fix.sql,
--    just pointing at the renamed column.
-- ------------------------------------------------------------

create or replace function public.is_tournament_owner(_tournament_id uuid)
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
                 and tp.player_id = auth.uid()
            )
       )
  );
$$;

-- `is_tournament_participant` doesn't reference `owner_coach_id`,
-- so it does not need to be recreated. We re-grant just in case
-- the helper was ever revoked.
grant execute on function public.is_tournament_owner(uuid)   to anon, authenticated;
grant execute on function public.is_tournament_visible(uuid) to anon, authenticated;

-- ------------------------------------------------------------
-- 3) Recreate the policies that referenced `owner_coach_id`.
--    The READ policies on tournament_participants / matches
--    already go through the helpers and stay correct after the
--    helper bodies are updated above; only `tournaments` itself
--    has policies that name the column directly.
-- ------------------------------------------------------------

drop policy if exists tournaments_read on public.tournaments;
create policy tournaments_read on public.tournaments
  for select using (
    privacy = 'public'
    or owner_id = auth.uid()
    or public.is_tournament_participant(id)
    or is_admin()
  );

drop policy if exists tournaments_owner_write on public.tournaments;
create policy tournaments_owner_write on public.tournaments
  for all
  using  (owner_id = auth.uid() or is_admin())
  with check (owner_id = auth.uid() or is_admin());

-- ------------------------------------------------------------
-- 4) Add `status` to tournament_participants and backfill.
-- ------------------------------------------------------------

alter table public.tournament_participants
  add column if not exists status text
  not null default 'pending'
  check (status in ('pending', 'approved', 'rejected'));

comment on column public.tournament_participants.status is
  'Approval lifecycle. Player creates a row in `pending`; the '
  'tournament owner moves it to `approved` or `rejected`. '
  'Withdrawal after approval is captured separately by the '
  '`withdrawn` boolean flag.';

-- Backfill: everything that exists today has been silently
-- treated as "approved" under the no-approval flow. Mark all
-- legacy rows as approved so the new UI doesn't accidentally
-- demote real participants to "pending applications".
update public.tournament_participants
   set status = 'approved'
 where status = 'pending';

-- Most operational queries filter by tournament + status (e.g.
-- "approved + not withdrawn" headcount, "pending applications
-- inbox"). Keep that fast.
create index if not exists tp_tournament_status_idx
  on public.tournament_participants (tournament_id, status);

-- ------------------------------------------------------------
-- 5) Tighten RLS for the approval flow.
--    Players can INSERT their own application (status = 'pending');
--    they cannot self-approve. Owners / admins can update status
--    and `withdrawn` via the existing `tp_owner_admin_write` policy
--    (no change needed there). Players keep the right to delete
--    their own row (= cancel a pending application or withdraw
--    pre-tournament) via the existing `tp_owner_admin_delete`.
-- ------------------------------------------------------------

drop policy if exists tp_player_register on public.tournament_participants;
create policy tp_player_register on public.tournament_participants
  for insert with check (
    player_id = auth.uid()
    -- A player can only ever create their own row in the
    -- 'pending' state. Anything else has to come from the
    -- owner (via tp_owner_admin_write) or an admin.
    and status = 'pending'
    and withdrawn = false
  );
