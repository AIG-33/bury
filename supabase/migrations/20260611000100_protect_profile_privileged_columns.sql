-- ============================================================
-- Protect privileged columns on public.profiles from self-service
-- privilege escalation.
--
-- Why: the `profiles_self_update` policy (20260421000000_init.sql)
-- allows a user to UPDATE *every* column of their own profiles row.
-- With the public anon key and the browser Supabase client a player
-- could set is_admin = true, is_coach = true, or rewrite current_elo.
-- Postgres RLS cannot express per-column rules, so we enforce them
-- with a BEFORE UPDATE trigger instead.
--
-- Who is allowed to change privileged columns:
--   * service_role — server-side flows (quiz submit, LT import,
--     admin Server Actions) legitimately write Elo / onboarding state
--     through the service client (JWT claim role = 'service_role');
--   * direct DB sessions (postgres, migrations, seeds) where
--     request.jwt.claims is not set at all;
--   * admins — public.is_admin() is SECURITY DEFINER (see
--     20260422000000_admin_rls_recursion_fix.sql), so it returns the
--     true flag without RLS recursion.
-- Anyone else changing a privileged column gets an exception.
-- ============================================================

create or replace function public.protect_profile_privileged_columns()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  jwt_role text :=
    nullif(current_setting('request.jwt.claims', true), '')::jsonb->>'role';
begin
  -- Server key or direct DB connection → trusted, skip the check.
  if jwt_role is null or jwt_role = 'service_role' then
    return new;
  end if;

  if public.is_admin() then
    return new;
  end if;

  if new.is_admin                  is distinct from old.is_admin
     or new.is_coach               is distinct from old.is_coach
     or new.is_player              is distinct from old.is_player
     or new.current_elo            is distinct from old.current_elo
     or new.elo_status             is distinct from old.elo_status
     or new.rated_matches_count    is distinct from old.rated_matches_count
     or new.onboarding_completed_at is distinct from old.onboarding_completed_at
  then
    raise exception 'changing privileged profile columns is not allowed'
      using errcode = '42501'; -- insufficient_privilege
  end if;

  return new;
end $$;

drop trigger if exists trg_profiles_protect_privileged on public.profiles;
create trigger trg_profiles_protect_privileged
  before update on public.profiles
  for each row
  execute function public.protect_profile_privileged_columns();
