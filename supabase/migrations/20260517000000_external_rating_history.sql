-- ============================================================
-- external_rating_history — per-discipline timeline of external rating changes.
--
-- Why this exists.
-- We already store the *current* snapshot of an external rating in
-- `external_ratings` (one row per (player, source)). That is enough to
-- render a badge but not enough to draw a line: the player wants to see
-- how their Liga Tennisa Elo evolved over time, side by side with our
-- internal Elo chart on /me/rating and /players/[id].
--
-- We deliberately do NOT push these points into `rating_history`:
--   * rating_history is the timeline of our INTERNAL Elo only — a single
--     scale, with strict semantics (delta_30d / best / worst stats are
--     read off it). Mixing in external scores would corrupt those.
--   * external sources have their own scale, calibration period, and a
--     different cadence (manual refresh, not per-match).
--   * a separate table makes adding more sources later a one-line enum
--     change.
--
-- Singles and doubles each get their own series (one row per refresh per
-- discipline), so the chart can render them as separate lines.
--
-- Writes
--   * inserted by Server Actions in lib/rating/external/actions-impl.ts:
--       - confirmImportFromLt → reason='initial_import'
--       - refreshExternalRating → reason='manual_refresh'
--         (only when new value differs from previous one)
--       - admin set / future flows → reason='admin_set'
--   * never written from the browser; RLS denies all public writes.
--
-- Cascade on disconnect: when a player removes their external rating
-- (`external_ratings` row is deleted), the entire timeline goes with it.
-- That is the product decision (per chat: "чистим всё").
-- ============================================================

create table public.external_rating_history (
  id                  uuid primary key default gen_random_uuid(),
  player_id           uuid not null references public.profiles(id) on delete cascade,
  external_rating_id  uuid not null references public.external_ratings(id) on delete cascade,
  source              text not null check (source in ('liga_tennisa')),
  external_id         text not null,

  -- nullable for the very first measurement (initial_import has no prior value)
  old_elo             integer,
  new_elo             integer not null,
  delta               integer generated always as (new_elo - coalesce(old_elo, new_elo)) stored,

  -- Singles and doubles are tracked as independent series. LT exposes both.
  discipline          text not null check (discipline in ('singles','doubles')),

  display_tier_old    text,
  display_tier_new    text not null,

  -- Mirrors LT's "still calibrating" flag at the time of the snapshot so the
  -- chart can mark provisional points differently.
  is_calibrating      boolean not null default false,

  reason              text not null check (
    reason in ('initial_import','manual_refresh','admin_set')
  ),

  -- Whitelisted upstream JSON snapshot (mirrors external_ratings.raw_payload
  -- shape; see lib/validators/external-ratings.ts).
  raw_payload         jsonb,

  created_at          timestamptz not null default now()
);

-- Primary read pattern: one player's timeline for one discipline, newest first.
create index ext_rh_player_disc_idx
  on public.external_rating_history (player_id, discipline, created_at desc);

-- Secondary: per-source analytics ("how often do LT players refresh?").
create index ext_rh_source_idx
  on public.external_rating_history (source, created_at desc);

-- ----------------------------------------------------------------
-- RLS — public read for badges/charts; no public writes.
-- All inserts/updates/deletes happen via the service-role client from
-- Server Actions in lib/rating/external/actions-impl.ts.
-- ----------------------------------------------------------------
alter table public.external_rating_history enable row level security;

create policy ext_rh_public_read
  on public.external_rating_history
  for select
  using (true);

create policy ext_rh_admin_write
  on public.external_rating_history
  for all
  using (is_admin())
  with check (is_admin());

comment on table public.external_rating_history is
  'Per-discipline (singles/doubles) timeline of external rating changes. '
  'One row per measurement (initial import + each manual refresh that '
  'actually changed the value). Read by /me/rating and /players/[id] to '
  'render the second Elo line next to our internal chart.';

comment on column public.external_rating_history.discipline is
  'singles or doubles — each is an independent line on the chart.';

comment on column public.external_rating_history.old_elo is
  'NULL for the very first point (reason=initial_import) — there is no '
  'prior value to compare against.';

comment on column public.external_rating_history.reason is
  'initial_import — first time the player connected this external source. '
  'manual_refresh — player pressed ↻ on /me/profile and the value changed. '
  'admin_set — admin manually set the value (audit trail).';
