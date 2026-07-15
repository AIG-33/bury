-- ============================================================
-- Account deletion (App Store Guideline 5.1.1(v)).
--
-- The in-app deletion flow destroys the auth.users row (via
-- auth.admin.deleteUser) and either purges or ANONYMIZES the
-- public.profiles row:
--
--   * purge      — no shared history (no matches, no finished
--                  tournaments) → the profile row is deleted and
--                  the public-schema FK cascades clean the rest;
--   * anonymize  — the user appears in matches / brackets other
--                  players rely on → the profile row is kept as a
--                  depersonalized «Удалённый игрок» tombstone so
--                  opponents' Elo history and tournament results
--                  stay consistent.
--
-- The anonymize path requires the profiles row to OUTLIVE the
-- auth.users row. The original schema declared
--   profiles.id references auth.users(id) on delete cascade,
-- which would cascade the tombstone away (and from there wipe
-- matches of other players via matches.p1_id/p2_id cascade).
-- We drop that FK: profile creation is still driven by the
-- on_auth_user_created trigger + the profiles_self_insert RLS
-- policy (auth.uid() = id), so rows can only appear for real
-- auth users; a row without an auth user is exactly the
-- tombstone case we now support.
-- ============================================================

begin;

alter table public.profiles drop constraint if exists profiles_id_fkey;

commit;
