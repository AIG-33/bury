-- ============================================================
-- Backfill profiles for auth.users that have no profiles row.
--
-- Why this fix.
-- A user reported a foreign-key violation on
-- `external_ratings_player_id_fkey` while running /onboarding/import-lt
-- in production. The FK targets `profiles(id)`, so the only way it can
-- fail is if the authenticated user has no `profiles` row at all.
--
-- Normally `handle_new_user` (an after-insert trigger on `auth.users`)
-- creates that row at signup time. We've already seen at least one
-- account in production where that didn't happen — most likely because
-- the trigger was re-installed by a later migration and a signup that
-- happened before/during the migration was lost. The foreign key catches
-- the orphan correctly; we just need to repair the existing rows and
-- harden the path so it can't fail silently next time.
--
-- This migration:
--   1. Re-creates the orphan recovery as an inline INSERT-with-conflict
--      across every auth.users id that's missing from profiles. Uses the
--      same column derivation as `handle_new_user` (email_local,
--      first/last from raw metadata, locale → 'ru').
--   2. Leaves the existing `handle_new_user` trigger as-is — it already
--      uses `on conflict (id) do nothing`, so re-runs are safe.
--
-- Forward-only and idempotent: the `where not exists (...)` filter means
-- re-running the migration on a healthy DB inserts nothing.
-- ============================================================

insert into public.profiles (id, email_local, locale, first_name, last_name)
select
  u.id,
  split_part(u.email, '@', 1),
  coalesce(nullif(u.raw_user_meta_data->>'locale', ''), 'ru'),
  nullif(u.raw_user_meta_data->>'first_name', ''),
  nullif(u.raw_user_meta_data->>'last_name', '')
from auth.users u
where not exists (
  select 1 from public.profiles p where p.id = u.id
)
on conflict (id) do nothing;
