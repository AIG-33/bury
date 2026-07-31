-- =============================================================================
-- Allow tournament owners to DELETE matches of their own tournaments.
--
-- Background. Server actions regenerate schedules by wiping matches first:
--   – generateBracket / generateGroups: "wipe previous state" delete,
--   – reassignToGroup: drops the two affected groups' round-robin matches
--     before re-inserting them,
--   – closeGroupsAndStartPlayoff: drops playoff/third-place rows on re-close.
--
-- Until now the only DELETE policy on `matches` was matches_admin_delete
-- (is_admin()), so for a regular organizer those deletes silently removed
-- 0 rows and the re-insert produced DUPLICATE matches (observed when moving
-- a participant between groups: both groups kept their stale schedules).
--
-- Scope: only tournament matches (tournament_id is not null) owned by the
-- caller. Friendly matches stay non-deletable, players still can't delete
-- anything, admins keep their separate policy.
-- =============================================================================

drop policy if exists matches_owner_delete on public.matches;
create policy matches_owner_delete on public.matches for delete using (
  tournament_id is not null
  and public.is_tournament_owner(tournament_id)
);
