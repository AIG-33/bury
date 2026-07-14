-- ============================================================
-- Tournament application mode — per-tournament choice of how
-- player applications are confirmed:
--
--   'manual' — (status quo for every existing tournament) the
--              player's row is created with status='pending'
--              and the organizer approves / rejects it from
--              the participants section.
--   'auto'   — the application is confirmed immediately: the
--              server action validates registration window,
--              deadline and capacity, then writes the row with
--              status='approved' (via the service role — the
--              tp_player_register RLS policy intentionally
--              keeps client-side inserts pending-only, so a
--              player still can't self-approve directly).
--
-- Default is 'manual' so no existing tournament changes
-- behaviour. Forward-only per AGENTS.md §3.9.
--
-- No RLS changes needed:
--   * tp_player_register (insert pending-only) stays the same;
--   * the auto-approve write happens server-side with the
--     service role after the same checks the owner-side
--     approval performs.
-- ============================================================

alter table public.tournaments
  add column if not exists application_mode text
  not null default 'manual'
  check (application_mode in ('auto', 'manual'));

comment on column public.tournaments.application_mode is
  'How player applications are confirmed: ''manual'' — the organizer '
  'approves each pending application by hand (default, historical '
  'behaviour); ''auto'' — applications are approved immediately while '
  'registration is open and there is capacity.';
