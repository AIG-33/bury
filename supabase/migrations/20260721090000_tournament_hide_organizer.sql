-- ============================================================
-- Tournament privacy: option to hide the organizer on the public
-- tournament page.
--
-- When hide_organizer = true the organizer's name and avatar are not
-- exposed by the public tournament detail loader (web + mobile pages).
-- Organizer-side management screens are NOT affected.
-- ============================================================

alter table public.tournaments
  add column if not exists hide_organizer boolean not null default false;

comment on column public.tournaments.hide_organizer is
  'When true, the organizer''s name and avatar are not shown on the public '
  'tournament page. Toggled by the organizer in the tournament form.';
