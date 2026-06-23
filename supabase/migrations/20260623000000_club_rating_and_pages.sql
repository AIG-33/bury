-- ============================================================
-- Per-club internal rating systems + customizable club pages.
--
-- Product shape (agreed with the owner):
--   * Each club runs its OWN Elo rating, fully separate from the global
--     profiles.current_elo. Club results never touch a player's site rating.
--   * The club rating uses the same Elo engine as the site, but with
--     per-club tunables (K-factors, multipliers, starting rating). Defaults
--     mirror the site-wide formula.
--   * Fed by: matches of the club's own tournaments + friendly matches
--     between two approved club members + manual adjustments by the owner.
--   * The club page becomes customizable: brand color, cover image, and a
--     set of toggleable content blocks (rating table, tournaments, roster,
--     venues).
--
-- All new tables: RLS ON. Writes to the rating tables flow through the
-- service role inside Server Actions (with an in-code club-admin check), so
-- the public-facing policies stay read-only.
-- ============================================================

-- ------------------------------------------------------------
-- 1) Club page customization (branding + block toggles).
-- ------------------------------------------------------------

alter table public.clubs
  add column if not exists brand_color text
    check (brand_color is null or brand_color ~ '^#[0-9a-fA-F]{6}$');

alter table public.clubs
  add column if not exists cover_url text;

alter table public.clubs
  add column if not exists page_blocks jsonb not null
    default jsonb_build_object(
      'rating', true,
      'tournaments', true,
      'roster', true,
      'venues', true
    );

comment on column public.clubs.brand_color is
  'Optional accent color (#RRGGBB) applied to the public club page header.';
comment on column public.clubs.cover_url is
  'Optional hero/cover image for the public club page. Stored in the '
  'club-logos bucket under {club_id}/cover-*.';
comment on column public.clubs.page_blocks is
  'Which content blocks the owner shows on the public club page: '
  '{rating, tournaments, roster, venues} → boolean.';

-- ------------------------------------------------------------
-- 2) Per-club rating settings (one row per club).
-- ------------------------------------------------------------

create table if not exists public.club_rating_settings (
  club_id     uuid primary key references public.clubs(id) on delete cascade,
  enabled     boolean not null default true,
  label       text,
  config      jsonb not null default jsonb_build_object(
                'start_rating', 1000,
                'floor', 100,
                'k_factors', jsonb_build_object(
                  'provisional', 40,
                  'intermediate', 32,
                  'established', 20,
                  'provisional_until_n_matches', 5,
                  'intermediate_until_n_matches', 30
                ),
                'multipliers', jsonb_build_object(
                  'friendly', 0.5,
                  'tournament', 1.0,
                  'tournament_final', 1.25
                )
              ),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.club_rating_settings enable row level security;

drop trigger if exists trg_club_rating_settings_updated on public.club_rating_settings;
create trigger trg_club_rating_settings_updated
  before update on public.club_rating_settings
  for each row execute function set_updated_at();

comment on table public.club_rating_settings is
  'Per-club Elo configuration. config JSONB is validated by '
  'ClubRatingConfigSchema (lib/clubs/rating-schema.ts). Defaults mirror the '
  'site-wide DEFAULT_ALGORITHM_CONFIG.';

-- Public read (the club page shows the rating label / whether it is enabled).
drop policy if exists club_rating_settings_read on public.club_rating_settings;
create policy club_rating_settings_read on public.club_rating_settings
  for select using (true);

-- Club owner / co-admin (or platform admin) can configure the rating system.
drop policy if exists club_rating_settings_write on public.club_rating_settings;
create policy club_rating_settings_write on public.club_rating_settings
  using (is_club_admin(club_id) or is_admin())
  with check (is_club_admin(club_id) or is_admin());

-- ------------------------------------------------------------
-- 3) Per-club, per-player current rating (the standings table).
-- ------------------------------------------------------------

create table if not exists public.club_member_ratings (
  id                   uuid primary key default gen_random_uuid(),
  club_id              uuid not null references public.clubs(id)    on delete cascade,
  player_id            uuid not null references public.profiles(id) on delete cascade,
  rating               integer not null,
  rating_status        text not null default 'provisional'
                       check (rating_status in ('provisional', 'established')),
  rated_matches_count  integer not null default 0,
  wins                 integer not null default 0,
  losses               integer not null default 0,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (club_id, player_id)
);

alter table public.club_member_ratings enable row level security;

drop trigger if exists trg_club_member_ratings_updated on public.club_member_ratings;
create trigger trg_club_member_ratings_updated
  before update on public.club_member_ratings
  for each row execute function set_updated_at();

create index if not exists club_member_ratings_leaderboard_idx
  on public.club_member_ratings (club_id, rating desc);

comment on table public.club_member_ratings is
  'Current per-club Elo for each player. Written only by the service role '
  '(lib/rating/club-recalc.ts) inside Server Actions; never by the browser.';

-- Public read (the club standings page is public).
drop policy if exists club_member_ratings_read on public.club_member_ratings;
create policy club_member_ratings_read on public.club_member_ratings
  for select using (true);

-- No public write: recalc/manual-adjust run with the service role (bypasses
-- RLS). Platform admins keep CRUD via the admin DB UI.
drop policy if exists club_member_ratings_admin_write on public.club_member_ratings;
create policy club_member_ratings_admin_write on public.club_member_ratings
  using (is_admin())
  with check (is_admin());

-- ------------------------------------------------------------
-- 4) Per-club rating change log (audit + chart source).
-- ------------------------------------------------------------

create table if not exists public.club_rating_history (
  id           uuid primary key default gen_random_uuid(),
  club_id      uuid not null references public.clubs(id)    on delete cascade,
  player_id    uuid not null references public.profiles(id) on delete cascade,
  match_id     uuid references public.matches(id) on delete set null,
  old_rating   integer not null,
  new_rating   integer not null,
  delta        integer generated always as (new_rating - old_rating) stored,
  k_factor     integer,
  multiplier   numeric(3, 2),
  reason       text not null
               check (reason in ('match', 'manual_adjustment', 'seed', 'reset')),
  note         text,
  created_by   uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now()
);

alter table public.club_rating_history enable row level security;

create index if not exists club_rating_history_club_player_idx
  on public.club_rating_history (club_id, player_id, created_at);

-- DB-level idempotency for match-driven rating: one row per (club, match,
-- player). Lets recalc be safely retried.
create unique index if not exists club_rating_history_match_unique
  on public.club_rating_history (club_id, match_id, player_id)
  where match_id is not null;

comment on table public.club_rating_history is
  'Append-only log of per-club rating changes (match / manual / seed). '
  'Written only by the service role inside Server Actions.';

drop policy if exists club_rating_history_read on public.club_rating_history;
create policy club_rating_history_read on public.club_rating_history
  for select using (true);

drop policy if exists club_rating_history_admin_write on public.club_rating_history;
create policy club_rating_history_admin_write on public.club_rating_history
  using (is_admin())
  with check (is_admin());
