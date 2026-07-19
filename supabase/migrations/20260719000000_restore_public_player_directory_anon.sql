-- ============================================================
-- Restore anon SELECT on public_player_directory.
--
-- /players and /players/[id] are a public SEO shop window again.
-- The view still exposes only non-PII columns for players who opted
-- into find-player visibility. Contact details stay behind auth.
-- ============================================================

begin;

grant select on public.public_player_directory to anon, authenticated;

comment on view public.public_player_directory is
  'RLS-bypassing projection of `profiles` where `visible_in_find_player = true`. '
  'Exposes only non-PII fields. SELECT granted to anon and authenticated — '
  'used by the public /players catalogue and sitemap.';

commit;
