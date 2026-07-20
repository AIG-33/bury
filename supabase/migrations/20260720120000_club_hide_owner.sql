-- ============================================================
-- Club privacy: option to hide the creator/owner on the public club page.
--
-- When hide_owner = true the owner is excluded from the public roster
-- lists (coaches / players) of the club page. Standings in the club
-- rating table are NOT affected — results stay truthful.
-- ============================================================

alter table public.clubs
  add column if not exists hide_owner boolean not null default false;

comment on column public.clubs.hide_owner is
  'When true, the club creator/owner is not shown in the public roster '
  'of the club page. Toggled by the owner in the club settings form.';
