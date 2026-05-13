-- ============================================================
-- Hybrid "groups + playoff" tournament format.
--
-- Why
--   The previous formats (single_elimination, round_robin) were
--   either pure knockout or pure RR. Recurring amateur cups want
--   a hybrid: split N approved players into K groups, each group
--   plays a round-robin, then the top-M of every group advance
--   to a single-elimination playoff (1/8 / 1/4 / 1/2). This
--   migration adds the data model so a single tournament row can
--   own both group matches and playoff matches.
--
-- What this adds
--   1) `tournament_groups` — one row per group (A, B, …). FK to
--      tournaments with ON DELETE CASCADE.
--
--   2) `tournament_participants.group_id` — nullable, references
--      the group the approved player landed in. Null while groups
--      haven't been generated yet OR for non-group_playoff
--      formats. ON DELETE SET NULL so deleting a group only
--      unbinds participants (the SA cascades downstream).
--
--   3) `matches.stage` — text, nullable for legacy non-hybrid
--      tournaments. Values: 'group' / 'playoff' / 'third_place'.
--      `matches.group_id` — references the group when stage='group'
--      (ON DELETE CASCADE: dropping a group drops its matches).
--
--   4) `tournaments.groups_count` / `advance_per_group` /
--      `playoff_size` — set by the organiser at draw-time (groups
--      generation + close-groups respectively). Cached so the
--      bracket / standings UI doesn't have to re-derive them.
--      `third_place_match` — opt-in flag set on the tournament
--      form; the SA inserts the matchup when the playoff is built.
--
-- All adds are NULL-friendly so legacy tournaments keep working.
-- Forward-only per AGENTS.md §3.9.
-- ============================================================

-- ------------------------------------------------------------
-- 1) tournament_groups
-- ------------------------------------------------------------

create table if not exists public.tournament_groups (
  id            uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  name          text not null,
  position      int  not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (tournament_id, name),
  unique (tournament_id, position)
);

create index if not exists tg_tournament_idx
  on public.tournament_groups (tournament_id, position);

alter table public.tournament_groups enable row level security;

drop trigger if exists trg_tournament_groups_updated on public.tournament_groups;
create trigger trg_tournament_groups_updated
  before update on public.tournament_groups
  for each row execute function set_updated_at();

-- Read: anyone who can see the parent tournament (use the SECURITY DEFINER
-- helper introduced in 20260514000000).
drop policy if exists tournament_groups_read on public.tournament_groups;
create policy tournament_groups_read on public.tournament_groups
  for select using (is_tournament_visible(tournament_id));

-- Write: owner of the parent tournament (or platform admin).
drop policy if exists tournament_groups_owner_write on public.tournament_groups;
create policy tournament_groups_owner_write on public.tournament_groups
  using (is_tournament_owner(tournament_id) or is_admin())
  with check (is_tournament_owner(tournament_id) or is_admin());

comment on table public.tournament_groups is
  'Groups for hybrid (group + playoff) tournaments. Each tournament owns '
  'K groups; participants land in exactly one group (or none, for non-hybrid '
  'formats). Group matches live in `matches` with stage=''group'' and group_id.';

-- ------------------------------------------------------------
-- 2) tournament_participants.group_id
-- ------------------------------------------------------------

alter table public.tournament_participants
  add column if not exists group_id uuid
    references public.tournament_groups(id) on delete set null;

create index if not exists tp_group_idx
  on public.tournament_participants (group_id)
  where group_id is not null;

comment on column public.tournament_participants.group_id is
  'Group the approved participant was placed in (group_playoff format). '
  'Null for non-hybrid tournaments or before the draw.';

-- ------------------------------------------------------------
-- 3) matches.stage + matches.group_id
-- ------------------------------------------------------------

alter table public.matches
  add column if not exists stage    text,
  add column if not exists group_id uuid
    references public.tournament_groups(id) on delete cascade;

alter table public.matches drop constraint if exists matches_stage_check;
alter table public.matches
  add constraint matches_stage_check
  check (stage is null or stage in ('group', 'playoff', 'third_place'));

create index if not exists matches_group_idx
  on public.matches (group_id)
  where group_id is not null;

create index if not exists matches_tournament_stage_idx
  on public.matches (tournament_id, stage)
  where stage is not null;

comment on column public.matches.stage is
  'Pipeline stage inside a hybrid tournament. '
  '''group''       — round-robin inside one tournament_group; '
  '''playoff''     — single-elimination after groups close; '
  '''third_place'' — the 3rd-place play-off between the two losing semi-finalists. '
  'Null for legacy single_elimination / round_robin tournaments.';

comment on column public.matches.group_id is
  'For stage=''group'' matches: the group this match belongs to. Null otherwise.';

-- ------------------------------------------------------------
-- 4) tournaments columns
-- ------------------------------------------------------------

alter table public.tournaments
  add column if not exists groups_count      int,
  add column if not exists advance_per_group int,
  add column if not exists playoff_size      int,
  add column if not exists third_place_match boolean not null default false;

alter table public.tournaments drop constraint if exists tournaments_groups_count_check;
alter table public.tournaments
  add constraint tournaments_groups_count_check
  check (groups_count is null or groups_count between 2 and 16);

alter table public.tournaments drop constraint if exists tournaments_advance_per_group_check;
alter table public.tournaments
  add constraint tournaments_advance_per_group_check
  check (advance_per_group is null or advance_per_group between 1 and 8);

alter table public.tournaments drop constraint if exists tournaments_playoff_size_check;
alter table public.tournaments
  add constraint tournaments_playoff_size_check
  check (playoff_size is null or playoff_size in (2, 4, 8, 16, 32));

comment on column public.tournaments.groups_count is
  'How many groups to split approved players into (group_playoff format). '
  'Set by the organiser when generating the group stage; null until then.';

comment on column public.tournaments.advance_per_group is
  'Top-N players that advance from every group into the playoff bracket. '
  'Set when the organiser closes the group stage.';

comment on column public.tournaments.playoff_size is
  'Power-of-two playoff bracket size (2=Final, 4=SF, 8=QF, 16=R16, 32=R32). '
  'Picked together with advance_per_group. Total qualifiers = '
  'groups_count × advance_per_group must be ≤ playoff_size (extra slots '
  'become byes for the top seeds, as in classic tennis draws).';

comment on column public.tournaments.third_place_match is
  'Whether the playoff includes a 3rd-place play-off between the two losing '
  'semi-finalists. Default false (most amateur cups skip it).';
