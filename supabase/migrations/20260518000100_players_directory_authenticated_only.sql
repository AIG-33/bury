-- ============================================================
-- Restrict player directory to authenticated users only.
--
-- The /players catalogue and /players/[id] profiles are no longer
-- a pre-registration "shop window". Revoke anon SELECT on the
-- RLS-bypassing view; authenticated role keeps access.
-- ============================================================

begin;

revoke select on public.public_player_directory from anon;

comment on view public.public_player_directory is
  'RLS-bypassing projection of `profiles` where `visible_in_find_player = true`. '
  'Exposes only non-PII fields. SELECT granted to authenticated only — '
  'the /players catalogue requires a signed-in account.';

commit;
