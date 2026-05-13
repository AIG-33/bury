-- ============================================================
-- Allow `external_import` as a valid reason in rating_history.
--
-- Why this fix.
-- The Liga Tennisa import flow (lib/rating/external/actions-impl.ts ::
-- confirmImportFromLt) writes an audit row to rating_history with
-- `reason = 'external_import'` so the player's Elo timeline correctly
-- shows where the seed value came from. The original init.sql constraint
-- only listed ('match','manual_adjustment','onboarding','seasonal_decay'),
-- so every import silently failed that INSERT and the timeline lost its
-- "imported from LT" anchor (the import itself succeeded — current_elo
-- was set — but the audit row never landed).
--
-- Forward-only: drop and re-create the check with the new value list.
-- No data migration needed; existing rows already use one of the legacy
-- values, all of which remain valid.
-- ============================================================

alter table public.rating_history
  drop constraint if exists rating_history_reason_check;

alter table public.rating_history
  add constraint rating_history_reason_check
  check (reason in (
    'match',
    'manual_adjustment',
    'onboarding',
    'seasonal_decay',
    'external_import'
  ));

comment on column public.rating_history.reason is
  'Why this rating change exists. ''match'' — confirmed match Elo recalc. '
  '''manual_adjustment'' — admin override. ''onboarding'' — starting Elo '
  'from the onboarding quiz. ''seasonal_decay'' — end-of-season Race decay. '
  '''external_import'' — seed value imported from an external rating source '
  '(e.g. Liga Tennisa) via /onboarding/import-lt.';
