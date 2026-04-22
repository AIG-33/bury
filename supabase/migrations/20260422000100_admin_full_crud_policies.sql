-- ============================================================
-- Admin DB editor (/admin/db) needs explicit RLS policies for the
-- write operations that the original schema didn't expose.
--
-- Without these, an admin clicks "delete" in the UI and Supabase
-- silently returns 0 rows affected (RLS blocks the row). To keep the
-- editor honest, we add admin-only policies for the missing verbs.
--
-- We only add policies that are missing — existing self/owner policies
-- still apply for non-admin users.
-- ============================================================

-- profiles -------------------------------------------------------------------
-- Note: deleting from profiles alone leaves an orphan auth.users row that
-- can no longer self-onboard. The /admin/db editor's deleteRow handler
-- special-cases profiles and goes through the service role to delete the
-- corresponding auth.users (which CASCADEs into profiles). This DELETE
-- policy is still useful as a safety net + for direct SQL access.
drop policy if exists profiles_admin_delete on profiles;
create policy profiles_admin_delete on profiles for delete using (is_admin());

drop policy if exists profiles_admin_insert on profiles;
create policy profiles_admin_insert on profiles for insert with check (is_admin());

-- bookings -------------------------------------------------------------------
drop policy if exists bookings_admin_delete on bookings;
create policy bookings_admin_delete on bookings for delete using (is_admin());

-- matches --------------------------------------------------------------------
drop policy if exists matches_admin_delete on matches;
create policy matches_admin_delete on matches for delete using (is_admin());

-- coach_reviews --------------------------------------------------------------
drop policy if exists coach_reviews_admin_delete on coach_reviews;
create policy coach_reviews_admin_delete on coach_reviews for delete using (is_admin());

-- quiz_answers ---------------------------------------------------------------
drop policy if exists quiz_answers_admin_update on quiz_answers;
create policy quiz_answers_admin_update on quiz_answers for update
  using (is_admin()) with check (is_admin());
drop policy if exists quiz_answers_admin_delete on quiz_answers;
create policy quiz_answers_admin_delete on quiz_answers for delete using (is_admin());

-- notifications_outbox -------------------------------------------------------
-- Cron / route handler still inserts as service role; this lets admins
-- triage the queue (e.g. cancel a stuck pending email).
drop policy if exists outbox_admin_write on notifications_outbox;
create policy outbox_admin_write on notifications_outbox for all
  using (is_admin()) with check (is_admin());

-- rating_history -------------------------------------------------------------
-- Writes normally happen via the SECURITY DEFINER recalc function. Allow
-- admin-only manual fixups via the editor.
drop policy if exists rating_history_admin_write on rating_history;
create policy rating_history_admin_write on rating_history for all
  using (is_admin()) with check (is_admin());

-- tournament_participants ----------------------------------------------------
-- Policies for owner/player exist; add a clean admin-all so the editor can
-- INSERT new rows under any account without satisfying tournament-owner check.
drop policy if exists tp_admin_all on tournament_participants;
create policy tp_admin_all on tournament_participants for all
  using (is_admin()) with check (is_admin());
