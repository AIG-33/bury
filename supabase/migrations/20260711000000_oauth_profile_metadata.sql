-- ============================================================
-- OAuth sign-in: enrich handle_new_user() from provider metadata.
--
-- Google and Apple deliver the user's name/avatar in
-- auth.users.raw_user_meta_data under different keys than our
-- email/password path (which sets first_name/last_name/locale directly):
--   - Google  : full_name, name, given_name, family_name, picture, avatar_url
--   - Apple   : full_name / name (first sign-in only), otherwise nothing
--
-- This migration recreates handle_new_user() so newly-created profiles are
-- populated from whatever metadata the provider supplied, defaulting locale
-- to 'ru' (Belarus) and deriving first/last name from a combined full name
-- when explicit parts are absent. avatar_url is seeded from picture/avatar_url.
--
-- Forward-only: we do not edit the original trigger definition
-- (20260421000000_init.sql) or the Belarus locale patch
-- (20260510000000_belarus_relocation.sql). The existing
-- on_auth_user_created trigger already points at this function name, so
-- CREATE OR REPLACE is enough. RLS is untouched (function is SECURITY DEFINER).
-- ============================================================

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  meta   jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_full text  := coalesce(nullif(meta->>'full_name', ''), nullif(meta->>'name', ''));
  v_first text := coalesce(nullif(meta->>'first_name', ''), nullif(meta->>'given_name', ''));
  v_last  text := coalesce(nullif(meta->>'last_name', ''), nullif(meta->>'family_name', ''));
begin
  -- Fall back to splitting a combined display name (e.g. Google "full_name",
  -- Apple's first-login name) when the provider didn't send discrete parts.
  if v_first is null and v_full is not null then
    v_first := split_part(v_full, ' ', 1);
    if position(' ' in v_full) > 0 then
      v_last := coalesce(v_last, nullif(trim(substr(v_full, position(' ' in v_full) + 1)), ''));
    end if;
  end if;

  insert into public.profiles (id, email_local, locale, first_name, last_name, avatar_url)
  values (
    new.id,
    split_part(new.email, '@', 1),
    coalesce(nullif(meta->>'locale', ''), 'ru'),
    v_first,
    v_last,
    coalesce(nullif(meta->>'avatar_url', ''), nullif(meta->>'picture', ''))
  )
  on conflict (id) do nothing;

  return new;
end $$;
