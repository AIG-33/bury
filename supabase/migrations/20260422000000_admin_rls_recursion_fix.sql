-- ============================================================
-- Fix: is_admin() / is_coach_user() must bypass RLS internally.
--
-- Symptom (before): on /admin overview every count returns 0 even
-- for admins. The cause is that the original `is_admin()` was a plain
-- SQL function (no SECURITY DEFINER). Inside, it does
--     select is_admin from profiles where id = auth.uid()
-- which is itself filtered by the `profiles_self_read` policy:
--     auth.uid() = id OR is_admin()
-- Postgres does not guarantee short-circuit evaluation of OR in policies,
-- so calling is_admin() while evaluating a row whose id <> auth.uid()
-- recurses into a is_admin() lookup that is again RLS-filtered, hits
-- the recursion guard, and returns NULL. coalesce(...,false) then
-- returns false → admin sees zero rows.
--
-- Fix: make both helpers SECURITY DEFINER with a fixed search_path.
-- This way the inner SELECT runs with the function owner's privileges
-- and bypasses RLS, returning the true `is_admin` flag.
-- ============================================================

create or replace function is_admin() returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select is_admin from profiles where id = auth.uid()), false);
$$;

create or replace function is_coach_user() returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select is_coach from profiles where id = auth.uid()), false);
$$;

-- These are called from RLS policies, so any authenticated role must be
-- able to execute them. Owner of the function (postgres / supabase_admin)
-- is the role whose privileges are used by SECURITY DEFINER, so RLS on
-- `profiles` is bypassed inside the function body — but only for the
-- single-row lookup we perform.
grant execute on function is_admin()       to anon, authenticated;
grant execute on function is_coach_user()  to anon, authenticated;
