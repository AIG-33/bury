-- ============================================================
-- Tournament extras: start time of day, entry fee, multi-venue.
--
-- Why
--   Coaches asked for three things during tournament creation:
--     1. The start TIME on the first day (currently only a date).
--     2. Multiple VENUES per tournament (a single tournament can run
--        across 2–3 clubs; the current schema has no venue link at all).
--     3. ENTRY FEE in PLN, so players know the cost up front.
--
-- Design
--   * `tournaments.start_time time without time zone` — interpreted in
--      the club timezone (Europe/Warsaw, per AGENTS.md §1). Nullable —
--      legacy and "TBD" tournaments stay valid.
--   * `tournaments.entry_fee_pln integer` — non-negative, NULL = free /
--      not specified. Whole złotys is enough for amateur club fees and
--      mirrors `coach_hourly_rate_pln`.
--   * `tournament_venues (tournament_id, venue_id)` — pure many-to-many
--      junction table, composite PK, ON DELETE CASCADE on the
--      tournament side and ON DELETE RESTRICT on the venue side
--      (deleting a venue with active tournaments should fail loudly,
--      not silently orphan references).
--
-- RLS
--   * tournament_venues SELECT — anyone who can see the tournament
--     (re-uses the SECURITY DEFINER `is_tournament_visible` helper from
--      20260422000600 — no recursion risk).
--   * tournament_venues INSERT/UPDATE/DELETE — tournament owner or admin.
-- ============================================================

alter table public.tournaments
  add column if not exists start_time     time without time zone,
  add column if not exists entry_fee_pln  integer
    check (entry_fee_pln is null or entry_fee_pln >= 0);

comment on column public.tournaments.start_time is
  'Local start time on starts_on (Europe/Warsaw). NULL = TBD.';
comment on column public.tournaments.entry_fee_pln is
  'Entry fee in whole PLN. NULL = free / not specified.';

-- ------------------------------------------------------------
-- Junction table: tournaments × venues
-- ------------------------------------------------------------
create table if not exists public.tournament_venues (
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  venue_id      uuid not null references public.venues(id)      on delete restrict,
  created_at    timestamptz not null default now(),
  primary key (tournament_id, venue_id)
);

create index if not exists tournament_venues_venue_idx
  on public.tournament_venues (venue_id);

comment on table public.tournament_venues is
  'Many-to-many link between tournaments and venues. A tournament may '
  'use multiple venues (e.g. group stage at venue A, finals at venue B). '
  'Use ON DELETE RESTRICT on venue_id so deleting a venue with active '
  'tournaments fails loudly instead of silently orphaning references.';

alter table public.tournament_venues enable row level security;

drop policy if exists tournament_venues_read on public.tournament_venues;
create policy tournament_venues_read on public.tournament_venues
  for select using (
    public.is_tournament_visible(tournament_id) or is_admin()
  );

drop policy if exists tournament_venues_owner_write on public.tournament_venues;
create policy tournament_venues_owner_write on public.tournament_venues
  for all
  using (
    public.is_tournament_owner(tournament_id) or is_admin()
  )
  with check (
    public.is_tournament_owner(tournament_id) or is_admin()
  );
