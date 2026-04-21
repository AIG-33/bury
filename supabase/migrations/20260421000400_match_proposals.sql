-- =============================================================================
-- Match proposals (Iteration 6: Find a Player) + WhatsApp channel in outbox.
--
-- Existing matches.outcome already supports 'proposed'. We add:
--   - proposal_message:        free-form note from the initiator
--   - proposal_responded_at:   timestamp of accept/decline by p2
--   - proposal_response_note:  reason on decline / hello on accept
--
-- Convention: when matches.tournament_id is NULL and outcome = 'proposed':
--   p1_id = initiator (the one who clicks "Propose match")
--   p2_id = opponent  (the one who receives the request and accepts/declines)
-- =============================================================================

alter table public.matches
  add column if not exists proposal_message      text,
  add column if not exists proposal_responded_at timestamptz,
  add column if not exists proposal_response_note text;

comment on column public.matches.proposal_message is
  'Optional free-form note from the initiator when proposing a friendly match (Find-a-Player flow).';
comment on column public.matches.proposal_responded_at is
  'When p2 accepted or declined the proposal. Null = still pending response.';
comment on column public.matches.proposal_response_note is
  'Optional note from p2 when responding (e.g. "Sure, suggest 18:00 on Wed" or "Sorry, knee injury").';

-- Avoid duplicate active proposals between the same pair (in either direction).
-- Only enforces while outcome = 'proposed'.
drop index if exists matches_unique_active_proposal;
create unique index matches_unique_active_proposal
  on public.matches (
    least(p1_id, p2_id),
    greatest(p1_id, p2_id)
  )
  where tournament_id is null
    and outcome = 'proposed';

-- =============================================================================
-- Add 'whatsapp' channel to notifications_outbox (reserved for Phase 2 sender).
-- =============================================================================
alter table public.notifications_outbox
  drop constraint if exists notifications_outbox_channel_check;
alter table public.notifications_outbox
  add constraint notifications_outbox_channel_check
  check (channel in ('email', 'whatsapp', 'telegram'));

comment on column public.notifications_outbox.channel is
  'Delivery channel. email = primary (Resend, active). whatsapp = reserved for Phase 2 (WhatsApp Business API). telegram = optional secondary (grammY bot when enabled).';
