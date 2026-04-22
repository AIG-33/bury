-- ============================================================
-- Fix: infinite recursion between `tournaments_read` and `tp_read`.
--
-- Symptom (before): creating a tournament fails with
--     "infinite recursion detected in policy for relation tournaments"
-- when the INSERT executes its implicit RETURNING * — that triggers
-- the SELECT-side `tournaments_read` policy, which references
-- `tournament_participants`, whose own `tp_read` policy references
-- `tournaments` again, and Postgres bails out.
--
-- Root cause: the original policies cross-reference each other:
--   tournaments_read       →  exists (from tournament_participants ...)
--   tp_read                →  exists (from tournaments ...)
--   tp_owner_admin_write   →  exists (from tournaments ...)
--   tp_owner_admin_delete  →  exists (from tournaments ...)
-- so any RLS check on either side cascades into the other and loops.
--
-- Fix: move every cross-table lookup into a SECURITY DEFINER helper
-- (same pattern as `is_admin()` / `is_coach_user()`). The helper runs
-- with the function-owner's privileges and bypasses RLS for the
-- single-row check it performs, so the recursion link is severed.
--
-- The user-visible behaviour is unchanged:
--   * a tournament is readable by its owner, by participants, by
--     anyone if it is public, and by admins;
--   * tournament_participants rows follow the same rules;
--   * only the owner / admin can update or delete participants;
--   * matches RLS keeps using the same shape (also rewritten to call
--     the helpers, for consistency).
-- ============================================================

-- ------------------------------------------------------------
-- Helper: is auth.uid() a participant of the given tournament?
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
       and player_id = auth.uid()
  );
$$;

-- ------------------------------------------------------------
-- Helper: is the tournament visible to auth.uid()?
-- (public, owned by the caller, or caller is a participant)
-- ------------------------------------------------------------
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
         or t.owner_coach_id = auth.uid()
         or exists (
              select 1 from tournament_participants tp
               where tp.tournament_id = t.id
                 and tp.player_id = auth.uid()
            )
       )
  );
$$;

-- ------------------------------------------------------------
-- Helper: is auth.uid() the owner of the given tournament?
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
       and t.owner_coach_id = auth.uid()
  );
$$;

revoke all on function public.is_tournament_participant(uuid) from public;
revoke all on function public.is_tournament_visible(uuid)     from public;
revoke all on function public.is_tournament_owner(uuid)       from public;

grant execute on function public.is_tournament_participant(uuid) to anon, authenticated;
grant execute on function public.is_tournament_visible(uuid)     to anon, authenticated;
grant execute on function public.is_tournament_owner(uuid)       to anon, authenticated;

-- ------------------------------------------------------------
-- Recreate the recursive policies, now backed by the helpers.
-- ------------------------------------------------------------

-- tournaments
drop policy if exists tournaments_read on tournaments;
create policy tournaments_read on tournaments for select
  using (
    privacy = 'public'
    or owner_coach_id = auth.uid()
    or public.is_tournament_participant(id)
    or is_admin()
  );

-- (tournaments_owner_write is fine — only references columns of `tournaments`
-- itself, no recursion. Left untouched.)

-- tournament_participants
drop policy if exists tp_read on tournament_participants;
create policy tp_read on tournament_participants for select
  using (
    player_id = auth.uid()
    or public.is_tournament_visible(tournament_id)
    or is_admin()
  );

drop policy if exists tp_owner_admin_write on tournament_participants;
create policy tp_owner_admin_write on tournament_participants for update
  using (public.is_tournament_owner(tournament_id) or is_admin())
  with check (true);

drop policy if exists tp_owner_admin_delete on tournament_participants;
create policy tp_owner_admin_delete on tournament_participants for delete
  using (
    player_id = auth.uid()
    or public.is_tournament_owner(tournament_id)
    or is_admin()
  );

-- matches — same shape, but route the cross-table checks through the
-- helpers so future RLS additions on tournaments don't reintroduce
-- the loop.
drop policy if exists matches_read on matches;
create policy matches_read on matches for select using (
  p1_id = auth.uid() or p2_id = auth.uid()
  or p1_partner_id = auth.uid() or p2_partner_id = auth.uid()
  or (tournament_id is not null and public.is_tournament_visible(tournament_id))
  or is_admin()
);

drop policy if exists matches_participant_or_owner_write on matches;
create policy matches_participant_or_owner_write on matches for update using (
  p1_id = auth.uid() or p2_id = auth.uid()
  or (tournament_id is not null and public.is_tournament_owner(tournament_id))
  or is_admin()
);

drop policy if exists matches_friendly_insert on matches;
create policy matches_friendly_insert on matches for insert with check (
  (tournament_id is null and (p1_id = auth.uid() or p2_id = auth.uid()))
  or (tournament_id is not null and public.is_tournament_owner(tournament_id))
  or is_admin()
);
