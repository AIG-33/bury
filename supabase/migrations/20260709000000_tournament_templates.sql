-- ============================================================
-- Tournament templates — named reusable tournament presets.
--
-- Product shape (multi-league onboarding, Phase A):
--   * An organiser saves any of their tournaments as a named template:
--     format, match rules, surface, venues, fee, privacy, seeding, prizes.
--     Run-specific bits (dates, registration deadline, participants) are
--     deliberately NOT part of the payload — every run picks fresh dates.
--   * A template can optionally be bound to a club. Club-bound templates
--     are visible to (and usable by) the club owner and approved co-admins,
--     so a league's stage presets are shared across its moderators.
--   * `payload` JSONB is validated by TournamentTemplatePayloadSchema in
--     lib/tournaments/template-schema.ts (AGENTS.md §7 JSONB rule).
--   * Deleting a template never touches tournaments created from it —
--     there is intentionally no FK from tournaments to templates.
-- ============================================================

create table if not exists public.tournament_templates (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references public.profiles(id) on delete cascade,
  -- ON DELETE SET NULL: if the club goes away the template survives as a
  -- personal template of its creator.
  club_id     uuid references public.clubs(id) on delete set null,
  name        text not null check (char_length(name) between 2 and 120),
  payload     jsonb not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.tournament_templates enable row level security;

drop trigger if exists trg_tournament_templates_updated on public.tournament_templates;
create trigger trg_tournament_templates_updated
  before update on public.tournament_templates
  for each row execute function set_updated_at();

create index if not exists tournament_templates_owner_idx
  on public.tournament_templates (owner_id);

create index if not exists tournament_templates_club_idx
  on public.tournament_templates (club_id)
  where club_id is not null;

comment on table public.tournament_templates is
  'Named tournament presets ("save as template" / "create from template"). '
  'payload mirrors the create-tournament form minus dates/deadline/club '
  '(the club binding lives on this row; the name doubles as the default '
  'tournament name). Validated by TournamentTemplatePayloadSchema.';

comment on column public.tournament_templates.club_id is
  'Optional club binding. Club-bound templates are shared with the club''s '
  'owner and approved co-admins; personal templates (null) are private.';

-- ------------------------------------------------------------
-- RLS. Visibility follows the sharing model:
--   * personal template  → creator only;
--   * club-bound template → creator + club owner/co-admins;
--   * platform admins see everything.
-- ------------------------------------------------------------

drop policy if exists tournament_templates_read on public.tournament_templates;
create policy tournament_templates_read on public.tournament_templates
  for select using (
    owner_id = auth.uid()
    or (club_id is not null and public.is_club_admin(club_id))
    or is_admin()
  );

-- INSERT: only as yourself; binding to a club requires administering it.
drop policy if exists tournament_templates_insert on public.tournament_templates;
create policy tournament_templates_insert on public.tournament_templates
  for insert with check (
    (
      owner_id = auth.uid()
      and (club_id is null or public.is_club_admin(club_id))
    )
    or is_admin()
  );

drop policy if exists tournament_templates_update on public.tournament_templates;
create policy tournament_templates_update on public.tournament_templates
  for update
  using (
    owner_id = auth.uid()
    or (club_id is not null and public.is_club_admin(club_id))
    or is_admin()
  )
  with check (
    owner_id = auth.uid()
    or (club_id is not null and public.is_club_admin(club_id))
    or is_admin()
  );

drop policy if exists tournament_templates_delete on public.tournament_templates;
create policy tournament_templates_delete on public.tournament_templates
  for delete using (
    owner_id = auth.uid()
    or (club_id is not null and public.is_club_admin(club_id))
    or is_admin()
  );

-- ------------------------------------------------------------
-- Club organizer panel: the club owner / co-admins see EVERY
-- tournament of their club (drafts included) plus its matches and
-- participants, even when the tournament belongs to another organiser.
--
-- Two touch points:
--   * `tournaments_read` policy — direct reads of the tournaments table;
--   * `is_tournament_visible(uuid)` helper — routes the RLS of
--     `tournament_participants` (tp_read) and `matches` (matches_read),
--     which the panel's pending-scores queue and participant counters
--     rely on.
--
-- Write access is intentionally NOT widened: managing a tournament
-- (draw, scores, participants) stays with its owner_id.
-- ------------------------------------------------------------

create or replace function public.is_tournament_visible(_tournament_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from tournaments t
     where t.id = _tournament_id
       and (
            t.privacy = 'public'
         or t.owner_id = auth.uid()
         or exists (
              select 1 from tournament_participants tp
               where tp.tournament_id = t.id
                 and tp.player_id = auth.uid()
            )
         or (t.club_id is not null and public.is_club_admin(t.club_id))
       )
  );
$$;

drop policy if exists tournaments_read on public.tournaments;
create policy tournaments_read on public.tournaments
  for select using (
    privacy = 'public'
    or owner_id = auth.uid()
    or public.is_tournament_participant(id)
    or (club_id is not null and public.is_club_admin(club_id))
    or is_admin()
  );
