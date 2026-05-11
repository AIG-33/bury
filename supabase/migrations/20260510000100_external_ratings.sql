-- ============================================================
-- external_ratings — secondary ratings imported from external systems.
--
-- Why this table exists.
-- The Belarus amateur scene is anchored by https://www.ligatennisa.com/
-- (~2400+ active players with tier + Elo). When a new player joins our
-- platform we want to spare them the onboarding quiz IF they already have
-- a ranked profile in Liga Tennisa: instead, with their explicit consent,
-- we import display data (name, avatar, hand/backhand, Instagram, year
-- they started tennis) AND seed our `profiles.current_elo` from the LT
-- singles Elo (clamped to our 800–2200 range).
--
-- However the LT rating MUST stay separate from our Elo at runtime — we
-- have our own matches, our own K-factor schedule, our own multipliers.
-- This table therefore stores the LT rating as a *secondary* signal that:
--
--   1. is publicly visible on the player's profile as a labelled badge
--      ("Legger · 1488 in Liga Tennisa") with a deep link to the source,
--   2. can be used as an extra range filter in /me/find ("show only
--      opponents with LT Elo between 1500 and 1700"),
--   3. is refreshed only when the player presses ↻ in their profile —
--      no cron, no admin sync. This minimises legal/abuse surface and
--      keeps the integration entirely opt-in per player.
--
-- One row per (player, source). Hard-uniqueness on the external id too,
-- so two different accounts can never claim the same LT player.
--
-- raw_payload stores the parsed-and-whitelisted upstream JSON (we
-- explicitly drop their `password_hash`, see lib/validators/external-ratings).
-- ============================================================

create table public.external_ratings (
  id                       uuid primary key default gen_random_uuid(),
  player_id                uuid not null references public.profiles(id) on delete cascade,

  -- Identity of the upstream rating source. Open enum so we can later
  -- add other regional federations without another migration.
  source                   text not null check (source in ('liga_tennisa')),
  external_id              text not null,
  external_url             text not null,

  -- Display / search data (denormalised from raw_payload for fast filters).
  display_tier             text not null,
  external_elo             integer not null,
  external_elo_doubles     integer,
  is_calibrating_singles   boolean not null default false,
  is_calibrating_doubles   boolean not null default false,

  -- Whitelisted upstream JSON payload (no PII like password_hash).
  raw_payload              jsonb not null default '{}'::jsonb,

  -- Audit / refresh bookkeeping.
  imported_at              timestamptz not null default now(),
  last_refreshed_at        timestamptz not null default now(),
  last_refresh_error       text,

  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),

  -- A given player can link at most one profile per source; a given
  -- external profile can be claimed by at most one platform user.
  unique (player_id, source),
  unique (source, external_id)
);

-- Fast filter when the user adds an LT-Elo range to /me/find search.
create index external_ratings_source_elo_idx
  on public.external_ratings (source, external_elo);

-- Trigger keeps `updated_at` honest (mirrors the project's convention,
-- see set_updated_at() in 20260421000000_init.sql).
create trigger trg_external_ratings_updated
  before update on public.external_ratings
  for each row execute function set_updated_at();

-- ----------------------------------------------------------------
-- RLS — public read (badges are public per product decision), writes
-- restricted to the owner or admin. No anon writes ever.
-- ----------------------------------------------------------------
alter table public.external_ratings enable row level security;

create policy ext_ratings_public_read
  on public.external_ratings
  for select
  using (true);

create policy ext_ratings_self_insert
  on public.external_ratings
  for insert
  with check (player_id = auth.uid() or is_admin());

create policy ext_ratings_self_update
  on public.external_ratings
  for update
  using (player_id = auth.uid() or is_admin())
  with check (player_id = auth.uid() or is_admin());

create policy ext_ratings_self_delete
  on public.external_ratings
  for delete
  using (player_id = auth.uid() or is_admin());

comment on table public.external_ratings is
  'Per-player secondary ratings imported from external systems (currently only '
  'Liga Tennisa, https://www.ligatennisa.com/). Public read for badges; writes '
  'only by the owner. Refresh is manual via the player''s profile.';

comment on column public.external_ratings.raw_payload is
  'Whitelisted upstream JSON. Sensitive fields (password_hash, password_salt) '
  'are dropped at the validator boundary in lib/validators/external-ratings.ts.';

comment on column public.external_ratings.last_refresh_error is
  'NULL when the latest refresh succeeded. Populated with the upstream error '
  'message if the manual refresh attempt failed; cached values stay visible.';
