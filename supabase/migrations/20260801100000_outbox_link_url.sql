-- =============================================================================
-- Clickable in-app notifications: notifications_outbox.link_url
--
-- Why
--   The /m/notifications feed renders outbox rows, but items were not
--   clickable — there was no way to navigate to the tournament / match / club
--   the notification is about.
--
-- What this migration does
--   Adds a nullable `link_url` column: a locale-less in-app path (e.g.
--   "/tournaments/<id>") that the notifications UI turns into a locale-aware
--   link. Old rows keep NULL — the UI falls back to deriving the target from
--   `template` + `payload`.
--
-- Forward-only, idempotent — safe to run via the Supabase SQL Editor.
-- =============================================================================

alter table public.notifications_outbox
  add column if not exists link_url text;

comment on column public.notifications_outbox.link_url is
  'Locale-less in-app path the notification links to (e.g. /tournaments/<id>). '
  'NULL on legacy rows — the UI derives a fallback from template + payload.';
