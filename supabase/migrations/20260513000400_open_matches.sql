-- =============================================================================
-- Phase D — Open Matches
-- =============================================================================
--
-- Concept
-- -------
-- An "open match" is a public invitation: "I want to play singles at venue X
-- on Saturday 18:00 — anyone in level band Y, apply to join". This is the
-- counterpart to the directed `matches` proposal flow already implemented
-- in /me/find: instead of picking a specific opponent, you broadcast.
--
-- Two tables. `open_matches` is the post itself. `open_match_applications`
-- is one row per applicant per post.
--
-- Lifecycle
-- ---------
-- open_matches.status:
--   open      -- accepting applications
--   filled    -- creator accepted enough applicants → no further apply
--   cancelled -- creator pulled the post
--   expired   -- starts_at passed without being filled (set by maintenance)
--
-- open_match_applications.status:
--   pending   -- default on insert
--   accepted  -- creator chose this applicant
--   rejected  -- creator declined
--   withdrawn -- applicant pulled their application
--
-- Once an open match is `filled` we leave the row in place (so applicants
-- still see history) but new applications are blocked by RLS.
--
-- RLS
-- ---
-- open_matches:
--   SELECT  : everyone (anon + authed) for status in ('open','filled') so
--             the public feed and venue tab work; creator/admin always see
--             their own rows regardless of status (incl. cancelled).
--   INSERT  : authed user, with creator_id = auth.uid().
--   UPDATE  : creator only; status transitions guarded by trigger.
--   DELETE  : disallowed — we keep history for transparency.
--
-- open_match_applications:
--   SELECT  : applicant; or creator of the parent open_match; admin.
--   INSERT  : authed user, with applicant_id = auth.uid(); only when the
--             parent open_match is currently `open`; creator cannot apply
--             to their own post (DB constraint).
--   UPDATE  : applicant can flip pending → withdrawn; creator can flip
--             pending → accepted/rejected.
--   DELETE  : disallowed.
--
-- Indexes
-- -------
-- open_matches needs a hot index for the public feed: by status + starts_at
-- so we can paginate "upcoming" cheaply.
-- =============================================================================

-- ----------------------------------------------------------------------------
-- 1. Tables
-- ----------------------------------------------------------------------------

create table if not exists public.open_matches (
  id              uuid primary key default gen_random_uuid(),
  creator_id      uuid not null references public.profiles(id) on delete cascade,
  venue_id        uuid references public.venues(id)        on delete set null,
  district_id     uuid references public.districts(id)     on delete set null,
  starts_at       timestamptz not null,
  duration_min    integer not null default 90 check (duration_min between 30 and 300),
  format          text not null default 'singles' check (format in ('singles', 'doubles')),
  level_band      text not null default 'any' check (level_band in (
                    'any', 'beginner', 'improver', 'confident', 'strong', 'elite')),
  -- Sanity bound: 1 partner needed for singles, up to 3 for doubles.
  -- (We don't enforce by format here — the action layer does.)
  slots_needed    integer not null default 1 check (slots_needed between 1 and 3),
  notes           text check (notes is null or length(notes) between 1 and 600),
  status          text not null default 'open' check (status in (
                    'open', 'filled', 'cancelled', 'expired')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

comment on table public.open_matches is
  'Phase D — public open-match invitations. Creator broadcasts "I want to play '
  'here on this date in this level band"; eligible players apply via '
  'open_match_applications. Lifecycle: open → filled / cancelled / expired.';

create index if not exists open_matches_status_starts_idx
  on public.open_matches (status, starts_at);
create index if not exists open_matches_venue_idx
  on public.open_matches (venue_id) where venue_id is not null;
create index if not exists open_matches_creator_idx
  on public.open_matches (creator_id);

create trigger trg_open_matches_updated
  before update on public.open_matches
  for each row execute function public.set_updated_at();

create table if not exists public.open_match_applications (
  id              uuid primary key default gen_random_uuid(),
  open_match_id   uuid not null references public.open_matches(id) on delete cascade,
  applicant_id    uuid not null references public.profiles(id)    on delete cascade,
  message         text check (message is null or length(message) between 1 and 400),
  status          text not null default 'pending' check (status in (
                    'pending', 'accepted', 'rejected', 'withdrawn')),
  created_at      timestamptz not null default now(),
  decided_at      timestamptz,
  -- One applicant can apply to a given open match only once.
  unique (open_match_id, applicant_id)
);

comment on table public.open_match_applications is
  'Per-(open_match, applicant) row. Creator transitions pending → '
  'accepted/rejected; applicant can transition pending → withdrawn.';

create index if not exists open_match_applications_match_idx
  on public.open_match_applications (open_match_id);
create index if not exists open_match_applications_applicant_idx
  on public.open_match_applications (applicant_id);

-- ----------------------------------------------------------------------------
-- 2. RLS
-- ----------------------------------------------------------------------------

alter table public.open_matches            enable row level security;
alter table public.open_match_applications enable row level security;

-- open_matches.SELECT — public read for active rows, creator/admin sees own.
create policy open_matches_read on public.open_matches for select using (
  status in ('open', 'filled', 'expired')
  or creator_id = auth.uid()
  or public.is_admin()
);

-- open_matches.INSERT — authed; creator must be self.
create policy open_matches_insert on public.open_matches for insert with check (
  creator_id = auth.uid()
);

-- open_matches.UPDATE — creator only. Status transitions enforced in app code
-- (server action) plus the CHECK constraint on the column.
create policy open_matches_update on public.open_matches for update using (
  creator_id = auth.uid() or public.is_admin()
) with check (
  creator_id = auth.uid() or public.is_admin()
);

-- open_match_applications.SELECT — applicant, parent's creator, or admin.
create policy open_match_apps_read on public.open_match_applications for select using (
  applicant_id = auth.uid()
  or exists (
    select 1 from public.open_matches om
    where om.id = open_match_applications.open_match_id
      and om.creator_id = auth.uid()
  )
  or public.is_admin()
);

-- open_match_applications.INSERT — authed; only into currently-open posts;
-- and never on your own post.
create policy open_match_apps_insert on public.open_match_applications for insert with check (
  applicant_id = auth.uid()
  and exists (
    select 1 from public.open_matches om
    where om.id = open_match_applications.open_match_id
      and om.status = 'open'
      and om.creator_id <> auth.uid()
  )
);

-- open_match_applications.UPDATE — applicant (withdraw) or parent creator
-- (accept/reject); admin always. The valid status flips are validated in
-- the server action; RLS just gates write authority.
create policy open_match_apps_update on public.open_match_applications for update using (
  applicant_id = auth.uid()
  or exists (
    select 1 from public.open_matches om
    where om.id = open_match_applications.open_match_id
      and om.creator_id = auth.uid()
  )
  or public.is_admin()
) with check (
  applicant_id = auth.uid()
  or exists (
    select 1 from public.open_matches om
    where om.id = open_match_applications.open_match_id
      and om.creator_id = auth.uid()
  )
  or public.is_admin()
);

-- ----------------------------------------------------------------------------
-- 3. Public denormalized view for the feed
-- ----------------------------------------------------------------------------
-- The /open-matches list and the venue Open-Matches tab need cheap reads
-- with creator + venue display. Joining these in the loader is fine for now
-- but a view future-proofs the shape so we can swap in a materialized view
-- later if scale demands.

create or replace view public.open_matches_feed as
select
  om.id,
  om.creator_id,
  pr.display_name      as creator_name,
  pr.avatar_url        as creator_avatar,
  pr.current_elo       as creator_elo,
  pr.elo_status        as creator_elo_status,
  om.venue_id,
  v.name               as venue_name,
  v.city               as venue_city,
  v.is_indoor          as venue_is_indoor,
  om.district_id,
  d.name               as district_name,
  om.starts_at,
  om.duration_min,
  om.format,
  om.level_band,
  om.slots_needed,
  om.notes,
  om.status,
  om.created_at,
  -- Count of pending applications, surfaced so the creator sees "3 new"
  -- without a per-row subquery in the loader.
  (
    select count(*)
    from public.open_match_applications a
    where a.open_match_id = om.id and a.status = 'pending'
  ) as pending_applications_count,
  (
    select count(*)
    from public.open_match_applications a
    where a.open_match_id = om.id and a.status = 'accepted'
  ) as accepted_applications_count
from public.open_matches om
join public.profiles pr on pr.id = om.creator_id
left join public.venues    v on v.id = om.venue_id
left join public.districts d on d.id = om.district_id;

comment on view public.open_matches_feed is
  'Denormalized feed for the public Open Matches list and venue tabs. RLS is '
  'inherited from open_matches and profiles via the security_invoker default.';

-- The view inherits RLS from its base tables; we still need explicit grants
-- for anon/authenticated to be able to query it.
grant select on public.open_matches_feed to anon, authenticated;
